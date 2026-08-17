import { describe, it, expect } from "vitest";
import { parsePaymentQr } from "../parsePaymentQr";

describe("parsePaymentQr", () => {
  describe("Cash App", () => {
    it("parses cash.app URL with $ prefix", () => {
      const result = parsePaymentQr("https://cash.app/$johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("parses cash.app URL without $ prefix and adds it", () => {
      const result = parsePaymentQr("https://cash.app/johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("parses www.cash.app URL", () => {
      const result = parsePaymentQr("https://www.cash.app/$johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("parses cashapp:// deep link with $ prefix", () => {
      const result = parsePaymentQr("cashapp://$johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("parses cashapp:// deep link without $ prefix and adds it", () => {
      const result = parsePaymentQr("cashapp://johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("parses raw $cashtag string", () => {
      const result = parsePaymentQr("$johndoe");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("handles leading/trailing whitespace", () => {
      const result = parsePaymentQr("  $johndoe  ");
      expect(result).toEqual({ type: "cash_app", handle: "$johndoe" });
    });

    it("does not treat $cashtag with spaces as Cash App", () => {
      const result = parsePaymentQr("$john doe");
      expect(result).toEqual({ type: "unknown", raw: "$john doe" });
    });
  });

  describe("Venmo", () => {
    it("parses venmo.com URL", () => {
      const result = parsePaymentQr("https://venmo.com/johndoe");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });

    it("parses www.venmo.com URL", () => {
      const result = parsePaymentQr("https://www.venmo.com/johndoe");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });

    it("parses venmo://paycharge?txn=pay&recipients=handle (real Venmo QR format)", () => {
      const result = parsePaymentQr("venmo://paycharge?txn=pay&recipients=johndoe");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });

    it("parses venmo://paycharge?recipients=handle without txn param", () => {
      const result = parsePaymentQr("venmo://paycharge?recipients=johndoe");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });

    it("does NOT return 'paycharge' as the handle for paycharge QR URLs", () => {
      const result = parsePaymentQr("venmo://paycharge?txn=pay&recipients=johndoe");
      expect(result.type).toBe("venmo");
      if (result.type === "venmo") {
        expect(result.handle).not.toBe("paycharge");
        expect(result.handle).toBe("johndoe");
      }
    });

    it("parses venmo:// protocol URL via URL parser", () => {
      const result = parsePaymentQr("venmo://johndoe");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });

    it("parses venmo.com URL with trailing slash and query string", () => {
      const result = parsePaymentQr("https://venmo.com/johndoe?v=1");
      expect(result).toEqual({ type: "venmo", handle: "johndoe" });
    });
  });

  describe("unknown", () => {
    it("returns unknown for unrecognized QR", () => {
      const result = parsePaymentQr("https://example.com/pay");
      expect(result).toEqual({ type: "unknown", raw: "https://example.com/pay" });
    });

    it("returns unknown for plain text", () => {
      const result = parsePaymentQr("some random text");
      expect(result).toEqual({ type: "unknown", raw: "some random text" });
    });

    it("returns unknown for empty string", () => {
      const result = parsePaymentQr("");
      expect(result).toEqual({ type: "unknown", raw: "" });
    });

    it("returns unknown for a URL with no path after cash.app", () => {
      const result = parsePaymentQr("https://cash.app/");
      expect(result).toEqual({ type: "unknown", raw: "https://cash.app/" });
    });
  });
});
