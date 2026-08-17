const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmSocialFeed() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 45% 55% at 100% 0%, rgba(194,65,12,0.05) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 7vw 4vh 7vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "3.5vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Layout 1 — Events Feed
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>
            Warm Social · Plus Jakarta Sans
          </span>
        </div>

        <div className="flex flex-1" style={{ gap: "4vw", alignItems: "stretch" }}>

          <div style={{ flex: "0 0 56%", display: "flex", flexDirection: "column", gap: "2.2vh" }}>

            <div style={{ marginBottom: "0.5vh" }}>
              <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                Tonight, Jun 14
              </p>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "1.4vw",
                padding: "2.2vh 2vw",
                border: "1px solid #F5F0EB",
                boxShadow: "0 2px 16px rgba(28,25,23,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Sushi Roku</p>
                  <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.3vh 0 0 0" }}>West Hollywood · 7:30 pm</p>
                </div>
                <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.6vh 1.4vw" }}>
                  <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 800, color: "#C2410C", margin: 0 }}>$42.50</p>
                </div>
              </div>
              <div style={{ marginTop: "1.8vh" }} className="flex items-center justify-between">
                <div className="flex">
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>J</span>
                  </div>
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>M</span>
                  </div>
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>S</span>
                  </div>
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 400, color: "#C2410C" }}>+2</span>
                  </div>
                </div>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E" }}>5 people</span>
              </div>
            </div>

            <div style={{ marginBottom: "0.5vh", marginTop: "0.5vh" }}>
              <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                Tomorrow, Jun 15
              </p>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "1.4vw",
                padding: "2.2vh 2vw",
                border: "1px solid #F5F0EB",
                boxShadow: "0 2px 16px rgba(28,25,23,0.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Nobu Malibu</p>
                  <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.3vh 0 0 0" }}>Malibu · 8:00 pm</p>
                </div>
                <div style={{ background: "#F5F0EB", borderRadius: "100vw", padding: "0.6vh 1.4vw" }}>
                  <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 800, color: "#78716C", margin: 0 }}>$88.00</p>
                </div>
              </div>
              <div style={{ marginTop: "1.8vh" }} className="flex items-center justify-between">
                <div className="flex">
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>A</span>
                  </div>
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>R</span>
                  </div>
                  <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>T</span>
                  </div>
                </div>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E" }}>3 people</span>
              </div>
            </div>

            <div style={{ marginBottom: "0.5vh", marginTop: "0.5vh" }}>
              <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                Sat, Jun 21
              </p>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "1.4vw",
                padding: "2.2vh 2vw",
                border: "1px solid #F5F0EB",
                boxShadow: "0 2px 16px rgba(28,25,23,0.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Bestia</p>
                  <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.3vh 0 0 0" }}>Arts District · 7:00 pm</p>
                </div>
                <div style={{ background: "#F5F0EB", borderRadius: "100vw", padding: "0.6vh 1.4vw" }}>
                  <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 800, color: "#78716C", margin: 0 }}>TBD</p>
                </div>
              </div>
            </div>

          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontFamily: PJS, fontSize: "3.2vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 3vh 0" }}>
              Events at a glance
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Date grouping</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Events cluster by date so you always know what's coming next</p>
              </div>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Share pill</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Your split amount is the most important number — shown first, largest</p>
              </div>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Guest stack</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Overlapping avatars make the social context immediate and familiar</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
