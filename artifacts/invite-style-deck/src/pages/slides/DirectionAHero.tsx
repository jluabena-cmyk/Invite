const OUTFIT = "'Outfit', sans-serif";

export default function DirectionAHero() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#F7F8FC" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 95% 10%, rgba(99,102,241,0.07) 0%, transparent 65%)" }}
      />

      <div className="absolute" style={{ right: "5vw", top: "50%", transform: "translateY(-50%)" }}>
        <span style={{ fontFamily: OUTFIT, fontSize: "32vw", fontWeight: 800, color: "#EEF2FF", lineHeight: 1, userSelect: "none" }}>
          A
        </span>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: "7vh 8vw" }}>
        <div className="flex items-center" style={{ gap: "1.2vw" }}>
          <span style={{ fontFamily: OUTFIT, fontSize: "1.4vw", fontWeight: 700, color: "#4338CA", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Direction A
          </span>
          <div style={{ height: "1px", width: "3vw", background: "#C7D2FE" }} />
        </div>

        <div>
          <h2 style={{ fontFamily: OUTFIT, fontSize: "5.5vw", fontWeight: 800, color: "#0F172A", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
            Minimal
          </h2>
          <h2 style={{ fontFamily: OUTFIT, fontSize: "5.5vw", fontWeight: 800, color: "#0F172A", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
            &amp; Modern
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: "2.1vw", fontWeight: 400, color: "#475569", marginTop: "3.5vh", maxWidth: "42vw", lineHeight: 1.45 }}>
            Clarity over noise. Every element earns its place.
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 400, color: "#94A3B8", marginTop: "1.5vh", maxWidth: "44vw", lineHeight: 1.5 }}>
            Light backgrounds, indigo-slate palette, generous whitespace. Feels like Linear or Mercury.
          </p>
        </div>

        <div className="flex" style={{ gap: "1.2vw" }}>
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#4338CA" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#818CF8" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#E0E7FF" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#0F172A" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#F7F8FC", border: "1px solid #E2E8F0" }} />
        </div>
      </div>
    </div>
  );
}
