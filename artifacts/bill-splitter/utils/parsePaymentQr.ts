export type ParsedPaymentQr =
  | { type: "venmo"; handle: string }
  | { type: "cash_app"; handle: string }
  | { type: "unknown"; raw: string };

export function parsePaymentQr(raw: string): ParsedPaymentQr {
  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);

    if (
      url.hostname === "venmo.com" ||
      url.hostname === "www.venmo.com" ||
      url.protocol === "venmo:"
    ) {
      // venmo://paycharge?txn=pay&recipients=handle is the real QR format
      const recipients = url.searchParams.get("recipients");
      if (recipients) return { type: "venmo", handle: recipients };
      const path = url.pathname.replace(/^\/+/, "").split("?")[0].split("/")[0];
      if (path) return { type: "venmo", handle: path };
    }

    if (url.hostname === "cash.app" || url.hostname === "www.cash.app") {
      const path = url.pathname.replace(/^\/+/, "");
      if (path.startsWith("$")) return { type: "cash_app", handle: path };
      if (path) return { type: "cash_app", handle: `$${path}` };
    }
  } catch {
  }

  if (trimmed.startsWith("venmo://")) {
    // Check query params first for the paycharge format
    const qIdx = trimmed.indexOf("?");
    if (qIdx !== -1) {
      const params = new URLSearchParams(trimmed.slice(qIdx + 1));
      const recipients = params.get("recipients");
      if (recipients) return { type: "venmo", handle: recipients };
    }
    const after = trimmed.slice("venmo://".length).replace(/^\/+/, "").split("?")[0].split("/")[0];
    if (after) return { type: "venmo", handle: after };
  }

  if (trimmed.startsWith("cashapp://")) {
    const after = trimmed.slice("cashapp://".length).replace(/^\/+/, "").split("?")[0];
    if (after.startsWith("$")) return { type: "cash_app", handle: after };
    if (after) return { type: "cash_app", handle: `$${after}` };
  }

  if (trimmed.startsWith("$") && !trimmed.includes(" ")) {
    return { type: "cash_app", handle: trimmed };
  }

  return { type: "unknown", raw: trimmed };
}
