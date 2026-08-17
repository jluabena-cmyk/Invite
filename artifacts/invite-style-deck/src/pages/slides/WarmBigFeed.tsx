const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBigFeed() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 30%, rgba(194,65,12,0.06) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 h-full flex flex-col items-center" style={{ padding: "5vh 8vw" }}>

        <div className="flex items-center justify-between w-full" style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Style F — Big Stat · Feed
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>
            Warm Social · Plus Jakarta Sans
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "6vh" }}>
          <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#78716C", margin: "0 0 0.5vh 0", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            This Week
          </p>
          <p style={{ fontFamily: PJS, fontSize: "18vw", fontWeight: 800, color: "#1C1917", lineHeight: 0.85, letterSpacing: "-0.05em", margin: 0 }}>
            3
          </p>
          <p style={{ fontFamily: PJS, fontSize: "2.8vw", fontWeight: 400, color: "#78716C", marginTop: "1.5vh", letterSpacing: "-0.01em" }}>
            events coming up
          </p>
        </div>

        <div className="flex w-full" style={{ gap: "2vw" }}>

          <div style={{ flex: 1, background: "#C2410C", borderRadius: "1.4vw", padding: "2.5vh 2.2vw" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 600, color: "rgba(255,255,255,0.65)", margin: "0 0 0.6vh 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tonight</p>
            <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 0.3vh 0", letterSpacing: "-0.015em" }}>Sushi Roku</p>
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", margin: 0 }}>7:30 pm · W. Hollywood</p>
          </div>

          <div style={{ flex: 1, background: "#FFFFFF", borderRadius: "1.4vw", padding: "2.5vh 2.2vw", border: "1px solid #F5F0EB" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 600, color: "#A8A29E", margin: "0 0 0.6vh 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tomorrow</p>
            <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: "0 0 0.3vh 0", letterSpacing: "-0.015em" }}>Nobu Malibu</p>
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#78716C", margin: 0 }}>8:00 pm · Malibu</p>
          </div>

          <div style={{ flex: 1, background: "#FFFFFF", borderRadius: "1.4vw", padding: "2.5vh 2.2vw", border: "1px solid #F5F0EB" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 600, color: "#A8A29E", margin: "0 0 0.6vh 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Sat, Jun 21</p>
            <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: "0 0 0.3vh 0", letterSpacing: "-0.015em" }}>Bestia</p>
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#78716C", margin: 0 }}>7:00 pm · Arts District</p>
          </div>

        </div>

      </div>
    </div>
  );
}
