const SG = "'Space Grotesk', sans-serif";

export default function Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0F1117" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(99,102,241,0.07) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: "6vh 8vw" }}>

        <div style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#6B7280", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            invite — Style Directions
          </span>
          <h2 style={{ fontFamily: SG, fontSize: "3.8vw", fontWeight: 700, color: "#F9FAFB", lineHeight: 1.1, letterSpacing: "-0.025em", marginTop: "1.5vh" }}>
            Three directions. One decision.
          </h2>
        </div>

        <div className="flex flex-1" style={{ gap: "2.5vw", alignItems: "stretch" }}>

          <div
            style={{
              flex: 1,
              background: "#F7F8FC",
              borderRadius: "1.2vw",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.3vw", fontWeight: 700, color: "#4338CA", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                A
              </span>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2.4vw", fontWeight: 800, color: "#0F172A", lineHeight: 1.1, marginTop: "1.5vh", letterSpacing: "-0.02em" }}>
                Minimal
              </h3>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "2.4vw", fontWeight: 800, color: "#0F172A", lineHeight: 1.1, marginTop: 0, letterSpacing: "-0.02em" }}>
                &amp; Modern
              </h3>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.6vw", fontWeight: 400, color: "#64748B", marginTop: "2vh", lineHeight: 1.4 }}>
                Clarity, space, precision
              </p>
            </div>
            <div className="flex" style={{ gap: "0.8vw", marginTop: "2vh" }}>
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#4338CA" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#818CF8" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#E0E7FF" }} />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: "#FAF5EF",
              borderRadius: "1.2vw",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                B
              </span>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "2.4vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, marginTop: "1.5vh", letterSpacing: "-0.015em" }}>
                Warm
              </h3>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "2.4vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, marginTop: 0, letterSpacing: "-0.015em" }}>
                Social
              </h3>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.6vw", fontWeight: 400, color: "#78716C", marginTop: "2vh", lineHeight: 1.4 }}>
                Friendly, personal, community
              </p>
            </div>
            <div className="flex" style={{ gap: "0.8vw", marginTop: "2vh" }}>
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#C2410C" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#7C3AED" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#FB923C" }} />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: "#141726",
              borderRadius: "1.2vw",
              border: "1px solid #1E2438",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#A3E635", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                C
              </span>
              <h3 style={{ fontFamily: SG, fontSize: "2.4vw", fontWeight: 700, color: "#F8FAFC", lineHeight: 1.1, marginTop: "1.5vh", letterSpacing: "-0.025em" }}>
                Bold Night
              </h3>
              <h3 style={{ fontFamily: SG, fontSize: "2.4vw", fontWeight: 700, color: "#A3E635", lineHeight: 1.1, marginTop: 0, letterSpacing: "-0.025em" }}>
                Out
              </h3>
              <p style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 400, color: "#64748B", marginTop: "2vh", lineHeight: 1.4 }}>
                Premium, high-contrast, late-night
              </p>
            </div>
            <div className="flex" style={{ gap: "0.8vw", marginTop: "2vh" }}>
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#8B5CF6" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#A3E635" }} />
              <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", background: "#F8FAFC" }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: "3vh" }}>
          <p style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 400, color: "#374151" }}>
            All three pass WCAG AA contrast · All fonts available via Google Fonts · Tokens ready to export
          </p>
        </div>
      </div>
    </div>
  );
}
