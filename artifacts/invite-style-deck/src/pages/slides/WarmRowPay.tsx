const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmRowPay() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 8vw" }}>

        <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "3.5vh", display: "block" }}>
          Style E — Row &amp; Rule · Pay
        </span>

        <div style={{ height: "2px", background: "#1C1917", marginBottom: "3vh" }} />

        <div className="flex items-center justify-between" style={{ marginBottom: "3vh" }}>
          <div>
            <h2 style={{ fontFamily: PJS, fontSize: "3vw", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.025em", margin: "0 0 0.4vh 0" }}>Sushi Roku</h2>
            <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0 }}>Tonight · $112.24 total · 5 people</p>
          </div>
          <div>
            <p style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 600, color: "#22C55E", margin: "0 0 0.8vh 0", textAlign: "right" }}>$67.35 collected</p>
            <div style={{ width: "18vw", height: "0.8vh", background: "#F0EBE4", borderRadius: "100vw", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "#22C55E", borderRadius: "100vw" }} />
            </div>
          </div>
        </div>

        <div style={{ height: "1px", background: "#E7E5E4" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          <div className="flex items-center justify-between" style={{ padding: "2.2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <div className="flex items-center" style={{ gap: "1.8vw" }}>
              <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>J</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 600, color: "#1C1917" }}>Jordan M.</span>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
              <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#22C55E" }}>Paid</span>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ padding: "2.2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <div className="flex items-center" style={{ gap: "1.8vw" }}>
              <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>M</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 600, color: "#1C1917" }}>Morgan K.</span>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
              <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#22C55E" }}>Paid</span>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ padding: "2.2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <div className="flex items-center" style={{ gap: "1.8vw" }}>
              <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>S</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 600, color: "#1C1917" }}>Sam P.</span>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
              <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#C2410C" }} />
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#C2410C" }}>Pending</span>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ padding: "2.2vh 0", borderBottom: "1px solid #F0EBE4" }}>
            <div className="flex items-center" style={{ gap: "1.8vw" }}>
              <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#fff" }}>K</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 600, color: "#1C1917" }}>Casey L.</span>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
              <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#C2410C" }} />
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#C2410C" }}>Pending</span>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ padding: "2.2vh 0" }}>
            <div className="flex items-center" style={{ gap: "1.8vw" }}>
              <div style={{ width: "3vw", height: "3vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C" }}>Y</span>
              </div>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 600, color: "#1C1917" }}>You</span>
            </div>
            <div className="flex items-center" style={{ gap: "2vw" }}>
              <span style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 700, color: "#C2410C" }}>$22.44</span>
              <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 600, color: "#22C55E" }}>Paid</span>
            </div>
          </div>

        </div>

        <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#C4B5A5", marginTop: "1vh" }}>
          The dot + label replaces badges — faster to scan, less visual noise, more like a to-do list.
        </p>

      </div>
    </div>
  );
}
