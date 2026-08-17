export default function LuxeEvent() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#60A5FA" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#60A5FA", textTransform: "uppercase" }}>
          A — Hero Balance · Event Detail
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Total Hero</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Event total as the dominant number — like boarding pass fare</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Stat Grid</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>2×2 data grid — label above, number below</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Member Rows</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Name + amount + status in one scannable line</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #374151", boxShadow: "0 2vh 6vw rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#0F172A", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#94A3B8" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#94A3B8", borderRadius: "0.2vw" }} />
        </div>

        {/* Dark hero */}
        <div style={{ background: "#0F172A", padding: "4% 6% 4% 6%", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 600, color: "#64748B", letterSpacing: "0.08em", marginBottom: "1.5%" }}>← Dinner at Nobu</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "4.2vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.03em" }}>$183.40</p>
          <div style={{ width: "3vw", height: "0.25vh", background: "#F97316", marginTop: "2%", marginBottom: "2%" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#64748B" }}>4 people · Sat Jun 28 · Nobu Downtown</p>
        </div>

        {/* 2x2 Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", flexShrink: 0 }}>
          <div style={{ padding: "4% 5%", borderRight: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", background: "#FFFFFF" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total Bill</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.1vw", fontWeight: 700, color: "#0F172A", marginTop: "2%" }}>$183.40</p>
          </div>
          <div style={{ padding: "4% 5%", borderBottom: "1px solid #F1F5F9", background: "#FFFFFF" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Per Person</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.1vw", fontWeight: 700, color: "#0F172A", marginTop: "2%" }}>$45.85</p>
          </div>
          <div style={{ padding: "4% 5%", borderRight: "1px solid #F1F5F9", background: "#FFFFFF" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Paid</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.1vw", fontWeight: 700, color: "#16A34A", marginTop: "2%" }}>$91.70</p>
          </div>
          <div style={{ padding: "4% 5%", background: "#FFFFFF" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Still Owed</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.1vw", fontWeight: 700, color: "#DC2626", marginTop: "2%" }}>$91.70</p>
          </div>
        </div>

        {/* Members section */}
        <div style={{ background: "#FFFFFF", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "3% 6% 2% 6%", borderTop: "1px solid #F1F5F9" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.58vw", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Members</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>P</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", color: "#0F172A", fontWeight: 500 }}>Priya</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 600, color: "#0F172A" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", fontWeight: 600, color: "#16A34A" }}>Paid ✓</p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#0369A1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>J</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", color: "#0F172A", fontWeight: 500 }}>James</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 600, color: "#0F172A" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", fontWeight: 500, color: "#94A3B8" }}>Pending</p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 6%" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>Y</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", color: "#0F172A", fontWeight: 500 }}>You</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", fontWeight: 600, color: "#0F172A" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", fontWeight: 600, color: "#16A34A" }}>Paid ✓</p>
            </div>
          </div>

          <div style={{ padding: "3% 6%", marginTop: "auto" }}>
            <div style={{ background: "#1D4ED8", borderRadius: "0.8vw", padding: "4% 0", textAlign: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.82vw", fontWeight: 700, color: "#FFFFFF" }}>Settle Up · $45.85</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Total above the fold — no scrolling to find it</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>2×2 grid replaces tab bar navigation</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Amount + status on same line for each person</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
