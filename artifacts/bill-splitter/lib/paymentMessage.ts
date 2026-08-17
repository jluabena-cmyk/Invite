// ─── Payment SMS/share message building ──────────────────────────────────────
// Shared helpers for composing the payment request text sent to guests:
// a single preferred payment link plus an itemized breakdown that always
// reconciles exactly to the amount requested.

export interface PaymentMessageItem {
  id: number;
  name: string;
  price: string; // dollars, e.g. "12.50"
  quantity: number;
}

export interface PaymentMessageAssignment {
  receiptItemId: number;
  userId: number | null;
  guestParticipantId?: number | null;
  claimed: boolean;
}

function assignmentKey(a: PaymentMessageAssignment): number {
  return a.guestParticipantId ? -a.guestParticipantId : a.userId!;
}

function fmtCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Picks the single payment link to include in a payment message.
// Priority: guest's preferred method (if the host has it set up) → host's
// preferred method → first available (Venmo, Cash App, Zelle).
export function pickPaymentLink(opts: {
  amountCents: number;
  eventTitle: string;
  hostVenmoHandle: string | null;
  hostCashAppHandle: string | null;
  hostZelleInfo: string | null;
  hostPreferredMethod: string | null;
  guestPreferredMethod: string | null;
}): { label: string; link: string } | null {
  const { amountCents, eventTitle, hostVenmoHandle, hostCashAppHandle, hostZelleInfo, hostPreferredMethod, guestPreferredMethod } = opts;
  const dollars = (amountCents / 100).toFixed(2);
  const encodedNote = encodeURIComponent(eventTitle);

  // Normalize handles: profiles allow a leading @ on Venmo and $ on Cash App
  const venmoHandle = hostVenmoHandle ? hostVenmoHandle.replace(/^@/, "") : null;
  const cashHandle = hostCashAppHandle ? hostCashAppHandle.replace(/^\$/, "") : null;

  const available: Record<string, { label: string; link: string }> = {};
  if (venmoHandle) {
    // venmo:// URI scheme opens the payment screen with amount & note pre-filled.
    // The web URL (venmo.com/u/handle) only opens the profile page — no pre-fill.
    available.venmo = { label: "Venmo", link: `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${dollars}&note=${encodeURIComponent(eventTitle)}` };
  }
  if (cashHandle) {
    // cashapp://pay/ URI scheme opens the payment screen with handle and amount pre-filled.
    // The web URL (https://cash.app/$handle/amount) only opens the profile page on some
    // devices — no reliable pre-fill. URI scheme mirrors the same fix applied to Venmo
    // (venmo:// vs venmo.com/u/handle) and matches the scheme already used elsewhere in
    // the app (event/[id].tsx openWithFallback calls).
    available.cash_app = { label: "Cash App", link: `cashapp://pay/$${cashHandle}?amount=${dollars}` };
  }
  if (hostZelleInfo) {
    available.zelle = { label: "Zelle", link: `Send $${dollars} via Zelle to: ${hostZelleInfo}` };
  }

  if (guestPreferredMethod && available[guestPreferredMethod]) return available[guestPreferredMethod];
  if (hostPreferredMethod && available[hostPreferredMethod]) return available[hostPreferredMethod];
  return available.venmo ?? available.cash_app ?? available.zelle ?? null;
}

// Builds the "Your items" breakdown lines for one participant. Lines always
// sum exactly to `owedCents`:
//   • each item the guest claimed is listed at their raw share of that item
//     (item subtotal split evenly among claimants; remainder to first claimant
//     — same as the totals calculation's item-weight step)
//   • any positive difference vs the amount owed (tax, tip, service fees,
//     receipt-total scaling) is listed as "Tax, tip & fees"
//   • any negative difference (discounts, adjustments, total below item
//     subtotal) is listed as "Discounts & adjustments" with a minus sign
// participantKey uses the same convention as pKey/aKey: positive userId for
// app users, negative guestParticipantId for app-less guests.
export function buildItemizedLines(opts: {
  items: PaymentMessageItem[];
  assignments: PaymentMessageAssignment[];
  participantKey: number;
  owedCents: number;
}): string[] {
  const { items, assignments, participantKey, owedCents } = opts;
  const lines: string[] = [];
  let itemsShareCents = 0;
  for (const item of items) {
    const subtotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
    const active = assignments.filter((a) => a.receiptItemId === item.id && a.claimed);
    const idx = active.findIndex((a) => assignmentKey(a) === participantKey);
    if (idx === -1) continue;
    const shareCents = Math.floor(subtotalCents / active.length);
    const remainderCents = idx === 0 ? subtotalCents - shareCents * active.length : 0;
    const myShareCents = shareCents + remainderCents;
    itemsShareCents += myShareCents;
    lines.push(`\u2022 ${item.name} \u2014 ${fmtCents(myShareCents)}`);
  }
  if (lines.length === 0) return [];
  const residualCents = owedCents - itemsShareCents;
  if (residualCents > 0) {
    lines.push(`\u2022 Tax, tip & fees \u2014 ${fmtCents(residualCents)}`);
  } else if (residualCents < 0) {
    lines.push(`\u2022 Discounts & adjustments \u2014 -${fmtCents(residualCents)}`);
  }
  return lines;
}

export function buildPaymentSmsBody(opts: {
  guestFirstName: string;
  amountCents: number;
  eventTitle: string;
  hostVenmoHandle: string | null;
  hostCashAppHandle: string | null;
  hostZelleInfo: string | null;
  hostPreferredMethod: string | null;
  guestPreferredMethod: string | null;
  itemLines: string[];
  receiptUrl: string | null;
}): string {
  const { guestFirstName, amountCents, eventTitle, itemLines, receiptUrl } = opts;
  const dollars = (amountCents / 100).toFixed(2);

  const parts: string[] = [`Hi ${guestFirstName}! You owe $${dollars} for ${eventTitle}.`];

  const payment = pickPaymentLink(opts);
  if (payment) {
    parts.push(`Pay via ${payment.label}:\n${payment.link}`);
  }

  if (itemLines.length > 0) {
    parts.push(`Your items:\n${itemLines.join("\n")}`);
  }

  if (receiptUrl) {
    parts.push(`View full receipt: ${receiptUrl}`);
  }

  return parts.join("\n\n");
}
