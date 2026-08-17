const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmRowFeed() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 8vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Style E — Row &amp; Rule · Feed
          </span>
          <div className="flex" style={{ gap: "1vw" }}>
            <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.5vh 1.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C" }}>All</span>
            </div>
            <div style={{ background: "transparent", borderRadius: "100vw", padding: "0.5vh 1.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E" }}>Upcoming</span>
            </div>
            <div style={{ background: "transparent", borderRadius: "100vw", padding: "0.5vh 1.5vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E" }}>Past</span>
            </div>
          </div>
        </div>

        <div style={{ height: "2px", background: "#E7E5E4", marginBottom: "0" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          <div style={{ padding: "2.5vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 1.8vh 0" }}>
              Tonight
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: "2vw" }}>
                <div style={{ width: "0.7vw", height: "0.7vw", borderRadius: "50%", background: "#C2410C", flexShrink: 0 }} />
                <div>
                  <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>Sushi Roku</span>
                  <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#78716C", marginLeft: "1.5vw" }}>7:30 pm · West Hollywood · 5 people</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#C2410C", margin: 0, letterSpacing: "-0.02em" }}>$42.50</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E", margin: 0 }}>your share</p>
              </div>
            </div>
          </div>

          <div style={{ padding: "2.5vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#78716C", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 1.8vh 0" }}>
              Tomorrow
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: "2vw" }}>
                <div style={{ width: "0.7vw", height: "0.7vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0 }} />
                <div>
                  <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>Nobu Malibu</span>
                  <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#78716C", marginLeft: "1.5vw" }}>8:00 pm · Malibu · 3 people</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.02em" }}>$88.00</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E", margin: 0 }}>your share</p>
              </div>
            </div>
          </div>

          <div style={{ padding: "2.5vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#78716C", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 1.8vh 0" }}>
              Sat, Jun 21
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: "2vw" }}>
                <div style={{ width: "0.7vw", height: "0.7vw", borderRadius: "50%", background: "#A8A29E", flexShrink: 0 }} />
                <div>
                  <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>Bestia</span>
                  <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#78716C", marginLeft: "1.5vw" }}>7:00 pm · Arts District · 6 people</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#A8A29E", margin: 0, letterSpacing: "-0.02em" }}>TBD</p>
                <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E", margin: 0 }}>not set yet</p>
              </div>
            </div>
          </div>

        </div>

        <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", marginTop: "2vh" }}>
          No cards — horizontal rules create rhythm without visual weight. The dot colour signals urgency at a glance.
        </p>
      </div>
    </div>
  );
}
