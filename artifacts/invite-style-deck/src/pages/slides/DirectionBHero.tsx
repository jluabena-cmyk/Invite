const PJS = "'Plus Jakarta Sans', sans-serif";

export default function DirectionBHero() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 50% at 90% 80%, rgba(194,65,12,0.06) 0%, transparent 65%)" }}
      />

      <div className="absolute" style={{ left: "-2vw", top: "50%", transform: "translateY(-50%)" }}>
        <span style={{ fontFamily: PJS, fontSize: "32vw", fontWeight: 800, color: "#FDE8D8", lineHeight: 1, userSelect: "none" }}>
          B
        </span>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between items-end" style={{ padding: "7vh 8vw" }}>
        <div className="flex items-center" style={{ gap: "1.2vw" }}>
          <div style={{ height: "1px", width: "3vw", background: "#FDBA74" }} />
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Direction B
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontFamily: PJS, fontSize: "5.5vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
            Warm
          </h2>
          <h2 style={{ fontFamily: PJS, fontSize: "5.5vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
            Social
          </h2>
          <p style={{ fontFamily: PJS, fontSize: "2.1vw", fontWeight: 400, color: "#78716C", marginTop: "3.5vh", maxWidth: "40vw", lineHeight: 1.45 }}>
            Feels like dinner with friends, not a spreadsheet.
          </p>
          <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#A8A29E", marginTop: "1.5vh", maxWidth: "40vw", lineHeight: 1.5 }}>
            Cream background, coral and terracotta accents, rounded type. Feels like Airbnb or BeReal.
          </p>
        </div>

        <div className="flex" style={{ gap: "1.2vw" }}>
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#C2410C" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#7C3AED" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#FB923C" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#1C1917" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#FAF5EF", border: "1px solid #E7E5E4" }} />
        </div>
      </div>
    </div>
  );
}
