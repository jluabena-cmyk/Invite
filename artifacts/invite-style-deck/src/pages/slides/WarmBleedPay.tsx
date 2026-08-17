const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBleedPay() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex" style={{ background: "#FAF5EF" }}>

      <div style={{ width: "42%", padding: "5vh 3.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#A8A29E", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5vh", display: "block" }}>
          Style D — Full Bleed · Pay
        </span>
        <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: "0 0 0.8vh 0" }}>Sushi Roku · Tonight</p>
        <p style={{ fontFamily: PJS, fontSize: "6vw", fontWeight: 800, color: "#1C1917", lineHeight: 1, letterSpacing: "-0.03em", margin: "0 0 1.2vh 0" }}>$112</p>
        <p style={{ fontFamily: PJS, fontSize: "2.2vw", fontWeight: 400, color: "#78716C", margin: "0 0 4vh 0" }}>total · 5 people</p>

        <div style={{ marginBottom: "3vh" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "1vh" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#22C55E" }}>$67.35 collected</span>
            <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#A8A29E" }}>$44.89 due</span>
          </div>
          <div style={{ height: "1vh", background: "#F5F0EB", borderRadius: "100vw", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "60%", background: "#22C55E", borderRadius: "100vw" }} />
          </div>
        </div>

        <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", lineHeight: 1.4 }}>
          Amount + progress live on the left. Individual statuses on the right.
        </p>
      </div>

      <div style={{ width: "1px", background: "#F0EBE4", alignSelf: "stretch", margin: "5vh 0" }} />

      <div style={{ flex: 1, padding: "5vh 3.5vw", display: "flex", flexDirection: "column", justifyContent: "center", gap: "2vh" }}>

        <div className="flex items-center justify-between" style={{ padding: "1.8vh 0", borderBottom: "1px solid #F5F0EB" }}>
          <div className="flex items-center" style={{ gap: "1.2vw" }}>
            <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>J</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>Jordan M.</span>
          </div>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ padding: "1.8vh 0", borderBottom: "1px solid #F5F0EB" }}>
          <div className="flex items-center" style={{ gap: "1.2vw" }}>
            <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>M</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>Morgan K.</span>
          </div>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ padding: "1.8vh 0", borderBottom: "1px solid #F5F0EB" }}>
          <div className="flex items-center" style={{ gap: "1.2vw" }}>
            <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>S</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>Sam P.</span>
          </div>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
            <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ padding: "1.8vh 0", borderBottom: "1px solid #F5F0EB" }}>
          <div className="flex items-center" style={{ gap: "1.2vw" }}>
            <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>K</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>Casey L.</span>
          </div>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
            <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ padding: "1.8vh 0" }}>
          <div className="flex items-center" style={{ gap: "1.2vw" }}>
            <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C" }}>Y</span>
            </div>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 600, color: "#1C1917" }}>You</span>
          </div>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 700, color: "#C2410C" }}>$22.44</span>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1.2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
