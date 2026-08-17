const SG = "'Space Grotesk', sans-serif";

export default function Intro() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0F1117" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 60% at 8% 50%, rgba(99,102,241,0.10) 0%, transparent 70%)" }}
      />

      <div
        className="absolute top-0 right-0 h-full flex flex-col"
        style={{ width: "3px", gap: 0 }}
      >
        <div style={{ flex: 1, background: "#4338CA" }} />
        <div style={{ flex: 1, background: "#C2410C" }} />
        <div style={{ flex: 1, background: "#A3E635" }} />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: "7vh 8vw" }}>
        <div>
          <span style={{ fontFamily: SG, fontSize: "1.7vw", fontWeight: 400, color: "#6366F1", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            invite
          </span>
        </div>

        <div>
          <p style={{ fontFamily: SG, fontSize: "2vw", fontWeight: 400, color: "#6B7280", marginBottom: "2.5vh" }}>
            Visual identity exploration
          </p>
          <h1 style={{ fontFamily: SG, fontSize: "8.5vw", fontWeight: 700, color: "#F9FAFB", lineHeight: 0.92, letterSpacing: "-0.03em", margin: 0 }}>
            3 Style
          </h1>
          <h1 style={{ fontFamily: SG, fontSize: "8.5vw", fontWeight: 700, color: "#F9FAFB", lineHeight: 0.92, letterSpacing: "-0.03em", margin: 0 }}>
            Directions
          </h1>
        </div>

        <div className="flex" style={{ gap: "4vw" }}>
          <div className="flex items-center" style={{ gap: "1vw" }}>
            <span style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#818CF8" }}>A</span>
            <span style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 400, color: "#6B7280" }}>Minimal &amp; Modern</span>
          </div>
          <div className="flex items-center" style={{ gap: "1vw" }}>
            <span style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#FB923C" }}>B</span>
            <span style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 400, color: "#6B7280" }}>Warm Social</span>
          </div>
          <div className="flex items-center" style={{ gap: "1vw" }}>
            <span style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#A3E635" }}>C</span>
            <span style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 400, color: "#6B7280" }}>Bold Night Out</span>
          </div>
        </div>
      </div>
    </div>
  );
}
