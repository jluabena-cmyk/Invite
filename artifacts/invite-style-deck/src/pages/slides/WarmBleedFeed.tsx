const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBleedFeed() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex" style={{ background: "#FAF5EF" }}>

      <div style={{ width: "40%", background: "#C2410C", padding: "5vh 3.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Style D — Full Bleed · Feed
        </span>

        <div>
          <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 1vh 0", letterSpacing: "0.04em" }}>
            TONIGHT · 7:30 PM
          </p>
          <h2 style={{ fontFamily: PJS, fontSize: "4.8vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.0, letterSpacing: "-0.025em", margin: "0 0 0.8vh 0" }}>
            Sushi Roku
          </h2>
          <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "rgba(255,255,255,0.65)", margin: 0 }}>
            West Hollywood
          </p>

          <div className="flex" style={{ gap: "0.5vw", marginTop: "3.5vh" }}>
            <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
            </div>
            <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
            </div>
            <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>S</span>
            </div>
            <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.8)" }}>+2</span>
            </div>
          </div>

          <div style={{ marginTop: "4vh", background: "rgba(255,255,255,0.15)", borderRadius: "1.2vw", padding: "2vh 2.2vw", display: "inline-block" }}>
            <p style={{ fontFamily: PJS, fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: 0, letterSpacing: "-0.025em" }}>$42.50</p>
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.65)", margin: "0.3vh 0 0 0" }}>your share</p>
          </div>
        </div>

        <div style={{ height: "1px", background: "rgba(255,255,255,0.15)" }} />
      </div>

      <div style={{ flex: 1, padding: "5vh 3.5vw", display: "flex", flexDirection: "column" }}>
        <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 3vh 0" }}>
          Coming Up
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2vh", flex: 1 }}>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2vh 2.2vw", border: "1px solid #F5F0EB", boxShadow: "0 2px 12px rgba(28,25,23,0.05)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Nobu Malibu</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#78716C", margin: "0.4vh 0 0 0" }}>Tomorrow · 8:00 pm · Malibu</p>
              </div>
              <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 800, color: "#78716C", margin: 0 }}>$88.00</p>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2vh 2.2vw", border: "1px solid #F5F0EB", boxShadow: "0 2px 12px rgba(28,25,23,0.05)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Bestia</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#78716C", margin: "0.4vh 0 0 0" }}>Sat, Jun 21 · 7:00 pm · Arts District</p>
              </div>
              <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 800, color: "#A8A29E", margin: 0 }}>TBD</p>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2vh 2.2vw", border: "1px solid #F5F0EB", boxShadow: "0 2px 12px rgba(28,25,23,0.05)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Spago Beverly Hills</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#78716C", margin: "0.4vh 0 0 0" }}>Wed, Jun 25 · 8:30 pm · Beverly Hills</p>
              </div>
              <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 800, color: "#A8A29E", margin: 0 }}>TBD</p>
            </div>
          </div>

        </div>

        <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", marginTop: "3vh" }}>
          The active event anchors the left panel — upcoming events stack cleanly on the right.
        </p>
      </div>

    </div>
  );
}
