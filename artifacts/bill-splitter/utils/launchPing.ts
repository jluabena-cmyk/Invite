/**
 * Utility helpers for the launch-time API ping that is recorded in telemetry.
 * Extracted from _layout.tsx so they can be unit-tested in isolation without
 * any React Native / Expo dependencies.
 */

export interface PingResult {
  reachable: boolean;
  pingMs: number;
}

/**
 * Fires a single GET request to `https://<domain>/api/ping` and resolves to a
 * `PingResult`.  Never rejects — network errors and timeouts both resolve to
 * `{ reachable: false, pingMs: <elapsed> }`.
 *
 * @param domain         - e.g. `"myapp.replit.app"`.  Falsy → immediate
 *                         `{ reachable: false, pingMs: 0 }`.
 * @param fetchFn        - injectable fetch implementation (defaults to the
 *                         global `fetch`).  Pass a spy/stub in tests.
 * @param timeoutMs      - abort the request after this many milliseconds
 *                         (default 5 000).
 */
export function createApiPingPromise(
  domain: string | undefined,
  fetchFn: typeof fetch = globalThis.fetch,
  timeoutMs = 5_000,
): Promise<PingResult> {
  if (!domain) return Promise.resolve({ reachable: false, pingMs: 0 });

  const start = Date.now();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  return fetchFn(`https://${domain}/api/ping`, { signal: controller.signal })
    .then((r) => {
      clearTimeout(tid);
      return { reachable: r.ok, pingMs: Date.now() - start };
    })
    .catch(() => {
      clearTimeout(tid);
      return { reachable: false, pingMs: Date.now() - start };
    });
}

/**
 * Fires a single GET request to `<proxyUrl>/v1/client` to verify the Clerk
 * proxy is reachable from the device.  Never rejects.
 *
 * @param proxyUrl  - e.g. `"https://invite-9bwgw.replit.app/api/__clerk"`.
 *                   Falsy → immediate `{ reachable: false, pingMs: 0 }`.
 */
export function createProxyPingPromise(
  proxyUrl: string | undefined,
  fetchFn: typeof fetch = globalThis.fetch,
  timeoutMs = 5_000,
): Promise<PingResult> {
  if (!proxyUrl) return Promise.resolve({ reachable: false, pingMs: 0 });

  const start = Date.now();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  return fetchFn(`${proxyUrl}/v1/client`, { signal: controller.signal })
    .then((r) => {
      clearTimeout(tid);
      // Clerk FAPI returns 200 for a valid proxy request
      return { reachable: r.ok, pingMs: Date.now() - start };
    })
    .catch(() => {
      clearTimeout(tid);
      return { reachable: false, pingMs: Date.now() - start };
    });
}

/**
 * Races `promise` against a timeout deadline.  If the deadline fires first,
 * `fallback` is returned.  The original promise is NOT cancelled — it simply
 * has no further effect on the caller.
 *
 * @param promise    - the promise to race.
 * @param timeoutMs  - deadline in milliseconds.
 * @param fallback   - value returned when the deadline wins.
 */
export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}
