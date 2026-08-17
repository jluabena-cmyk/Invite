export default function BoldEvent() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#FB923C" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#FB923C", textTransform: "uppercase" }}>
          B — Ticket Stubs · Event Detail
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Stat Grid</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>4 key numbers in a 2×2 grid — no tab bar required</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Perforation Line</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Dashed divider separates summary from people</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Per-Person Row</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Name + amount + paid/pending, right-aligned</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#F9FAFB", border: "0.5vw solid #E5E7EB", boxShadow: "0 2vh 6vw rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#F9FAFB", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#374151" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#374151", borderRadius: "0.2vw" }} />
        </div>

        {/* Header */}
        <div style={{ background: "#FFFFFF", padding: "4% 5% 3% 5%", borderBottom: "1px solid #F3F4F6", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#94A3B8" }}>← Events</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 800, color: "#111827", marginTop: "1.5%", lineHeight: 1.1, letterSpacing: "-0.02em" }}>Dinner at Nobu</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#9CA3AF", marginTop: "1.5%" }}>Sat Jun 28 · Nobu Downtown · 4 people</p>
        </div>

        {/* 2×2 stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#FFFFFF", flexShrink: 0 }}>
          <div style={{ padding: "4% 5%", borderRight: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 800, color: "#111827", marginTop: "2%", letterSpacing: "-0.02em" }}>$183.40</p>
          </div>
          <div style={{ padding: "4% 5%", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Per Person</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 800, color: "#111827", marginTop: "2%", letterSpacing: "-0.02em" }}>$45.85</p>
          </div>
          <div style={{ padding: "4% 5%", borderRight: "1px solid #F3F4F6" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Paid</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 800, color: "#16A34A", marginTop: "2%", letterSpacing: "-0.02em" }}>$91.70</p>
          </div>
          <div style={{ padding: "4% 5%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Remaining</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 800, color: "#DC2626", marginTop: "2%", letterSpacing: "-0.02em" }}>$91.70</p>
          </div>
        </div>

        {/* Perforation line */}
        <div style={{ padding: "0 4%", flexShrink: 0 }}>
          <div style={{ borderTop: "2px dashed #E5E7EB" }} />
        </div>

        {/* Member rows */}
        <div style={{ background: "#FFFFFF", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "2.5% 5% 1.5% 5%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Members</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>P</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#111827", fontWeight: 600 }}>Priya</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 600, color: "#16A34A" }}>Paid ✓</p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 5%", borderBottom: "1px solid #F9FAFB" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#0369A1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>J</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#111827", fontWeight: 600 }}>James</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8" }}>Pending</p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5% 5%" }}>
            <div style={{ display: "flex", gap: "3%", alignItems: "center" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>Y</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#111827", fontWeight: 600 }}>You</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#374151" }}>$45.85</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", fontWeight: 600, color: "#16A34A" }}>Paid ✓</p>
            </div>
          </div>

          <div style={{ padding: "3% 5%", marginTop: "auto" }}>
            <div style={{ background: "#F97316", borderRadius: "0.8vw", padding: "3.5% 0", textAlign: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#FFFFFF" }}>Remind Pending · 2 people</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Tab bar gone — replaced by 2×2 stat grid</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Dashed perforation divides summary from list</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>CTA targets pending people — more actionable</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
