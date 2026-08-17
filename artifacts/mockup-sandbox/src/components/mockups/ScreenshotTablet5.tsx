export default function ScreenshotTablet5() {
  const balances = [
    { name: "Sam K.", initials: "SK", color: "#F97316", event: "Friday Night Sushi 🍣", amount: 32.50, direction: "owes-you", status: "Pending" },
    { name: "Alex T.", initials: "AT", color: "#10B981", event: "Friday Night Sushi 🍣", amount: 14.50, direction: "owes-you", status: "Paid" },
    { name: "Jordan M.", initials: "JM", color: "#7C3AED", event: "Brunch at Café Roam ☕", amount: 12.00, direction: "you-owe", status: "Pending" },
  ];
  return (
    <div style={{ width: 600, height: 960, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 44, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 28px 6px", fontSize: 14, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 8 }}><span>●●●</span><span>WiFi</span><span>🔋</span></div>
      </div>

      <div style={{ padding: "12px 28px 16px" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917", marginBottom: 4 }}>Balances 💸</div>
        <div style={{ fontSize: 14, color: "#78716C" }}>From 3 recent events</div>
      </div>

      <div style={{ padding: "0 28px 16px", display: "flex", gap: 14 }}>
        <div style={{ flex: 1, background: "rgba(22,163,74,0.08)", borderRadius: 18, padding: "18px 20px", border: "1px solid rgba(22,163,74,0.2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>You're owed</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#16A34A", lineHeight: 1 }}>$47.00</div>
          <div style={{ fontSize: 13, color: "#78716C", marginTop: 8 }}>from 2 people</div>
        </div>
        <div style={{ flex: 1, background: "rgba(220,38,38,0.07)", borderRadius: 18, padding: "18px 20px", border: "1px solid rgba(220,38,38,0.15)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>You owe</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>$12.00</div>
          <div style={{ fontSize: 13, color: "#78716C", marginTop: 8 }}>to 1 person</div>
        </div>
      </div>

      <div style={{ padding: "0 28px 12px", display: "flex", gap: 0 }}>
        {["All","Owed to you","You owe"].map((tab, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", paddingBottom: 12, borderBottom: i === 0 ? "2px solid #C2410C" : "1px solid #F0EAE2" }}>
            <span style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#C2410C" : "#78716C" }}>{tab}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 28px", display: "flex", flexDirection: "column", gap: 12, overflowY: "hidden" }}>
        {balances.map((b, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #F0EAE2", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 25, background: b.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16, color: "#fff", fontWeight: 700 }}>{b.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>{b.name}</div>
                    <div style={{ fontSize: 13, color: "#78716C", marginTop: 2 }}>{b.event}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: b.direction === "owes-you" ? "#16A34A" : "#DC2626" }}>
                      {b.direction === "owes-you" ? "+" : "−"}${b.amount.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: b.status === "Paid" ? "#16A34A" : "#D97706", marginTop: 2 }}>{b.status}</div>
                  </div>
                </div>
                {b.direction === "owes-you" && (
                  <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, background: "#C2410C", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Request via Venmo</span>
                    </div>
                    <div style={{ background: "#F5F0EB", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, color: "#78716C", fontWeight: 600 }}>Mark paid</span>
                    </div>
                  </div>
                )}
                {b.direction === "you-owe" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ background: "#7C3AED", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Pay Jordan via Venmo →</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 28px 14px" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #F0EAE2", display: "flex", justifyContent: "space-around" }}>
          {[{label:"Total hosted",value:"$487"},{label:"Events attended",value:"12"},{label:"Friends",value:"8"}].map((stat,i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#78716C", marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1917" }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 80, background: "#fff", borderTop: "1px solid #F0EAE2", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 20px 10px" }}>
        {[{icon:"🏠",label:"Home",active:true},{icon:"👥",label:"Friends",active:false},{icon:"👤",label:"Profile",active:false}].map((t,i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: t.active ? 1 : 0.45 }}>
            <span style={{ fontSize: 26 }}>{t.icon}</span>
            <span style={{ fontSize: 12, fontWeight: t.active ? 600 : 400, color: t.active ? "#C2410C" : "#78716C" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
