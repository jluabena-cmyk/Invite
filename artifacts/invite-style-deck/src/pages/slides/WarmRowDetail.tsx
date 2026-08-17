const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmRowDetail() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 8vw" }}>

        <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "3.5vh", display: "block" }}>
          Style E — Row &amp; Rule · Detail
        </span>

        <div style={{ height: "2px", background: "#1C1917", marginBottom: "3vh" }} />

        <div className="flex items-start justify-between" style={{ marginBottom: "3vh" }}>
          <div>
            <h2 style={{ fontFamily: PJS, fontSize: "3.5vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.025em", margin: "0 0 0.5vh 0" }}>Sushi Roku</h2>
            <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#78716C", margin: 0 }}>West Hollywood · Tonight, 7:30 pm · 5 guests</p>
          </div>
          <div className="flex" style={{ gap: "0.5vw" }}>
            <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 700, color: "#fff" }}>J</span>
            </div>
            <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 700, color: "#fff" }}>M</span>
            </div>
            <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 700, color: "#fff" }}>S</span>
            </div>
            <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 700, color: "#fff" }}>K</span>
            </div>
            <div style={{ width: "2.4vw", height: "2.4vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "-0.4vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1vw", fontWeight: 400, color: "#C2410C" }}>+1</span>
            </div>
          </div>
        </div>

        <div style={{ height: "1px", background: "#E7E5E4", marginBottom: "0" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 400, color: "#1C1917" }}>Edamame</span>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 700, color: "#1C1917" }}>$8.00</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 400, color: "#1C1917" }}>Dragon Roll (×2)</span>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 700, color: "#1C1917" }}>$34.00</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 400, color: "#1C1917" }}>Wagyu Nigiri</span>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 700, color: "#1C1917" }}>$28.00</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 400, color: "#1C1917" }}>Sake Carafe</span>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 700, color: "#1C1917" }}>$22.00</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "2px solid #1C1917" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 400, color: "#78716C" }}>Tax + Tip (22%)</span>
            <span style={{ fontFamily: PJS, fontSize: "1.9vw", fontWeight: 700, color: "#78716C" }}>$20.24</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#1C1917" }}>Total</span>
            <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>$112.24</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "2vh 0" }}>
            <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#C2410C" }}>Your share</span>
            <span style={{ fontFamily: PJS, fontSize: "2.6vw", fontWeight: 800, color: "#C2410C", letterSpacing: "-0.025em" }}>$22.45</span>
          </div>
        </div>

        <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", marginTop: "1vh" }}>
          The double rule marks the tax line. Your share in terracotta closes the list — the eye lands there last.
        </p>

      </div>
    </div>
  );
}
