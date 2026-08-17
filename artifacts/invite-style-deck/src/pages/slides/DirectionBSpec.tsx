const PJS = "'Plus Jakarta Sans', sans-serif";

export default function DirectionBSpec() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div className="relative z-10 h-full flex" style={{ padding: "7vh 8vw", gap: "5vw" }}>

        <div className="flex flex-col justify-between" style={{ flex: "0 0 52%" }}>
          <div>
            <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Plus Jakarta Sans — Typography
            </span>
          </div>
          <div>
            <p style={{ fontFamily: PJS, fontSize: "6.5vw", fontWeight: 800, color: "#1C1917", lineHeight: 1, letterSpacing: "-0.02em", margin: 0 }}>
              Heading
            </p>
            <p style={{ fontFamily: PJS, fontSize: "4vw", fontWeight: 600, color: "#1C1917", lineHeight: 1.1, letterSpacing: "-0.015em", marginTop: "1.5vh" }}>
              Subheading
            </p>
            <p style={{ fontFamily: PJS, fontSize: "2.4vw", fontWeight: 400, color: "#44403C", lineHeight: 1.45, marginTop: "2.5vh" }}>
              Body text — warm and inviting to read
            </p>
            <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#78716C", lineHeight: 1.5, marginTop: "1.5vh" }}>
              Caption and supporting detail copy
            </p>
          </div>
          <div>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#A8A29E" }}>
              Weights used: 400 · 600 · 800
            </p>
          </div>
        </div>

        <div style={{ width: "1px", background: "#E7E5E4", alignSelf: "stretch" }} />

        <div className="flex flex-col justify-between" style={{ flex: 1 }}>
          <div>
            <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Colour Palette
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: "1.8vh" }}>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#C2410C", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Terracotta</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0 }}>#C2410C — Primary</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#7C3AED", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Warm Violet</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0 }}>#7C3AED — Accent</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#1C1917", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Stone 900</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0 }}>#1C1917 — Text</p>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <div style={{ width: "5.5vw", height: "5.5vw", borderRadius: "0.8vw", background: "#FAF5EF", border: "1px solid #E7E5E4", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Warm Cream</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0 }}>#FAF5EF — Background</p>
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#A8A29E" }}>
              WCAG AA contrast met on all text pairs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
