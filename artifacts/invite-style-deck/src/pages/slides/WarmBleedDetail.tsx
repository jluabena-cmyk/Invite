const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBleedDetail() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>

      <div style={{ height: "28vh", background: "#C2410C", padding: "4vh 7vw 0 7vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Style D — Full Bleed · Detail
        </span>

        <div className="flex items-end justify-between" style={{ paddingBottom: "3vh" }}>
          <div>
            <h2 style={{ fontFamily: PJS, fontSize: "4vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.0, letterSpacing: "-0.025em", margin: "0 0 0.6vh 0" }}>
              Sushi Roku
            </h2>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", margin: 0 }}>
              West Hollywood · Tonight, 7:30 pm
            </p>
          </div>

          <div className="flex items-center" style={{ gap: "0.5vw" }}>
            <div style={{ width: "2.6vw", height: "2.6vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>J</span>
            </div>
            <div style={{ width: "2.6vw", height: "2.6vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>M</span>
            </div>
            <div style={{ width: "2.6vw", height: "2.6vw", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#fff" }}>S</span>
            </div>
            <div style={{ width: "2.6vw", height: "2.6vw", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.8)" }}>+2</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.65)", marginLeft: "0.8vw" }}>5 guests</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "4vh 7vw 3vh 7vw", flex: 1 }}>
        <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2.5vh 0" }}>
          Bill Breakdown
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", marginBottom: "2.5vh" }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#1C1917" }}>Edamame</span>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$8.00</span>
          </div>
          <div style={{ height: "1px", background: "#F5F0EB" }} />
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#1C1917" }}>Dragon Roll (×2)</span>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$34.00</span>
          </div>
          <div style={{ height: "1px", background: "#F5F0EB" }} />
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#1C1917" }}>Wagyu Nigiri</span>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$28.00</span>
          </div>
          <div style={{ height: "1px", background: "#F5F0EB" }} />
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#1C1917" }}>Sake Carafe</span>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$22.00</span>
          </div>
          <div style={{ height: "1px", background: "#F5F0EB" }} />
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#78716C" }}>Tax + Tip (22%)</span>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#78716C" }}>$20.24</span>
          </div>
        </div>

        <div style={{ height: "1px", background: "#E7E5E4", marginBottom: "2.5vh" }} />

        <div className="flex items-center justify-between" style={{ marginBottom: "2vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>Total</span>
          <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>$112.24</span>
        </div>

        <div style={{ background: "#FFF0E8", borderRadius: "1.2vw", padding: "2vh 2.5vw", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#C2410C" }}>Your share</span>
          <span style={{ fontFamily: PJS, fontSize: "2.6vw", fontWeight: 800, color: "#C2410C", letterSpacing: "-0.025em" }}>$22.45</span>
        </div>
      </div>

    </div>
  );
}
