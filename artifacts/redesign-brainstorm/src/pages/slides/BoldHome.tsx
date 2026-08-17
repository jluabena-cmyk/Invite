export default function BoldHome() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#FB923C" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#FB923C", textTransform: "uppercase" }}>
          B — Ticket Stubs · Home Screen
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Border = Status</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Blue left border = owed to you, red = you owe, gray = settled</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Amount Right</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Always right-aligned, colored, no tap needed</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#FB923C" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Compact Header</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>No greeting hero — straight into the list</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#F9FAFB", border: "0.5vw solid #E5E7EB", boxShadow: "0 2vh 6vw rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#F9FAFB", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#374151" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#374151", borderRadius: "0.2vw" }} />
        </div>

        {/* Compact header */}
        <div style={{ background: "#FFFFFF", padding: "3.5% 5% 3% 5%", borderBottom: "1px solid #F3F4F6", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.2vw", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>Events</p>
          <div style={{ background: "#2563EB", borderRadius: "0.6vw", padding: "1.5% 3.5%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", fontWeight: 700, color: "#FFFFFF" }}>+ New</p>
          </div>
        </div>

        {/* List of ticket cards */}
        <div style={{ background: "#F9FAFB", flex: 1, display: "flex", flexDirection: "column", padding: "4% 5%", gap: "3%" }}>

          {/* Ticket 1 — blue border, owed to you */}
          <div style={{ background: "#FFFFFF", borderRadius: "0.9vw", overflow: "hidden", display: "flex", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: "0.45vw", background: "#2563EB", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "4% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>Dinner at Nobu</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#9CA3AF", marginTop: "2%" }}>Sat Jun 28 · 4 people</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.05vw", fontWeight: 800, color: "#16A34A" }}>+$61</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF", marginTop: "1%" }}>owed to you</p>
              </div>
            </div>
          </div>

          {/* Ticket 2 — red border, you owe */}
          <div style={{ background: "#FFFFFF", borderRadius: "0.9vw", overflow: "hidden", display: "flex", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: "0.45vw", background: "#DC2626", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "4% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>Cocktails at Bar Goto</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#9CA3AF", marginTop: "2%" }}>Fri Jun 27 · 6 people</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.05vw", fontWeight: 800, color: "#DC2626" }}>-$32</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF", marginTop: "1%" }}>you owe</p>
              </div>
            </div>
          </div>

          {/* Ticket 3 — blue border, owed */}
          <div style={{ background: "#FFFFFF", borderRadius: "0.9vw", overflow: "hidden", display: "flex", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: "0.45vw", background: "#2563EB", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "4% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>Omakase Night</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#9CA3AF", marginTop: "2%" }}>Sun Jun 29 · 3 people</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.05vw", fontWeight: 800, color: "#16A34A" }}>+$18</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#9CA3AF", marginTop: "1%" }}>owed to you</p>
              </div>
            </div>
          </div>

          {/* Ticket 4 — gray, settled */}
          <div style={{ background: "#FFFFFF", borderRadius: "0.9vw", overflow: "hidden", display: "flex", opacity: 0.6, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "0.45vw", background: "#D1D5DB", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "4% 4%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.9vw", fontWeight: 600, color: "#6B7280", lineHeight: 1.1 }}>Brunch Club</p>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.62vw", color: "#D1D5DB", marginTop: "2%" }}>Last week · settled</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.75vw", color: "#D1D5DB", fontWeight: 600 }}>Settled ✓</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What changed</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>No greeting or balance hero — straight to events</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Left border color = instant status read</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Amount right-aligned, large, colored — no tap to see what you owe</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
