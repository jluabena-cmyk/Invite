import { describe, it, expect } from "vitest";
import {
  pickPaymentLink,
  buildItemizedLines,
  buildPaymentSmsBody,
  type PaymentMessageItem,
  type PaymentMessageAssignment,
} from "../../lib/paymentMessage";

const hostAll = {
  hostVenmoHandle: "@hostvenmo",
  hostCashAppHandle: "$hostcash",
  hostZelleInfo: "host@example.com",
};

describe("pickPaymentLink", () => {
  it("uses the guest's preferred method when the host has it", () => {
    const res = pickPaymentLink({
      amountCents: 1250,
      eventTitle: "Dinner",
      ...hostAll,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: "cash_app",
    });
    expect(res?.label).toBe("Cash App");
    expect(res?.link).toBe("cashapp://pay/$hostcash?amount=12.50");
  });

  it("falls back to the host's preferred method when guest has no preference", () => {
    const res = pickPaymentLink({
      amountCents: 1000,
      eventTitle: "Dinner",
      ...hostAll,
      hostPreferredMethod: "zelle",
      guestPreferredMethod: null,
    });
    expect(res?.label).toBe("Zelle");
    expect(res?.link).toContain("host@example.com");
  });

  it("falls back to host preference when host lacks the guest's method", () => {
    const res = pickPaymentLink({
      amountCents: 1000,
      eventTitle: "Dinner",
      hostVenmoHandle: "@hostvenmo",
      hostCashAppHandle: null,
      hostZelleInfo: null,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: "cash_app",
    });
    expect(res?.label).toBe("Venmo");
    expect(res?.link).toContain("venmo://paycharge");
  });

  it("falls back to first available when neither preference is usable", () => {
    const res = pickPaymentLink({
      amountCents: 1000,
      eventTitle: "Dinner",
      hostVenmoHandle: null,
      hostCashAppHandle: "$hostcash",
      hostZelleInfo: "host@example.com",
      hostPreferredMethod: "venmo",
      guestPreferredMethod: "venmo",
    });
    expect(res?.label).toBe("Cash App");
  });

  it("returns null when the host has no payment methods", () => {
    expect(
      pickPaymentLink({
        amountCents: 1000,
        eventTitle: "Dinner",
        hostVenmoHandle: null,
        hostCashAppHandle: null,
        hostZelleInfo: null,
        hostPreferredMethod: null,
        guestPreferredMethod: "venmo",
      }),
    ).toBeNull();
  });
});

describe("buildItemizedLines", () => {
  const items: PaymentMessageItem[] = [
    { id: 1, name: "Burger", price: "10.00", quantity: 1 },
    { id: 2, name: "Fries", price: "5.01", quantity: 1 },
    { id: 3, name: "Salad", price: "9.00", quantity: 1 },
  ];
  const assignments: PaymentMessageAssignment[] = [
    { receiptItemId: 1, userId: 7, claimed: true },
    { receiptItemId: 2, userId: 7, claimed: true },
    { receiptItemId: 2, userId: 8, claimed: true },
    { receiptItemId: 3, userId: 8, claimed: true },
  ];

  const sumLines = (lines: string[]) =>
    lines.reduce((s, l) => {
      const m = l.match(/(-?)\$(\d+\.\d\d)$/);
      return s + (m ? (m[1] === "-" ? -1 : 1) * Math.round(parseFloat(m[2]) * 100) : 0);
    }, 0);

  it("lists claimed items with split-share rounding (remainder to first claimant)", () => {
    // Fries $5.01 split two ways: first claimant (user 7) gets $2.51
    const lines = buildItemizedLines({ items, assignments, participantKey: 7, owedCents: 1251 });
    expect(lines).toEqual(["\u2022 Burger \u2014 $10.00", "\u2022 Fries \u2014 $2.51"]);
    expect(sumLines(lines)).toBe(1251);

    const lines8 = buildItemizedLines({ items, assignments, participantKey: 8, owedCents: 1150 });
    expect(lines8).toEqual(["\u2022 Fries \u2014 $2.50", "\u2022 Salad \u2014 $9.00"]);
  });

  it("adds a Tax, tip & fees line when owed exceeds item shares (service fees included)", () => {
    const lines = buildItemizedLines({ items, assignments, participantKey: 7, owedCents: 1500 });
    expect(lines[lines.length - 1]).toBe("\u2022 Tax, tip & fees \u2014 $2.49");
    expect(sumLines(lines)).toBe(1500);
  });

  it("adds a negative adjustment line when owed is below item shares (discount / receipt-total override)", () => {
    const lines = buildItemizedLines({ items, assignments, participantKey: 7, owedCents: 1100 });
    expect(lines[lines.length - 1]).toBe("\u2022 Discounts & adjustments \u2014 -$1.51");
    expect(sumLines(lines)).toBe(1100);
  });

  it("supports negative guest participant keys for app-less guests", () => {
    const guestAssignments: PaymentMessageAssignment[] = [
      { receiptItemId: 1, userId: null, guestParticipantId: 3, claimed: true },
    ];
    const lines = buildItemizedLines({ items, assignments: guestAssignments, participantKey: -3, owedCents: 1000 });
    expect(lines).toEqual(["\u2022 Burger \u2014 $10.00"]);
  });

  it("returns no lines when the guest claimed nothing", () => {
    expect(buildItemizedLines({ items, assignments, participantKey: 99, owedCents: 500 })).toEqual([]);
  });

  it("respects quantity in item subtotals", () => {
    const qtyItems: PaymentMessageItem[] = [{ id: 1, name: "Beer", price: "4.00", quantity: 3 }];
    const lines = buildItemizedLines({
      items: qtyItems,
      assignments: [{ receiptItemId: 1, userId: 7, claimed: true }],
      participantKey: 7,
      owedCents: 1200,
    });
    expect(lines).toEqual(["\u2022 Beer \u2014 $12.00"]);
  });
});

