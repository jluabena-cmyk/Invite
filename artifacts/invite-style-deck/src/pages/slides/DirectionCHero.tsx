const SG = "'Space Grotesk', sans-serif";

export default function DirectionCHero() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F1A" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 55% at 100% 100%, rgba(124,58,237,0.12) 0%, transparent 60%)" }}
      />

      <div className="absolute" style={{ right: "-4vw", top: "50%", transform: "translateY(-50%)" }}>
        <span style={{ fontFamily: SG, fontSize: "32vw", fontWeight: 700, color: "rgba(163,230,53,0.05)", lineHeight: 1, userSelect: "none" }}>
          C
        </span>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: "7vh 8vw" }}>
        <div className="flex items-center" style={{ gap: "1.2vw" }}>
          <span style={{ fontFamily: SG, fontSize: "1.4vw", fontWeight: 700, color: "#A3E635", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Direction C
          </span>
          <div style={{ height: "1px", width: "3vw", background: "rgba(163,230,53,0.3)" }} />
        </div>

        <div>
          <h2 style={{ fontFamily: SG, fontSize: "5.5vw", fontWeight: 700, color: "#F8FAFC", lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Bold Night
          </h2>
          <h2 style={{ fontFamily: SG, fontSize: "5.5vw", fontWeight: 700, color: "#A3E635", lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Out
          </h2>
          <p style={{ fontFamily: SG, fontSize: "2.1vw", fontWeight: 400, color: "#CBD5E1", marginTop: "3.5vh", maxWidth: "46vw", lineHeight: 1.45 }}>
            Premium energy for the late-night crowd.
          </p>
          <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 400, color: "#64748B", marginTop: "1.5vh", maxWidth: "46vw", lineHeight: 1.5 }}>
            Near-black navy, electric violet and lime accents, high-contrast geometric type. Feels like Monzo dark mode or Vercel.
          </p>
        </div>

        <div className="flex" style={{ gap: "1.2vw" }}>
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#8B5CF6" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#A3E635" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#141726" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#F8FAFC" }} />
          <div style={{ width: "4vw", height: "4vw", borderRadius: "50%", background: "#0D0F1A", border: "1px solid #334155" }} />
        </div>
      </div>
    </div>
  );
}
