export default function LuxeBill() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[5.5vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "2.5vw", height: "0.3vh", background: "#60A5FA" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#60A5FA", textTransform: "uppercase" }}>
          A — Hero Balance · Bill Tab
        </p>
      </div>

      <div className="absolute left-[6vw] top-[18vh]" style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Line Items</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Each scanned item with quantity and price — tap to claim</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Claim Dots</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Avatar pips show who claimed each item at a glance</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
          <div style={{ width: "2.2vw", height: "0.25vh", background: "#60A5FA" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#E8E4DC", lineHeight: 1.2 }}>Footer Totals</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#6B7280", lineHeight: 1.4 }}>Tax, tip, and grand total pinned above the CTA</p>
        </div>
      </div>

      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24vw", height: "52vh", borderRadius: "3.5vw", background: "#FFFFFF", border: "0.5vw solid #374151", boxShadow: "0 2vh 6vw rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Status bar */}
        <div style={{ background: "#0F172A", height: "4.5%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8vw", fontWeight: 600, color: "#94A3B8" }}>9:41</p>
          <div style={{ width: "1.2vw", height: "0.5vh", background: "#94A3B8", borderRadius: "0.2vw" }} />
        </div>

        {/* Dark hero header */}
        <div style={{ background: "#0F172A", padding: "3.5% 6% 3% 6%", flexShrink: 0 }}>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65vw", color: "#64748B", marginBottom: "1.5%" }}>← Dinner at Nobu · Bill</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#475569", letterSpacing: "0.08em" }}>RECEIPT TOTAL</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.03em", marginTop: "1%" }}>$183.40</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#475569" }}>your share</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", fontWeight: 700, color: "#F97316", marginTop: "1%" }}>$45.85</p>
            </div>
          </div>
          <div style={{ width: "3vw", height: "0.2vh", background: "#F97316", marginTop: "2.5%" }} />
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
                borderBottom: tab === "Bill" ? "0.2vh solid #1D4ED8" : "none",
              }}
            >
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", fontWeight: tab === "Bill" ? 700 : 400, color: tab === "Bill" ? "#1D4ED8" : "#9CA3AF" }}>{tab}</p>
            </div>
          ))}
        </div>

        {/* Line items list */}
        <div style={{ flex: 1, background: "#FFFFFF", overflowY: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "2% 6% 1.5% 6%" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Items · 6 total</p>
          </div>

          {/* Item rows */}
          {[
            { name: "Salmon Tartare", qty: 1, price: "$28.00", claimers: ["#7C3AED", "#0369A1"], claimed: true },
            { name: "Wagyu Burger", qty: 2, price: "$52.00", claimers: ["#374151"], claimed: true },
            { name: "Truffle Fries", qty: 1, price: "$14.00", claimers: ["#7C3AED", "#0369A1", "#374151"], claimed: true },
            { name: "Sparkling Water", qty: 2, price: "$12.00", claimers: [], claimed: false },
            { name: "Tiramisu", qty: 1, price: "$16.00", claimers: ["#047857"], claimed: false },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "2.2% 6%",
                borderBottom: "1px solid #F8FAFC",
                background: item.claimed ? "#FFFFFF" : "#FFF7ED",
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 600, color: "#0F172A" }}>{item.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6vw", marginTop: "1%" }}>
                  <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.55vw", color: "#94A3B8" }}>×{item.qty}</p>
                  {item.claimers.length > 0
                    ? item.claimers.map((c, ci) => (
                        <div key={ci} style={{ width: "1.1vw", height: "1.1vw", borderRadius: "50%", background: c, border: "0.15vw solid #fff" }} />
                      ))
                    : <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.52vw", color: "#F97316" }}>unclaimed</p>
                  }
                </div>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#0F172A" }}>{item.price}</p>
            </div>
          ))}

          {/* Footer totals */}
          <div style={{ marginTop: "auto", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", padding: "2% 6% 1.5% 6%", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8" }}>Subtotal</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#374151" }}>$122.00</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8" }}>Tax</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#374151" }}>$11.40</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2%" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#94A3B8" }}>Tip (20%)</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.6vw", color: "#374151" }}>$24.40</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5% 0", borderTop: "1px solid #E2E8F0" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 700, color: "#0F172A" }}>Total</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72vw", fontWeight: 800, color: "#0F172A" }}>$183.40</p>
            </div>
          </div>
          <div style={{ padding: "2% 6%", background: "#FFFFFF", flexShrink: 0 }}>
            <div style={{ background: "#1D4ED8", borderRadius: "0.8vw", padding: "3.5% 0", textAlign: "center" }}>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.78vw", fontWeight: 700, color: "#FFFFFF" }}>Settle Up · $45.85</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[6vw] top-[50%]" style={{ transform: "translateY(-50%)", width: "18vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>What's here</p>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Hero shows total + your share side by side</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Unclaimed items tinted orange — impossible to miss</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Avatar pips per item — claims visible without tapping</p>
        </div>
        <div style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
          <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#60A5FA", flexShrink: 0, marginTop: "0.8vh" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280", lineHeight: 1.4 }}>Tax + tip breakdown pinned above Settle Up</p>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] h-[0.1vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
