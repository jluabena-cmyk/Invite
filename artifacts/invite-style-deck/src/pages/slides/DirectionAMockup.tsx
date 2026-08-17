const OUTFIT = "'Outfit', sans-serif";

export default function DirectionAMockup() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#F7F8FC" }}>
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "6vh 8vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "4vh" }}>
          <span style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 700, color: "#4338CA", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Direction A — UI Example
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#94A3B8" }}>
            Events tab · Event card
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center" style={{ gap: "3vw" }}>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              width: "28vw",
              boxShadow: "0 2px 24px rgba(15,23,42,0.07)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "2.5vh" }}>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "0.6vw", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: OUTFIT, fontSize: "1.6vw" }}>🍣</span>
              </div>
              <div style={{ background: "#EEF2FF", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
                <span style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 700, color: "#4338CA" }}>Tonight</span>
              </div>
            </div>

            <p style={{ fontFamily: OUTFIT, fontSize: "2.2vw", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Sushi Roku
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#64748B", margin: "0.6vh 0 0 0" }}>
              West Hollywood · 7:30 pm
            </p>

            <div style={{ height: "1px", background: "#F1F5F9", margin: "2.2vh 0" }} />

            <div className="flex items-center justify-between">
              <div className="flex" style={{ gap: "-0.6vw" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#4338CA", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#818CF8", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#C7D2FE", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: "1.2vw", fontWeight: 700, color: "#4338CA" }}>S</span>
                </div>
                <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", marginLeft: "-0.6vw" }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: "1.2vw", fontWeight: 400, color: "#64748B" }}>+2</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: OUTFIT, fontSize: "2vw", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>$42.50</p>
                <p style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 400, color: "#94A3B8", margin: 0 }}>your share</p>
              </div>
            </div>

            <div style={{ height: "1px", background: "#F1F5F9", margin: "2.2vh 0" }} />

            <div style={{ background: "#4338CA", borderRadius: "0.7vw", padding: "1.5vh 0", textAlign: "center" }}>
              <span style={{ fontFamily: OUTFIT, fontSize: "1.6vw", fontWeight: 700, color: "#FFFFFF" }}>Pay via Venmo</span>
            </div>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "1.2vw",
              padding: "2.2vh 2.2vw",
              width: "22vw",
              boxShadow: "0 2px 16px rgba(15,23,42,0.05)",
              border: "1px solid #E2E8F0",
            }}
          >
            <p style={{ fontFamily: OUTFIT, fontSize: "1.3vw", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2vh 0" }}>
              Upcoming
            </p>

            <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: "1.8vh", marginBottom: "1.8vh" }}>
              <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Nobu Malibu</p>
              <p style={{ fontFamily: OUTFIT, fontSize: "1.4vw", fontWeight: 400, color: "#64748B", margin: "0.4vh 0 0 0" }}>Sat, Jun 21 · 8pm</p>
            </div>

            <div>
              <p style={{ fontFamily: OUTFIT, fontSize: "1.8vw", fontWeight: 700, color: "#0F172A", margin: 0 }}>Bestia</p>
              <p style={{ fontFamily: OUTFIT, fontSize: "1.4vw", fontWeight: 400, color: "#64748B", margin: "0.4vh 0 0 0" }}>Sun, Jun 22 · 7pm</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center" style={{ marginTop: "3vh" }}>
          <p style={{ fontFamily: OUTFIT, fontSize: "1.5vw", fontWeight: 400, color: "#CBD5E1", textAlign: "center" }}>
            Clean lines, indigo accents, generous white space — feels focused, not cluttered.
          </p>
        </div>
      </div>
    </div>
  );
}
