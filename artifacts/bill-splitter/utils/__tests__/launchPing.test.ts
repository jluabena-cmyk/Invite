import { describe, it, expect, vi, afterEach } from "vitest";
import { createApiPingPromise, raceWithTimeout } from "../launchPing";

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// createApiPingPromise
// ---------------------------------------------------------------------------

describe("createApiPingPromise", () => {
  it("resolves to { reachable: false, pingMs: 0 } when domain is undefined", async () => {
    const result = await createApiPingPromise(undefined);
    expect(result).toEqual({ reachable: false, pingMs: 0 });
  });

  it("resolves to { reachable: false, pingMs: 0 } when domain is empty string", async () => {
    const result = await createApiPingPromise("");
    expect(result).toEqual({ reachable: false, pingMs: 0 });
  });

  it("resolves to { reachable: true } when fetch returns ok: true", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result.reachable).toBe(true);
    expect(result.pingMs).toBeGreaterThanOrEqual(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/ping",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("resolves to { reachable: false } when fetch returns ok: false", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result.reachable).toBe(false);
    expect(result.pingMs).toBeGreaterThanOrEqual(0);
  });

  it("resolves to { reachable: false } when fetch throws (network down)", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new TypeError("Network request failed"));
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result.reachable).toBe(false);
    expect(result.pingMs).toBeGreaterThanOrEqual(0);
  });

  it("resolves to { reachable: false } when fetch throws AbortError (timeout)", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const mockFetch = vi.fn().mockRejectedValueOnce(abortError);
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result.reachable).toBe(false);
    expect(result.pingMs).toBeGreaterThanOrEqual(0);
  });

  it("records elapsed time in pingMs even on failure", async () => {
    // Simulate a slow fetch that rejects after ~20 ms.
    const mockFetch = vi.fn().mockImplementationOnce(
      () => new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new TypeError("Network request failed")), 20)
      ),
    );
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result.reachable).toBe(false);
    // Allow generous range: the test environment may be slow.
    expect(result.pingMs).toBeGreaterThanOrEqual(15);
    expect(result.pingMs).toBeLessThan(500);
  });

  it("never rejects — always resolves", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("unexpected"));
    // If this rejects, the test will throw.
    const result = await createApiPingPromise("example.com", mockFetch);
    expect(result).toMatchObject({ reachable: false });
  });
});

// ---------------------------------------------------------------------------
// raceWithTimeout
// ---------------------------------------------------------------------------

describe("raceWithTimeout", () => {
  it("resolves with the promise value when it resolves before the deadline", async () => {
    vi.useFakeTimers();
    const fast = Promise.resolve({ reachable: true, pingMs: 50 });
    const racePromise = raceWithTimeout(fast, 500, { reachable: false, pingMs: 0 });
    vi.runAllTimers();
    const result = await racePromise;
    expect(result).toEqual({ reachable: true, pingMs: 50 });
  });

  it("resolves with the fallback when the promise is stuck beyond the deadline", async () => {
    vi.useFakeTimers();

    // A promise that never resolves (simulates API_PING_RESULT being indefinitely stuck).
    const stuck = new Promise<{ reachable: boolean; pingMs: number }>(() => {});
    const fallback = { reachable: false, pingMs: 0 };

    const racePromise = raceWithTimeout(stuck, 500, fallback);

    // Advance past the 500 ms deadline.
    vi.advanceTimersByTime(501);

    const result = await racePromise;
    expect(result).toEqual(fallback);
  });

  it("does not wait for the deadline when the promise is already resolved", async () => {
    vi.useFakeTimers();
    const immediate = Promise.resolve({ reachable: true, pingMs: 10 });
    const racePromise = raceWithTimeout(immediate, 500, { reachable: false, pingMs: 0 });
    // Do NOT advance timers — the promise should win without needing the timeout.
    const result = await racePromise;
    expect(result).toEqual({ reachable: true, pingMs: 10 });
  });

  it("500 ms race resolves in time even when API_PING_RESULT is perpetually pending", async () => {
    vi.useFakeTimers();

    // Simulate what postLaunchTelemetry does internally.
    const pendingPing = new Promise<{ reachable: boolean; pingMs: number }>(() => {});
    const racePromise = raceWithTimeout(pendingPing, 500, { reachable: false, pingMs: 0 });

    vi.advanceTimersByTime(500);
    const result = await racePromise;

    // The race must settle and return the fallback — never leave postLaunchTelemetry hanging.
    expect(result).toEqual({ reachable: false, pingMs: 0 });
  });

  it("works with non-object types (generic)", async () => {
    vi.useFakeTimers();
    const stuck = new Promise<string>(() => {});
    const racePromise = raceWithTimeout(stuck, 100, "timeout");
    vi.advanceTimersByTime(101);
    const result = await racePromise;
    expect(result).toBe("timeout");
  });
});
