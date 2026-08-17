const PJS = "'Plus Jakarta Sans', sans-serif";

export default function DirectionBMockup() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "6vh 8vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Direction B — UI Example
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#A8A29E" }}>
            Events tab · Event card
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center" style={{ gap: "3vw" }}>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "1.6vw",
              padding: "3vh 2.5vw",
              width: "28vw",
              boxShadow: "0 4px 32px rgba(28,25,23,0.08)",
              border: "1px solid #F5F0EB",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "2.5vh" }}>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "0.8vw", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw" }}>🍣</span>
              </div>
              <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C" }}>Tonight</span>
              </div>
            </div>

            <p style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
              Sushi Roku
            </p>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: "0.6vh 0 0 0" }}>
              West Hollywood · 7:30 pm
            </p>

            <div style={{ height: "1px", background: "#F5F0EB", margin: "2.2vh 0" }} />

            <div className="flex items-center justify-between">
              <div className="flex" style={{ gap: "0" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                  <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>S</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 400, color: "#C2410C" }}>+2</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>$42.50</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E", margin: 0 }}>your share</p>
              </div>
            </div>

            <div style={{ height: "1px", background: "#F5F0EB", margin: "2.2vh 0" }} />

            <div style={{ background: "#C2410C", borderRadius: "100vw", padding: "1.5vh 0", textAlign: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 700, color: "#FFFFFF" }}>Pay via Venmo</span>
            </div>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "1.6vw",
              padding: "2.2vh 2.2vw",
              width: "22vw",
              boxShadow: "0 4px 20px rgba(28,25,23,0.05)",
              border: "1px solid #F5F0EB",
            }}
          >
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2vh 0" }}>
              Upcoming
            </p>

            <div style={{ borderBottom: "1px solid #F5F0EB", paddingBottom: "1.8vh", marginBottom: "1.8vh" }}>
              <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Nobu Malibu</p>
              <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.4vh 0 0 0" }}>Sat, Jun 21 · 8pm</p>
            </div>

            <div>
              <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917", margin: 0 }}>Bestia</p>
              <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.4vh 0 0 0" }}>Sun, Jun 22 · 7pm</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center" style={{ marginTop: "3vh" }}>
          <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#C4B5A5", textAlign: "center" }}>
            Rounded corners, warm coral, cream backgrounds — feels personal, not transactional.
          </p>
        </div>
      </div>
    </div>
  );
}
