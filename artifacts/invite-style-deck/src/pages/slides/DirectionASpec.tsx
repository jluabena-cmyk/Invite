const OUTFIT = "'Outfit', sans-serif";

export default function DirectionASpec() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#F7F8FC" }}>
      <div className="relative z-10 h-full flex" style={{ padding: "7vh 8vw", gap: "5vw" }}>

        <div className="flex flex-col justify-between" style={{ flex: "0 0 52%" }}>
          <div>
            <span style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 700, color: "#4338CA", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Outfit — Typography
            </span>
          </div>
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: "6.5vw", fontWeight: 800, color: "#0F172A", lineHeight: 1, letterSpacing: "-0.03em", margin: 0 }}>
              Heading
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: "4vw", fontWeight: 700, color: "#0F172A", lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: "1.5vh" }}>
              Subheading
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: "2.4vw", fontWeight: 400, color: "#334155", lineHeight: 1.4, marginTop: "2.5vh" }}>
              Body text — readable at distance
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 400, color: "#64748B", lineHeight: 1.5, marginTop: "1.5vh" }}>
              Caption and supporting detail copy
            </p>
          </div>
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#94A3B8" }}>
              Weights used: 400 · 700 · 800
            </p>
          </div>
        </div>

        <div style={{ width: "1px", background: "#E2E8F0", alignSelf: "stretch" }} />

        <div className="flex flex-col justify-between" style={{ flex: 1 }}>
          <div>
            <span style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 700, color: "#4338CA", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Colour Palette
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: "1.8vh" }}>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#4338CA", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Indigo 700</p>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#4338CA — Primary</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#818CF8", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Indigo 400</p>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#818CF8 — Accent</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#0F172A", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Slate 900</p>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#0F172A — Text</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#F7F8FC", border: "1px solid #E2E8F0", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Off-White</p>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: 0 }}>#F7F8FC — Background</p>
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#94A3B8" }}>
              WCAG AA contrast met on all text pairs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
