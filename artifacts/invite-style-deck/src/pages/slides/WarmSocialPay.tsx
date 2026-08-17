const PJS = "'Plus Jakarta Sans', sans-serif";

export default function WarmSocialPay() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#FAF5EF" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 110%, rgba(124,58,237,0.06) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: "5vh 7vw 4vh 7vw" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: "3.5vh" }}>
          <span style={{ fontFamily: PJS, fontSize: "1.3vw", fontWeight: 700, color: "#C2410C", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Layout 3 — Split Summary
          </span>
          <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>
            Warm Social · Plus Jakarta Sans
          </span>
        </div>

        <div className="flex flex-1" style={{ gap: "4vw", alignItems: "center" }}>

          <div style={{ flex: "0 0 36%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontFamily: PJS, fontSize: "3.6vw", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, letterSpacing: "-0.025em", margin: "0 0 1.5vh 0" }}>
              Who owes what
            </h2>
            <p style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 400, color: "#78716C", lineHeight: 1.45, margin: "0 0 3.5vh 0" }}>
              The split summary makes it clear at a glance who's paid and who still owes.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
              <div className="flex items-start" style={{ gap: "1.2vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#22C55E", marginTop: "0.6vh", flexShrink: 0 }} />
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Green badge confirms payment so the host isn't chasing people</p>
              </div>
              <div className="flex items-start" style={{ gap: "1.2vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#FB923C", marginTop: "0.6vh", flexShrink: 0 }} />
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Coral pending badge nudges without nagging</p>
              </div>
              <div className="flex items-start" style={{ gap: "1.2vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: "#7C3AED", marginTop: "0.6vh", flexShrink: 0 }} />
                <p style={{ fontFamily: PJS, fontSize: "1.5vw", fontWeight: 400, color: "#78716C", margin: 0, lineHeight: 1.4 }}>Progress bar shows collected vs. total at a glance</p>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "1.6vw",
                padding: "3.2vh 2.8vw",
                border: "1px solid #F5F0EB",
                boxShadow: "0 4px 32px rgba(28,25,23,0.07)",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: "3vh" }}>
                <div>
                  <p style={{ fontFamily: PJS, fontSize: "2vw", fontWeight: 800, color: "#1C1917", margin: 0, letterSpacing: "-0.015em" }}>Sushi Roku</p>
                  <p style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#78716C", margin: "0.3vh 0 0 0" }}>Tonight · 5 people · $112.24 total</p>
                </div>
              </div>

              <div style={{ marginBottom: "2.5vh" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "1vh" }}>
                  <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 600, color: "#22C55E" }}>$67.35 collected</span>
                  <span style={{ fontFamily: PJS, fontSize: "1.4vw", fontWeight: 400, color: "#A8A29E" }}>$44.89 pending</span>
                </div>
                <div style={{ height: "0.8vh", background: "#F5F0EB", borderRadius: "100vw", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, #22C55E 0%, #86EFAC 100%)", borderRadius: "100vw" }} />
                </div>
              </div>

              <div style={{ height: "1px", background: "#F5F0EB", marginBottom: "2vh" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "1.6vh" }}>

                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: "1.2vw" }}>
                    <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>J</span>
                    </div>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 600, color: "#1C1917" }}>Jordan M.</span>
                  </div>
                  <div className="flex items-center" style={{ gap: "1.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
                    <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1vw" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: "1.2vw" }}>
                    <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FB923C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>M</span>
                    </div>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 600, color: "#1C1917" }}>Morgan K.</span>
                  </div>
                  <div className="flex items-center" style={{ gap: "1.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
                    <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1vw" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: "1.2vw" }}>
                    <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>S</span>
                    </div>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 600, color: "#1C1917" }}>Sam P.</span>
                  </div>
                  <div className="flex items-center" style={{ gap: "1.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
                    <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.4vh 1vw" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: "1.2vw" }}>
                    <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#fff" }}>K</span>
                    </div>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 600, color: "#1C1917" }}>Casey L.</span>
                  </div>
                  <div className="flex items-center" style={{ gap: "1.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 700, color: "#1C1917" }}>$22.45</span>
                    <div style={{ background: "#FFF0E8", borderRadius: "100vw", padding: "0.4vh 1vw" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C" }}>Pending</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: "1px", background: "#F5F0EB" }} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: "1.2vw" }}>
                    <div style={{ width: "2.8vw", height: "2.8vw", borderRadius: "50%", background: "#FEE2D5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#C2410C" }}>Y</span>
                    </div>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 600, color: "#1C1917" }}>You</span>
                  </div>
                  <div className="flex items-center" style={{ gap: "1.5vw" }}>
                    <span style={{ fontFamily: PJS, fontSize: "1.7vw", fontWeight: 700, color: "#C2410C" }}>$22.44</span>
                    <div style={{ background: "#DCFCE7", borderRadius: "100vw", padding: "0.4vh 1vw" }}>
                      <span style={{ fontFamily: PJS, fontSize: "1.2vw", fontWeight: 700, color: "#16A34A" }}>Paid</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
