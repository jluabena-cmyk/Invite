export default function ScreenshotTablet4() {
  const items = [
    { name: "Spicy Tuna Roll", price: 18, assignee: "Jordan M.", color: "#C2410C", initials: "JM" },
    { name: "Dragon Roll", price: 22, assignee: "Sam K.", color: "#F97316", initials: "SK" },
    { name: "Salmon Sashimi", price: 24, assignee: "Alex T.", color: "#10B981", initials: "AT" },
    { name: "Sake (2 bottles)", price: 48, assignee: "Split evenly", split: true },
    { name: "Edamame", price: 8, assignee: "Split evenly", split: true },
  ];
  return (
    <div style={{ width: 600, height: 960, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 44, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 28px 6px", fontSize: 14, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 8 }}><span>●●●</span><span>WiFi</span><span>🔋</span></div>
      </div>

      <div style={{ padding: "10px 28px 10px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🍣</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1917" }}>Nobu Downtown</div>
          <div style={{ fontSize: 13, color: "#78716C" }}>Fri, Jan 24 · 7:30 PM · 4 people</div>
        </div>
      </div>

      <div style={{ padding: "0 28px", display: "flex", gap: 0, marginBottom: 12 }}>
        {["Overview","Chat","Bill","Photos"].map((tab, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", paddingBottom: 12, borderBottom: i === 2 ? "2px solid #C2410C" : "1px solid #F0EAE2" }}>
            <span style={{ fontSize: 15, fontWeight: i === 2 ? 700 : 500, color: i === 2 ? "#C2410C" : "#78716C" }}>{tab}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 28px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>Receipt items</span>
        <div style={{ background: "#C2410C", borderRadius: 10, padding: "7px 16px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15 }}>📷</span>
          <span style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>Scan receipt</span>
        </div>
      </div>

      <div style={{ padding: "0 28px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "13px 16px", border: "1px solid #F0EAE2", display: "flex", alignItems: "center", gap: 14 }}>
            {item.split ? (
              <div style={{ width: 36, height: 36, borderRadius: 18, background: "#F5F0EB", border: "2px dashed #C2410C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, color: "#C2410C", fontWeight: 700 }}>÷</span>
              </div>
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 18, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.initials}</span>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1917" }}>{item.name}</div>
              <div style={{ fontSize: 13, color: "#78716C", marginTop: 2 }}>{item.assignee}</div>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>${item.price}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 28px 14px" }}>
        <div style={{ background: "rgba(194,65,12,0.06)", borderRadius: 18, padding: "18px 22px", border: "1px solid rgba(194,65,12,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: "#78716C" }}>Subtotal</span>
            <span style={{ fontSize: 14, color: "#78716C" }}>$120</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "#78716C" }}>Tip (20%)</span>
            <span style={{ fontSize: 14, color: "#78716C" }}>$24</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: "#1C1917" }}>Your share</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#C2410C" }}>$32.50</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

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
