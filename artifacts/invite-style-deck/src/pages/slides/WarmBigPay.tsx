const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmBigPay() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(194,65,12,0.04) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 h-full flex flex-col items-center" style={{ padding: "5vh 8vw" }}>

        <div className="flex items-center justify-between w-full" style={{ marginBottom: "3vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Style F — Big Stat · Pay
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>
            Sushi Roku · Tonight
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "5vh" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "0.5vw" }}>
            <span style={{ fontFamily: PJS, fontSize: "14vw", fontWeight: 800, color: "#22C55E", lineHeight: 0.9, letterSpacing: "-0.05em" }}>3</span>
            <span style={{ fontFamily: PJS, fontSize: "5vw", fontWeight: 400, color: "#A8A29E", letterSpacing: "-0.02em" }}>/5</span>
          </div>
          <p style={{ fontFamily: PJS, fontSize: "2.6vw", fontWeight: 400, color: "#78716C", marginTop: "1.5vh" }}>
            people have paid
          </p>
          <p style={{ fontFamily: PJS, fontSize: "1.8vw", fontWeight: 400, color: "#A8A29E", marginTop: "0.8vh" }}>
            $67.35 collected · $44.89 still owed
          </p>
        </div>

        <div style={{ width: "60%", height: "1.2vh", background: "#F0EBE4", borderRadius: "100vw", overflow: "hidden", marginBottom: "5vh" }}>
          <div style={{ height: "100%", width: "60%", background: "#22C55E", borderRadius: "100vw" }} />
        </div>

        <div className="flex w-full" style={{ gap: "1.5vw", justifyContent: "center" }}>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2.2vh 2vw", border: "1px solid #F5F0EB", textAlign: "center", flex: 1 }}>
            <div style={{ width: "3.2vw", height: "3.2vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2vh auto" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#fff" }}>J</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#1C1917", margin: "0 0 0.3vh 0" }}>Jordan</p>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.3vh 0.8vw", display: "inline-block" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2.2vh 2vw", border: "1px solid #F5F0EB", textAlign: "center", flex: 1 }}>
            <div style={{ width: "3.2vw", height: "3.2vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2vh auto" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#fff" }}>M</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#1C1917", margin: "0 0 0.3vh 0" }}>Morgan</p>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.3vh 0.8vw", display: "inline-block" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2.2vh 2vw", border: "1px solid #F5F0EB", textAlign: "center", flex: 1 }}>
            <div style={{ width: "3.2vw", height: "3.2vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2vh auto" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#fff" }}>S</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#1C1917", margin: "0 0 0.3vh 0" }}>Sam</p>
            <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.3vh 0.8vw", display: "inline-block" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "1.2vw", padding: "2.2vh 2vw", border: "1px solid #F5F0EB", textAlign: "center", flex: 1 }}>
            <div style={{ width: "3.2vw", height: "3.2vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2vh auto" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#fff" }}>K</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#1C1917", margin: "0 0 0.3vh 0" }}>Casey</p>
            <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.3vh 0.8vw", display: "inline-block" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
            </div>
          </div>

          <div style={{ background: "#FFF0E8", borderRadius: "1.2vw", padding: "2.2vh 2vw", border: "1px solid #FDDCB5", textAlign: "center", flex: 1 }}>
            <div style={{ width: "3.2vw", height: "3.2vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2vh auto" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 700, color: "#C2410C" }}>Y</span>
            </div>
            <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#C2410C", margin: "0 0 0.3vh 0" }}>You</p>
            <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.3vh 0.8vw", display: "inline-block" }}>
              <span style={{ fontFamily: PJS, fontSize: "1.1vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
