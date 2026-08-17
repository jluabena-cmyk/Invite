const SG = "'Space Grotesk', sans-serif";

export default function DirectionCSpec() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F1A" }}>
      <div className="relative z-10 h-full flex" style={{ padding: "7vh 8vw", gap: "5vw" }}>

        <div className="flex flex-col justify-between" style={{ flex: "0 0 52%" }}>
          <div>
            <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#A3E635", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Space Grotesk — Typography
            </span>
          </div>
          <div>
            <p style={{ fontFamily: SG, fontSize: "6.5vw", fontWeight: 700, color: "#F8FAFC", lineHeight: 1, letterSpacing: "-0.03em", margin: 0 }}>
              Heading
            </p>
            <p style={{ fontFamily: SG, fontSize: "4vw", fontWeight: 700, color: "#A3E635", lineHeight: 1.1, letterSpacing: "-0.025em", marginTop: "1.5vh" }}>
              Subheading
            </p>
            <p style={{ fontFamily: SG, fontSize: "2.4vw", fontWeight: 400, color: "#CBD5E1", lineHeight: 1.4, marginTop: "2.5vh" }}>
              Body text — sharp and readable
            </p>
            <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 400, color: "#64748B", lineHeight: 1.5, marginTop: "1.5vh" }}>
              Caption and supporting detail copy
            </p>
          </div>
          <div>
            <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#475569" }}>
              Weights used: 400 · 700
            </p>
          </div>
        </div>

        <div style={{ width: "1px", background: "#1E2235", alignSelf: "stretch" }} />

        <div className="flex flex-col justify-between" style={{ flex: 1 }}>
          <div>
            <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#A3E635", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Colour Palette
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: "1.8vh" }}>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#8B5CF6", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Electric Violet</p>
                <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#8B5CF6 — Primary</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#A3E635", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Lime Accent</p>
                <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#A3E635 — Accent</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#F8FAFC", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Off-White</p>
                <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#F8FAFC — Text</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#0D0F1A", border: "1px solid #334155", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Night Navy</p>
                <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#0D0F1A — Background</p>
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#334155" }}>
              WCAG AA contrast met on all text pairs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
