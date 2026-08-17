export default function LuxeChat() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#60A5FA" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#60A5FA", textTransform: "uppercase" }}>
          A — Hero Balance · Chat Tab
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Conversation</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Grouped by sender — avatar anchors each thread</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>System Events</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Scan complete and payment notices inline as pills</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Send Bar</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Minimal input with blue send — thumb-zone friendly</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #374151", boxShadow: "0 2vh 6vw rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#0F172A", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#94A3B8" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#94A3B8", borderRadius: "0.2vw" }} />
        </div>

        {/* Dark hero header */}
        <div style={{ background: "#0F172A", padding: "3% 6% 2.5% 6%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#64748B", marginBottom: "1%" }}>← Dinner at Nobu · Chat</p>
          <div style={{ display: "flex", alignItems: "center", gap: "3%" }}>
            <div style={{ display: "flex" }}>
              {["#7C3AED", "#0369A1", "#374151", "#047857"].map((c, i) => (
                <div key={i} style={{ width: "1.6vw", height: "1.6vw", borderRadius: "50%", background: c, border: "0.15vw solid #0F172A", marginLeft: i === 0 ? 0 : "-0.4vw" }} />
              ))}
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#64748B" }}>4 people</p>
          </div>
        </div>

        {/* Tab row */}
        <div style={{ background: "#FFFFFF", display: "flex", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          {["Overview", "Chat", "Bill", "Photos"].map((tab) => (
            <div
              key={tab}
              style={{
                flex: 1,
                padding: "2.5% 0",
                textAlign: "center",
                borderBottom: tab === "Chat" ? "0.2vh solid #1D4ED8" : "none",
              }}
            >
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: tab === "Chat" ? 700 : 400, color: tab === "Chat" ? "#1D4ED8" : "#9CA3AF" }}>{tab}</p>
            </div>
          ))}
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, background: "#F8FAFC", padding: "3% 5%", display: "flex", flexDirection: "column", gap: "3%", overflowY: "hidden" }}>

          {/* System event pill */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#EFF6FF", borderRadius: "2vw", padding: "1% 3%", border: "1px solid #DBEAFE" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#1D4ED8", fontWeight: 600 }}>📷 Receipt scanned — 6 items added</p>
            </div>
          </div>

          {/* Message: Priya (other) */}
          <div style={{ display: "flex", gap: "2.5%", alignItems: "flex-end" }}>
            <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>P</p>
            </div>
            <div style={{ maxWidth: "62%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#9CA3AF", marginBottom: "0.8%" }}>Priya</p>
              <div style={{ background: "#FFFFFF", borderRadius: "0.2vw 1.2vw 1.2vw 1.2vw", padding: "2.5% 4%", boxShadow: "0 0.3vh 0.8vw rgba(0,0,0,0.06)" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68vw", color: "#0F172A", lineHeight: 1.4 }}>I claimed the salmon and truffle fries — can someone grab the sparkling water?</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.48vw", color: "#CBD5E1", marginTop: "0.8%", marginLeft: "2%" }}>9:32 PM</p>
            </div>
          </div>

          {/* Message: James (other) */}
          <div style={{ display: "flex", gap: "2.5%", alignItems: "flex-end" }}>
            <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#0369A1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>J</p>
            </div>
            <div style={{ maxWidth: "62%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#9CA3AF", marginBottom: "0.8%" }}>James</p>
              <div style={{ background: "#FFFFFF", borderRadius: "0.2vw 1.2vw 1.2vw 1.2vw", padding: "2.5% 4%", boxShadow: "0 0.3vh 0.8vw rgba(0,0,0,0.06)" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68vw", color: "#0F172A", lineHeight: 1.4 }}>On it 👍</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.48vw", color: "#CBD5E1", marginTop: "0.8%", marginLeft: "2%" }}>9:33 PM</p>
            </div>
          </div>

          {/* Message: You (self) */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "65%" }}>
              <div style={{ background: "#1D4ED8", borderRadius: "1.2vw 0.2vw 1.2vw 1.2vw", padding: "2.5% 4%" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68vw", color: "#FFFFFF", lineHeight: 1.4 }}>I added 20% tip — hope that's ok with everyone</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.48vw", color: "#CBD5E1", marginTop: "0.8%", textAlign: "right", marginRight: "2%" }}>9:34 PM</p>
            </div>
          </div>

          {/* System event: payment */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#F0FDF4", borderRadius: "2vw", padding: "1% 3%", border: "1px solid #BBF7D0" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#16A34A", fontWeight: 600 }}>✓ Priya paid $45.85</p>
            </div>
          </div>

          {/* Message: Mia (other) */}
          <div style={{ display: "flex", gap: "2.5%", alignItems: "flex-end" }}>
            <div style={{ width: "1.8vw", height: "1.8vw", borderRadius: "50%", background: "#047857", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.45vw", fontWeight: 700, color: "#fff" }}>M</p>
            </div>
            <div style={{ maxWidth: "62%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#9CA3AF", marginBottom: "0.8%" }}>Mia</p>
              <div style={{ background: "#FFFFFF", borderRadius: "0.2vw 1.2vw 1.2vw 1.2vw", padding: "2.5% 4%", boxShadow: "0 0.3vh 0.8vw rgba(0,0,0,0.06)" }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68vw", color: "#0F172A", lineHeight: 1.4 }}>Sending mine now ✨</p>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.48vw", color: "#CBD5E1", marginTop: "0.8%", marginLeft: "2%" }}>9:35 PM</p>
            </div>
          </div>
        </div>

        {/* Send bar */}
        <div style={{ background: "#FFFFFF", borderTop: "1px solid #F1F5F9", padding: "2.5% 4%", display: "flex", alignItems: "center", gap: "3%", flexShrink: 0 }}>
          <div style={{ flex: 1, background: "#F8FAFC", borderRadius: "2vw", padding: "2.5% 4%", border: "1px solid #E2E8F0" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#CBD5E1" }}>Message…</p>
          </div>
          <div style={{ width: "2.6vw", height: "2.6vw", borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <p style={{ fontSize: "0.7vw", color: "#fff" }}>↑</p>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What's here</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>System pills break up chat — no separate activity feed needed</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Avatar stack in hero shows who's in the event instantly</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Blue send matches hero accent — cohesive throughout</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Payment confirmation lands inline — no tab switching</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
