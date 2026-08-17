export default function MinimalPalette() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[6vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "3.5vw", height: "0.35vh", background: "#9CA3AF" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#9CA3AF", textTransform: "uppercase" }}>
          Direction C — Concept
        </p>
      </div>

      <div className="absolute top-[15vh] left-[6vw]" style={{ maxWidth: "38vw" }}>
        <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "6vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
          Statement Rows
        </h2>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 300, color: "#9CA3AF", marginTop: "1vh", lineHeight: 1.5 }}>
          The pattern your eye already knows from bank apps — date, name, amount in clean rows with thin dividers. Zero learning curve.
        </p>
        <div style={{ marginTop: "3vh", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Inspired by: bank statements, expense reports, Apple Wallet</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Filter tabs (All / Pending / Settled) replace category navigation</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#9CA3AF", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Footer summary bar — balance always visible without scrolling</p>
          </div>
        </div>
      </div>

      {/* Statement rows anatomy */}
      <div className="absolute right-[6vw] top-[14vh]" style={{ width: "36vw", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.8vw", fontWeight: 400, color: "#4B5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>Row anatomy</p>

        {/* Filter tabs diagram */}
        <div style={{ background: "#1A1F2B", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1vw" }}>
          <div style={{ background: "#374151", borderRadius: "0.5vw", padding: "0.8vh 1.5vw" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.5vw", fontWeight: 700, color: "#F0EDE8" }}>All</p>
          </div>
          <div style={{ padding: "0.8vh 1.5vw" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.5vw", color: "#6B7280" }}>Pending</p>
          </div>
          <div style={{ padding: "0.8vh 1.5vw" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.5vw", color: "#6B7280" }}>Settled</p>
          </div>
        </div>

        {/* Section header */}
        <div style={{ padding: "0.5vh 0" }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.4vw", fontWeight: 700, color: "#4B5563", letterSpacing: "0.15em", textTransform: "uppercase" }}>This Week</p>
        </div>

        {/* Statement row 1 */}
        <div style={{ background: "#1A1F2B", borderRadius: "0.8vw", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5vh 1.5vw", borderBottom: "1px solid #374151" }}>
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.5vw", color: "#6B7280", width: "5vw" }}>Jun 28</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 600, color: "#F0EDE8" }}>Dinner at Nobu</p>
          </div>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, color: "#4ADE80" }}>+$61</p>
        </div>

        {/* Statement row 2 */}
        <div style={{ background: "#1A1F2B", borderRadius: "0.8vw", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5vh 1.5vw" }}>
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.5vw", color: "#6B7280", width: "5vw" }}>Jun 27</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 600, color: "#F0EDE8" }}>Cocktails at Bar Goto</p>
          </div>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, color: "#F87171" }}>-$32</p>
        </div>

        {/* Footer balance bar */}
        <div style={{ background: "#0F172A", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #374151" }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.6vw", color: "#94A3B8" }}>Net balance</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 800, color: "#4ADE80", letterSpacing: "-0.02em" }}>+$47</p>
        </div>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw]" style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.2em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Familiar · Fast · Zero learning curve
        </p>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
      </div>
    </div>
  );
}
