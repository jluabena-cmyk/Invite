const SG = "'Space Grotesk', sans-serif";

export default function DirectionCMockup() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F1A" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "6vh 8vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#A3E635", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Direction C — UI Example
          </span>
          <span style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#475569" }}>
            Events tab · Event card
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center" style={{ gap: "3vw" }}>

          <div
            style={{
              background: "#141726",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              width: "28vw",
              border: "1px solid #1E2438",
              boxShadow: "0 0 40px rgba(139,92,246,0.08)",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "2.5vh" }}>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "0.6vw", background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: SG, fontSize: "1.6vw" }}>🍣</span>
              </div>
              <div style={{ background: "rgba(163,230,53,0.12)", border: "1px solid rgba(163,230,53,0.25)", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
                <span style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#A3E635" }}>Tonight</span>
              </div>
            </div>

            <p style={{ fontFamily: SG, fontSize: "2.2vw", fontWeight: 700, color: "#F8FAFC", margin: 0, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              Sushi Roku
            </p>
            <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: "0.6vh 0 0 0" }}>
              West Hollywood · 7:30 pm
            </p>

            <div style={{ height: "1px", background: "#1E2438", margin: "2.2vh 0" }} />

            <div className="flex items-center justify-between">
              <div className="flex">
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #141726" }}>
                  <span style={{ fontFamily: SG, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#6D28D9", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #141726", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: SG, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#4C1D95", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #141726", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: SG, fontSize: "1.2vw", fontWeight: 700, color: "#C4B5FD" }}>S</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#1E2438", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #141726", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: SG, fontSize: "1.2vw", fontWeight: 400, color: "#64748B" }}>+2</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: SG, fontSize: "2vw", fontWeight: 700, color: "#A3E635", margin: 0, letterSpacing: "-0.02em" }}>$42.50</p>
                <p style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 400, color: "#475569", margin: 0 }}>your share</p>
              </div>
            </div>

            <div style={{ height: "1px", background: "#1E2438", margin: "2.2vh 0" }} />

            <div style={{ background: "#8B5CF6", borderRadius: "0.7vw", padding: "1.5vh 0", textAlign: "center" }}>
              <span style={{ fontFamily: SG, fontSize: "1.6vw", fontWeight: 700, color: "#FFFFFF" }}>Pay via Venmo</span>
            </div>
          </div>

          <div
            style={{
              background: "#141726",
              borderRadius: "1.2vw",
              padding: "2.2vh 2.2vw",
              width: "22vw",
              border: "1px solid #1E2438",
            }}
          >
            <p style={{ fontFamily: SG, fontSize: "1.3vw", fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2vh 0" }}>
              Upcoming
            </p>

            <div style={{ borderBottom: "1px solid #1E2438", paddingBottom: "1.8vh", marginBottom: "1.8vh" }}>
              <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Nobu Malibu</p>
              <p style={{ fontFamily: SG, fontSize: "1.4vw", fontWeight: 400, color: "#64748B", margin: "0.4vh 0 0 0" }}>Sat, Jun 21 · 8pm</p>
            </div>

            <div>
              <p style={{ fontFamily: SG, fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Bestia</p>
              <p style={{ fontFamily: SG, fontSize: "1.4vw", fontWeight: 400, color: "#64748B", margin: "0.4vh 0 0 0" }}>Sun, Jun 22 · 7pm</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center" style={{ marginTop: "3vh" }}>
          <p style={{ fontFamily: SG, fontSize: "1.5vw", fontWeight: 400, color: "#334155", textAlign: "center" }}>
            Dark surfaces, violet and lime, sharp type — stands out in notifications at 2am.
          </p>
        </div>
      </div>
    </div>
  );
}
