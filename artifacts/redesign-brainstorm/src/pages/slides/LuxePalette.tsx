export default function LuxePalette() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[6vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "3.5vw", height: "0.35vh", background: "#1D4ED8" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#60A5FA", textTransform: "uppercase" }}>
          Direction A — Concept
        </p>
      </div>

      <div className="absolute top-[15vh] left-[6vw]" style={{ maxWidth: "38vw" }}>
        <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "6vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
          Hero Balance
        </h2>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 300, color: "#9CA3AF", marginTop: "1vh", lineHeight: 1.5 }}>
          Lead with the number that matters most — your balance — in a dominant hero zone. Everything else is secondary.
        </p>
        <div style={{ marginTop: "3vh", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Inspired by: boarding pass, bank balance screen, stock ticker</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>The big number earns its size — it's the answer before you even ask</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Event list becomes a simple menu — no decoration needed</p>
          </div>
        </div>
      </div>

      {/* Layout anatomy diagram */}
      <div className="absolute right-[6vw] top-[12vh]" style={{ width: "34vw", height: "72vh", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
        {/* Phone wireframe */}
        <div style={{ flex: 1, border: "0.4vw solid #374151", borderRadius: "2.5vw", overflow: "hidden", display: "flex", flexDirection: "column", background: "#1A1F2B" }}>
          {/* Hero zone */}
          <div style={{ background: "#0F172A", flex: "0 0 38%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.8vh", borderBottom: "2px solid #374151", position: "relative" }}>
            <div style={{ position: "absolute", top: "1.5vh", right: "1.5vw", background: "rgba(96,165,250,0.15)", border: "1px solid #60A5FA", borderRadius: "0.5vw", padding: "0.5vh 1vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.6vw", fontWeight: 600, color: "#60A5FA" }}>Hero zone</p>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.4vw", color: "#6B7280" }}>your balance</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "7vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.03em" }}>$47</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.4vw", color: "#6B7280" }}>owed to you</p>
          </div>
          {/* List zone */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2vh 2vw" }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)", background: "rgba(96,165,250,0.15)", border: "1px solid #60A5FA", borderRadius: "0.5vw", padding: "0.5vh 1vw", whiteSpace: "nowrap" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.6vw", fontWeight: 600, color: "#60A5FA" }}>Thin rows</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5vh 0", borderBottom: "1px solid #374151" }}>
              <div style={{ width: "40%", height: "1.5vh", background: "#374151", borderRadius: "0.3vw" }} />
              <div style={{ width: "15%", height: "1.5vh", background: "#1D4ED8", borderRadius: "0.3vw" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5vh 0", borderBottom: "1px solid #374151" }}>
              <div style={{ width: "35%", height: "1.5vh", background: "#374151", borderRadius: "0.3vw" }} />
              <div style={{ width: "15%", height: "1.5vh", background: "#374151", borderRadius: "0.3vw" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5vh 0" }}>
              <div style={{ width: "45%", height: "1.5vh", background: "#374151", borderRadius: "0.3vw" }} />
              <div style={{ width: "15%", height: "1.5vh", background: "#374151", borderRadius: "0.3vw" }} />
            </div>
            <div style={{ marginTop: "auto", height: "4vh", background: "#F97316", borderRadius: "0.8vw" }} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw]" style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.2em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Purposeful · Confident · Information-first
        </p>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
      </div>
    </div>
  );
}