// ── Deep-link URI-scheme regression ──────────────────────────────────────────
// Both Venmo and Cash App URI schemes are undocumented and can break silently
// after an app update. These tests pin the *exact* full URL so any structural
// drift (path rename, param rename, missing param, web-URL fallback) is caught
// before it reaches users.
describe("pickPaymentLink — deep-link URI scheme regression", () => {
  // ── Venmo — exact full-URL assertions ────────────────────────────────────

  it("Venmo: produces the exact deep-link URL (scheme, path, all params)", () => {
    const res = pickPaymentLink({
      amountCents: 1500,
      eventTitle: "Dinner",
      hostVenmoHandle: "hostvenmo",
      hostCashAppHandle: null,
      hostZelleInfo: null,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: null,
    });
    expect(res?.label).toBe("Venmo");
    expect(res?.link).toBe(
      "venmo://paycharge?txn=pay&recipients=hostvenmo&amount=15.00&note=Dinner",
    );
  });

  it("Venmo: URL-encodes spaces and special chars in the event title", () => {
    const res = pickPaymentLink({
      amountCents: 2099,
      eventTitle: "Team Lunch",
      hostVenmoHandle: "myhandle",
      hostCashAppHandle: null,
      hostZelleInfo: null,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: null,
    });
    expect(res?.link).toBe(
      "venmo://paycharge?txn=pay&recipients=myhandle&amount=20.99&note=Team%20Lunch",
    );
  });

  it("Venmo: strips leading @ from handle before embedding in URL", () => {
    const res = pickPaymentLink({
      amountCents: 1000,
      eventTitle: "Dinner",
      hostVenmoHandle: "@withatsign",
      hostCashAppHandle: null,
      hostZelleInfo: null,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: null,
    });
    expect(res?.link).toBe(
      "venmo://paycharge?txn=pay&recipients=withatsign&amount=10.00&note=Dinner",
    );
  });

  // ── Cash App — exact full-URL assertions ─────────────────────────────────

  it("Cash App: produces the exact deep-link URL (scheme, path, handle, amount)", () => {
    const res = pickPaymentLink({
      amountCents: 1500,
      eventTitle: "Dinner",
      hostVenmoHandle: null,
      hostCashAppHandle: "hostcash",
      hostZelleInfo: null,
      hostPreferredMethod: "cash_app",
      guestPreferredMethod: null,
    });
    expect(res?.label).toBe("Cash App");
    expect(res?.link).toBe("cashapp://pay/$hostcash?amount=15.00");
  });

  it("Cash App: amount is formatted as decimal dollars in the URL", () => {
    const res = pickPaymentLink({
      amountCents: 3750,
      eventTitle: "Brunch",
      hostVenmoHandle: null,
      hostCashAppHandle: "myhandle",
      hostZelleInfo: null,
      hostPreferredMethod: "cash_app",
      guestPreferredMethod: null,
    });
    expect(res?.link).toBe("cashapp://pay/$myhandle?amount=37.50");
  });

  it("Cash App: strips leading $ from stored handle ($ is re-added by formatter, no doubling)", () => {
    const res = pickPaymentLink({
      amountCents: 1000,
      eventTitle: "Dinner",
      hostVenmoHandle: null,
      hostCashAppHandle: "$withdollar",
      hostZelleInfo: null,
      hostPreferredMethod: "cash_app",
      guestPreferredMethod: null,
    });
    // formatter always adds one $; stripping the stored $ prevents $$withdollar
    expect(res?.link).toBe("cashapp://pay/$withdollar?amount=10.00");
  });

  // ── Shared ───────────────────────────────────────────────────────────────

  it("neither link ever contains a web-URL fallback domain", () => {
    const venmo = pickPaymentLink({
      amountCents: 1000, eventTitle: "X",
      hostVenmoHandle: "v", hostCashAppHandle: null, hostZelleInfo: null,
      hostPreferredMethod: "venmo", guestPreferredMethod: null,
    });
    const cash = pickPaymentLink({
      amountCents: 1000, eventTitle: "X",
      hostVenmoHandle: null, hostCashAppHandle: "c", hostZelleInfo: null,
      hostPreferredMethod: "cash_app", guestPreferredMethod: null,
    });
    expect(venmo?.link).not.toContain("venmo.com");
    expect(cash?.link).not.toContain("cash.app/");
  });

  it("amount is formatted as decimal dollars (not cents) across representative values", () => {
    const cases: [number, string][] = [
      [500, "5.00"],
      [1099, "10.99"],
      [10000, "100.00"],
    ];
    for (const [amountCents, dollars] of cases) {
      const venmo = pickPaymentLink({
        amountCents, eventTitle: "X",
        hostVenmoHandle: "v", hostCashAppHandle: null, hostZelleInfo: null,
        hostPreferredMethod: "venmo", guestPreferredMethod: null,
      });
      expect(venmo?.link).toBe(
        `venmo://paycharge?txn=pay&recipients=v&amount=${dollars}&note=X`,
      );
    }
  });
});

