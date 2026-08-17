export default function MinimalEvent() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#9CA3AF" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#9CA3AF", textTransform: "uppercase" }}>
          C — Statement Rows · Event Detail
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Stat Strip</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>3 key numbers in a horizontal band — above the fold</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Status Dots</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Filled = paid, empty = pending — at a glance</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Ledger Rows</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Members as statement entries — name, amount, status</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #E2E8F0", boxShadow: "0 2vh 5vw rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#FFFFFF", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0, borderBottom: "1px solid #F1F5F9" }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#374151" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#374151", borderRadius: "0.2vw" }} />
        </div>

        {/* Compact header */}
        <div style={{ background: "#FFFFFF", padding: "3.5% 5% 3% 5%", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#94A3B8" }}>← Events</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.15vw", fontWeight: 800, color: "#111827", marginTop: "1.5%", lineHeight: 1.1, letterSpacing: "-0.02em" }}>Dinner at Nobu</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#9CA3AF", marginTop: "1.5%" }}>Sat Jun 28 · Nobu Downtown · 4 people</p>
        </div>

        {/* Horizontal stat strip */}
        <div style={{ background: "#F9FAFB", borderBottom: "1px solid #F1F5F9", display: "flex", flexShrink: 0 }}>
          <div style={{ flex: 1, padding: "4% 5%", borderRight: "1px solid #F1F5F9" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1vw", fontWeight: 800, color: "#111827", marginTop: "2%", letterSpacing: "-0.02em" }}>$183.40</p>
          </div>
          <div style={{ flex: 1, padding: "4% 5%", borderRight: "1px solid #F1F5F9" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Per person</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1vw", fontWeight: 800, color: "#111827", marginTop: "2%", letterSpacing: "-0.02em" }}>$45.85</p>
          </div>
          <div style={{ flex: 1, padding: "4% 5%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Paid</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1vw", fontWeight: 800, color: "#16A34A", marginTop: "2%" }}>2 of 4</p>
          </div>
        </div>

        {/* Member ledger rows */}
        <div style={{ flex: 1, background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "2.5% 5% 1.5% 5%", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.15em", textTransform: "uppercase" }}>Members</p>
          </div>

          {/* Member row 1 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1vw", height: "1vw", borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#111827", fontWeight: 500 }}>Priya Martinez</p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#16A34A", fontWeight: 600 }}>paid</p>
            </div>
          </div>

          {/* Member row 2 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1vw", height: "1vw", borderRadius: "50%", border: "1.5px solid #D1D5DB", background: "#FFFFFF", flexShrink: 0 }} />
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#6B7280", fontWeight: 500 }}>James K.</p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF" }}>pending</p>
            </div>
          </div>

          {/* Member row 3 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1vw", height: "1vw", borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#111827", fontWeight: 500 }}>You</p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#16A34A", fontWeight: 600 }}>paid</p>
            </div>
          </div>

          {/* Member row 4 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1vw", height: "1vw", borderRadius: "50%", border: "1.5px solid #D1D5DB", background: "#FFFFFF", flexShrink: 0 }} />
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#6B7280", fontWeight: 500 }}>Sara T.</p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF" }}>pending</p>
            </div>
          </div>

          {/* CTA */}
          <div style={{ padding: "3% 5% 3% 5%", marginTop: "auto", display: "flex", flexDirection: "column", gap: "2.5%" }}>
            <div style={{ background: "#111827", borderRadius: "0.8vw", padding: "4% 0", textAlign: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#FFFFFF" }}>Settle Up · $45.85</p>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#9CA3AF", textAlign: "center" }}>Add Expense</p>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Horizontal strip shows 3 stats without tabs</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Dot = paid / ring = pending — no text needed</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Ledger rows — same pattern as home screen</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
