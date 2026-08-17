const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmSocialDetail() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 40% 50% at 5% 100%, rgba(124,58,237,0.05) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 7vw 4vh 7vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "3.5vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Layout 2 — Event Detail
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>
            Warm Social · Plus Jakarta Sans
          </span>
        </div>

        <div className="flex flex-1" style={{ gap: "4vw", alignItems: "flex-start" }}>

          <div
            style={{
              flex: "0 0 50%",
              background: "#FFFFFF",
              borderRadius: "1.6vw",
              padding: "3vh 2.5vw",
              border: "1px solid #F5F0EB",
              boxShadow: "0 4px 32px rgba(28,25,23,0.07)",
            }}
          >
            <div style={{ marginBottom: "2.5vh" }}>
              <p style={{ fontFamily: PJS, fontSize: "2.4vw", fontWeight: 800, color: "#1C1917", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Sushi Roku</p>
              <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.5vh 0 0 0" }}>West Hollywood · Tonight, 7:30 pm</p>
            </div>

            <div className="flex items-center" style={{ gap: "0.6vw", marginBottom: "2.5vh" }}>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
              </div>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
              </div>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>S</span>
              </div>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>K</span>
              </div>
              <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 400, color: "#C2410C" }}>+1</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 400, color: "#A8A29E", marginLeft: "0.5vw" }}>5 guests</span>
            </div>

            <div style={{ height: "1px", background: "#F5F0EB", marginBottom: "2.2vh" }} />

            <p style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 1.8vh 0" }}>
              Bill Breakdown
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh", marginBottom: "2.2vh" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#1C1917" }}>Edamame</span>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#1C1917" }}>$8.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#1C1917" }}>Dragon Roll (×2)</span>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#1C1917" }}>$34.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#1C1917" }}>Wagyu Nigiri</span>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#1C1917" }}>$28.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#1C1917" }}>Sake Carafe</span>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#1C1917" }}>$22.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 400, color: "#78716C" }}>Tax + Tip (22%)</span>
                <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#78716C" }}>$20.24</span>
              </div>
            </div>

            <div style={{ height: "1px", background: "#F5F0EB", marginBottom: "2.2vh" }} />

            <div className="flex items-center justify-between" style={{ marginBottom: "1.5vh" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#1C1917" }}>Total</span>
              <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.015em" }}>$112.24</span>
            </div>

            <div
              style={{
                background: "#FFF0E8",
                borderRadius: "1.2vw",
                padding: "1.8vh 2vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#C2410C" }}>Your share</span>
              <span style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 800, color: "#C2410C", letterSpacing: "-0.02em" }}>$22.45</span>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "2vh" }}>
            <h2 style={{ fontFamily: PJS, fontSize: "3.2vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 3vh 0" }}>
              Receipt in full
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Line-item clarity</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Every item from the receipt is visible — no black-box totals</p>
              </div>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Your share highlight</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Warm coral callout separates your amount from the group total</p>
              </div>
              <div>
                <p style={{ fontFamily: PJS, fontSize: "1.6vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.5vh 0" }}>Guest row</p>
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Colour-coded avatars make it easy to track who's on the bill</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
