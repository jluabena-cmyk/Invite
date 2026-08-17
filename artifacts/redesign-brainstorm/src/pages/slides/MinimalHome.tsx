export default function MinimalHome() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#9CA3AF" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#9CA3AF", textTransform: "uppercase" }}>
          C — Statement Rows · Home Screen
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Filter Tabs</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>All / Pending / Settled — filter without navigating</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Date Column</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Left column anchors time — like a bank statement</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#9CA3AF" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Sticky Footer</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Net balance bar always visible at the bottom</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #E2E8F0", boxShadow: "0 2vh 5vw rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#FFFFFF", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0, borderBottom: "1px solid #F1F5F9" }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#374151" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#374151", borderRadius: "0.2vw" }} />
        </div>

        {/* Compact header */}
        <div style={{ background: "#FFFFFF", padding: "3% 5% 0 5%", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.1vw", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>Events</p>
            <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 700, color: "#374151" }}>A</p>
            </div>
          </div>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "2%", marginBottom: "0" }}>
            <div style={{ background: "#111827", borderRadius: "5vw", padding: "1.5% 5%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 700, color: "#FFFFFF" }}>All</p>
            </div>
            <div style={{ padding: "1.5% 5%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 500, color: "#9CA3AF" }}>Pending</p>
            </div>
            <div style={{ padding: "1.5% 5%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 500, color: "#9CA3AF" }}>Settled</p>
            </div>
          </div>
        </div>

        {/* Statement list */}
        <div style={{ flex: 1, background: "#FFFFFF", overflowY: "hidden" }}>
          {/* Section header */}
          <div style={{ padding: "2.5% 5% 1.5% 5%", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.15em", textTransform: "uppercase" }}>This Week</p>
          </div>

          {/* Row 1 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "4%", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8", width: "3.5vw", flexShrink: 0 }}>Jun 28</p>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#111827" }}>Dinner at Nobu</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF", marginTop: "1%" }}>4 people</p>
              </div>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.82vw", fontWeight: 700, color: "#16A34A" }}>+$61</p>
          </div>

          {/* Row 2 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "4%", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8", width: "3.5vw", flexShrink: 0 }}>Jun 27</p>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#111827" }}>Cocktails at Bar Goto</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF", marginTop: "1%" }}>6 people</p>
              </div>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.82vw", fontWeight: 700, color: "#DC2626" }}>-$32</p>
          </div>

          {/* Row 3 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "4%", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8", width: "3.5vw", flexShrink: 0 }}>Jun 29</p>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#111827" }}>Omakase Night</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF", marginTop: "1%" }}>3 people</p>
              </div>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.82vw", fontWeight: 700, color: "#16A34A" }}>+$18</p>
          </div>

          {/* Section header last week */}
          <div style={{ padding: "2% 5% 1.5% 5%", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.15em", textTransform: "uppercase" }}>Last Week</p>
          </div>

          {/* Row 4 — settled, muted */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 5%", opacity: 0.5 }}>
            <div style={{ display: "flex", gap: "4%", alignItems: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8", width: "3.5vw", flexShrink: 0 }}>Jun 22</p>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#6B7280" }}>Brunch Club</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", color: "#9CA3AF", marginTop: "1%" }}>Settled</p>
              </div>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", color: "#9CA3AF" }}>—</p>
          </div>
        </div>

        {/* Sticky footer balance bar */}
        <div style={{ background: "#111827", padding: "3% 5%", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#9CA3AF" }}>Net balance</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95vw", fontWeight: 800, color: "#4ADE80", letterSpacing: "-0.02em" }}>+$47</p>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Filter tabs replace category scrolling</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Date anchors each row — events feel like a timeline</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Sticky footer keeps running balance visible always</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
