export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[6vh] left-[50%]" style={{ transform: "translateX(-50%)", textAlign: "center" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, letterSpacing: "0.2em", color: "#4B5563", textTransform: "uppercase" }}>
          Which layout fits?
        </p>
      </div>

      <div className="absolute top-[18vh] left-[5vw] right-[5vw] bottom-[12vh]" style={{ display: "flex", gap: "2.5vw" }}>

        {/* Column A — Hero Balance */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh", borderTop: "0.4vh solid #1D4ED8", paddingTop: "2.5vh" }}>
          <div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, color: "#60A5FA", letterSpacing: "0.1em", textTransform: "uppercase" }}>A</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3.2vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.05, marginTop: "0.5vh", letterSpacing: "-0.02em" }}>Hero Balance</p>
          </div>

          {/* Mini phone A */}
          <div style={{ flex: 1, borderRadius: "1.8vw", border: "0.35vw solid #374151", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "40vh", background: "#FFFFFF" }}>
            <div style={{ background: "#0F172A", height: "7%", flexShrink: 0 }} />
            {/* Hero */}
            <div style={{ background: "#0F172A", padding: "5% 7%", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#64748B" }}>your balance</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3.5vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.03em" }}>$47</p>
              <div style={{ width: "2vw", height: "0.2vh", background: "#F97316", margin: "2% 0" }} />
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#60A5FA" }}>owed to you</p>
            </div>
            {/* List rows */}
            <div style={{ flex: 1, padding: "3% 7%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5% 0", borderBottom: "1px solid #F1F5F9" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 600, color: "#111827" }}>Dinner at Nobu</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#16A34A" }}>+$61</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5% 0", borderBottom: "1px solid #F1F5F9" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 600, color: "#111827" }}>Bar Goto</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#DC2626" }}>-$32</p>
              </div>
              <div style={{ marginTop: "auto", marginTop: "6%", background: "#F97316", borderRadius: "0.6vw", padding: "3% 0", textAlign: "center" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", fontWeight: 700, color: "#fff" }}>+ New Event</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Balance front and center</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Events as thin rows only</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Best: money-focused users</p>
          </div>
        </div>

        {/* Column B — Ticket Stubs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh", borderTop: "0.4vh solid #F97316", paddingTop: "2.5vh" }}>
          <div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, color: "#FB923C", letterSpacing: "0.1em", textTransform: "uppercase" }}>B</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3.2vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.05, marginTop: "0.5vh", letterSpacing: "-0.02em" }}>Ticket Stubs</p>
          </div>

          {/* Mini phone B */}
          <div style={{ flex: 1, borderRadius: "1.8vw", border: "0.35vw solid #E5E7EB", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "40vh", background: "#F9FAFB" }}>
            <div style={{ background: "#F9FAFB", height: "7%", borderBottom: "1px solid #F3F4F6", flexShrink: 0 }} />
            <div style={{ background: "#FFFFFF", padding: "4% 6%", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1vw", fontWeight: 800, color: "#111827" }}>Events</p>
              <div style={{ background: "#2563EB", borderRadius: "0.4vw", padding: "1% 3%" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 700, color: "#fff" }}>+ New</p>
              </div>
            </div>
            <div style={{ flex: 1, padding: "4% 5%", display: "flex", flexDirection: "column", gap: "4%" }}>
              <div style={{ background: "#FFFFFF", borderRadius: "0.7vw", overflow: "hidden", display: "flex" }}>
                <div style={{ width: "0.4vw", background: "#2563EB" }} />
                <div style={{ flex: 1, padding: "3.5% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#111827" }}>Dinner at Nobu</p>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF", marginTop: "1%" }}>Sat · 4 people</p>
                  </div>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 800, color: "#16A34A" }}>+$61</p>
                </div>
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: "0.7vw", overflow: "hidden", display: "flex" }}>
                <div style={{ width: "0.4vw", background: "#DC2626" }} />
                <div style={{ flex: 1, padding: "3.5% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#111827" }}>Bar Goto</p>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF", marginTop: "1%" }}>Fri · 6 people</p>
                  </div>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 800, color: "#DC2626" }}>-$32</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Instant status via border color</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Amount visible without tapping</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Best: scan-first power users</p>
          </div>
        </div>

        {/* Column C — Statement Rows */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh", borderTop: "0.4vh solid #6B7280", paddingTop: "2.5vh" }}>
          <div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>C</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3.2vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.05, marginTop: "0.5vh", letterSpacing: "-0.02em" }}>Statement Rows</p>
          </div>

          {/* Mini phone C */}
          <div style={{ flex: 1, borderRadius: "1.8vw", border: "0.35vw solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "40vh", background: "#FFFFFF" }}>
            <div style={{ background: "#FFFFFF", height: "7%", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }} />
            <div style={{ background: "#FFFFFF", padding: "4% 6% 0 6%", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3%" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1vw", fontWeight: 800, color: "#111827" }}>Events</p>
              </div>
              <div style={{ display: "flex", gap: "2%" }}>
                <div style={{ background: "#111827", borderRadius: "5vw", padding: "1% 4%" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 700, color: "#fff" }}>All</p>
                </div>
                <div style={{ padding: "1% 4%" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF" }}>Pending</p>
                </div>
                <div style={{ padding: "1% 4%" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF" }}>Settled</p>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ background: "#F9FAFB", padding: "2% 6%", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.48vw", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", textTransform: "uppercase" }}>This Week</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3% 6%", borderBottom: "1px solid #F9FAFB" }}>
                <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#94A3B8" }}>Jun 28</p>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.7vw", fontWeight: 600, color: "#111827" }}>Dinner at Nobu</p>
                </div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.7vw", fontWeight: 700, color: "#16A34A" }}>+$61</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3% 6%" }}>
                <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#94A3B8" }}>Jun 27</p>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.7vw", fontWeight: 600, color: "#111827" }}>Bar Goto</p>
                </div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.7vw", fontWeight: 700, color: "#DC2626" }}>-$32</p>
              </div>
            </div>
            <div style={{ background: "#111827", padding: "3% 6%", display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF" }}>Net balance</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 800, color: "#4ADE80" }}>+$47</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Familiar bank-app feel</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Filter tabs + balance footer</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9vw", fontWeight: 300, color: "#6B7280" }}>Best: all audiences</p>
          </div>
        </div>
      </div>
    </div>
  );
}
