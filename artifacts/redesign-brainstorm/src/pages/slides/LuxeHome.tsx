export default function LuxeHome() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#60A5FA" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#60A5FA", textTransform: "uppercase" }}>
          A — Hero Balance · Home Screen
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Balance Hero</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Dark header, huge number — the answer before you scroll</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>No Cards</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Events as thin rows with dividers — like a ledger</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Full-width CTA</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Sticky at bottom, strong orange — unmissable</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #374151", boxShadow: "0 2vh 6vw rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#0F172A", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#94A3B8" }}>9:41</p>
          <div style={{ display: "flex", gap: "0.3vw", alignItems: "center" }}>
            <div style={{ width: "1.2vw", height: "0.5vh", background: "#94A3B8", borderRadius: "0.2vw" }} />
          </div>
        </div>

        {/* Hero zone — dark navy, big number */}
        <div style={{ background: "#0F172A", padding: "6% 6% 5% 6%", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.7vw", fontWeight: 400, color: "#64748B", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2%" }}>your balance</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "5.5vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.04em" }}>$47</p>
          <div style={{ width: "3vw", height: "0.25vh", background: "#F97316", marginTop: "2%", marginBottom: "2%" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68vw", fontWeight: 500, color: "#60A5FA" }}>owed to you · from Priya, James +1</p>
        </div>

        {/* White content area */}
        <div style={{ background: "#FFFFFF", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Section label */}
          <div style={{ padding: "4% 6% 2% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Upcoming</p>
          </div>

          {/* Event row 1 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 600, color: "#0F172A", lineHeight: 1.2 }}>Dinner at Nobu</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#94A3B8", marginTop: "1.5%" }}>Sat · 8 PM · 4 people</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.85vw", fontWeight: 700, color: "#16A34A" }}>+$61</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", color: "#CBD5E1" }}>›</p>
            </div>
          </div>

          {/* Event row 2 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 600, color: "#0F172A", lineHeight: 1.2 }}>Cocktails at Bar Goto</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#94A3B8", marginTop: "1.5%" }}>Fri · 10 PM · 6 people</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.85vw", fontWeight: 700, color: "#DC2626" }}>-$32</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", color: "#CBD5E1" }}>›</p>
            </div>
          </div>

          {/* Event row 3 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4% 6%", borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 600, color: "#0F172A", lineHeight: 1.2 }}>Omakase Night</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#94A3B8", marginTop: "1.5%" }}>Sun · 7:30 PM · 3 people</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.85vw", fontWeight: 700, color: "#16A34A" }}>+$18</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", color: "#CBD5E1" }}>›</p>
            </div>
          </div>

          {/* CTA */}
          <div style={{ padding: "4% 6%", marginTop: "auto" }}>
            <div style={{ background: "#F97316", borderRadius: "0.8vw", padding: "4% 0", textAlign: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>+ New Event</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Balance replaces the greeting as hero</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Cards eliminated — rows with dividers only</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Amount visible at a glance, no tap required</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