describe("buildPaymentSmsBody", () => {
  it("builds the full message with one link, items, and receipt URL", () => {
    const body = buildPaymentSmsBody({
      guestFirstName: "Sam",
      amountCents: 1500,
      eventTitle: "Taco Night",
      ...hostAll,
      hostPreferredMethod: "venmo",
      guestPreferredMethod: "cash_app",
      itemLines: ["\u2022 Tacos \u2014 $12.00", "\u2022 Tax, tip & fees \u2014 $3.00"],
      receiptUrl: "https://example.com/receipt",
    });
    expect(body).toBe(
      "Hi Sam! You owe $15.00 for Taco Night.\n\n" +
        "Pay via Cash App:\ncashapp://pay/$hostcash?amount=15.00\n\n" +
        "Your items:\n\u2022 Tacos \u2014 $12.00\n\u2022 Tax, tip & fees \u2014 $3.00\n\n" +
        "View full receipt: https://example.com/receipt",
    );
    // exactly one payment link
    expect(body.match(/Pay via/g)?.length).toBe(1);
    expect(body).not.toContain("venmo.com");
    expect(body).not.toContain("Zelle");
  });

  it("omits empty sections", () => {
    const body = buildPaymentSmsBody({
      guestFirstName: "Sam",
      amountCents: 500,
      eventTitle: "Coffee",
      hostVenmoHandle: null,
      hostCashAppHandle: null,
      hostZelleInfo: null,
      hostPreferredMethod: null,
      guestPreferredMethod: null,
      itemLines: [],
      receiptUrl: null,
    });
    expect(body).toBe("Hi Sam! You owe $5.00 for Coffee.");
  });
});
