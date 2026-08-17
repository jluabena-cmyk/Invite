const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBigDetail() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 50% at 50% 20%, rgba(194,65,12,0.05) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 h-full flex" style={{ padding: "5vh 0" }}>

        <div style={{ width: "48%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "0 4vw 0 8vw" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Style F — Big Stat · Detail
          </span>

          <div>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: "0 0 0.5vh 0" }}>Sushi Roku · Tonight</p>
            <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontFamily: PJS, fontSize: "3vw", fontWeight: 800, color: "#1C1917", marginTop: "1.2vw" }}>$</span>
              <span style={{ fontFamily: PJS, fontSize: "13vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.04em", lineHeight: 0.88 }}>112</span>
              <span style={{ fontFamily: PJS, fontSize: "3vw", fontWeight: 800, color: "#78716C", marginTop: "1.2vw" }}>.24</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 400, color: "#78716C", margin: "1.5vh 0 0 0" }}>split 5 ways</p>
            <div style={{ background: "#FFF0E8", borderRadius: "1.2vw", padding: "2vh 2.5vw", marginTop: "3vh", display: "inline-block" }}>
              <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.3vh 0" }}>each person pays</p>
              <p style={{ fontFamily: PJS, fontSize: "3.5vw", fontWeight: 800, color: "#C2410C", margin: 0, letterSpacing: "-0.025em" }}>$22.45</p>
            </div>
          </div>

          <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", lineHeight: 1.4 }}>
            The total dominates. Everything else is context — no need to scan a receipt to understand the situation.
          </p>
        </div>

        <div style={{ width: "1px", background: "#F0EBE4", alignSelf: "stretch" }} />

        <div style={{ flex: 1, padding: "0 5vw 0 4vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2.5vh 0" }}>
            5 items · West Hollywood
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#44403C" }}>Edamame</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$8.00</span>
            </div>
            <div style={{ height: "1px", background: "#F5F0EB" }} />
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#44403C" }}>Dragon Roll (×2)</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$34.00</span>
            </div>
            <div style={{ height: "1px", background: "#F5F0EB" }} />
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#44403C" }}>Wagyu Nigiri</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$28.00</span>
            </div>
            <div style={{ height: "1px", background: "#F5F0EB" }} />
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#44403C" }}>Sake Carafe</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>$22.00</span>
            </div>
            <div style={{ height: "1px", background: "#F5F0EB" }} />
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#A8A29E" }}>Tax + Tip (22%)</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#A8A29E" }}>$20.24</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
