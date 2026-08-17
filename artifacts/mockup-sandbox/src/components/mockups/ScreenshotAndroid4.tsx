export default function ScreenshotAndroid4() {
  const items = [
    { name: "Spicy Tuna Roll", price: 18, assignee: "Jordan M.", color: "#C2410C", initials: "JM" },
    { name: "Dragon Roll", price: 22, assignee: "Sam K.", color: "#F97316", initials: "SK" },
    { name: "Sake (2 bottles)", price: 48, assignee: "Split evenly", split: true },
    { name: "Salmon Sashimi", price: 24, assignee: "Alex T.", color: "#10B981", initials: "AT" },
  ];
  return (
    <div style={{ width: 390, height: 693, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 44, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 24px 6px", fontSize: 13, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6 }}>
          <span>●●●</span>
          <span style={{ fontSize: 14 }}>🔋</span>
        </div>
      </div>

      <div style={{ padding: "8px 20px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
          🍣
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1C1917" }}>Nobu Downtown</div>
          <div style={{ fontSize: 13, color: "#78716C" }}>Fri, Jan 24 · 7:30 PM · 4 people</div>
        </div>
      </div>

      <div style={{ padding: "0 20px", display: "flex", gap: 0, marginBottom: 8 }}>
        {["Overview","Chat","Bill","Photos"].map((tab, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", paddingBottom: 10, borderBottom: i === 2 ? "2px solid #C2410C" : "1px solid #F0EAE2" }}>
            <span style={{ fontSize: 14, fontWeight: i === 2 ? 700 : 500, color: i === 2 ? "#C2410C" : "#78716C" }}>{tab}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1C1917" }}>Receipt items</span>
        <div style={{ background: "#C2410C", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 14 }}>📷</span>
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Scan receipt</span>
        </div>
      </div>

      <div style={{ padding: "0 20px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "11px 14px", border: "1px solid #F0EAE2", display: "flex", alignItems: "center", gap: 10 }}>
            {item.split ? (
              <div style={{ width: 28, height: 28, borderRadius: 14, background: "#F5F0EB", border: "2px dashed #C2410C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "#C2410C", fontWeight: 700 }}>÷</span>
              </div>
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: 14, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{item.initials}</span>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1917" }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "#78716C", marginTop: 1 }}>{item.assignee}</div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>${item.price}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 20px 12px" }}>
        <div style={{ background: "rgba(194,65,12,0.06)", borderRadius: 16, padding: "14px 18px", border: "1px solid rgba(194,65,12,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#78716C" }}>Subtotal</span>
            <span style={{ fontSize: 13, color: "#78716C" }}>$112</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#78716C" }}>Tip (20%)</span>
            <span style={{ fontSize: 13, color: "#78716C" }}>$22</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#1C1917" }}>Your share</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#C2410C" }}>$28.75</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ height: 76, background: "#fff", borderTop: "1px solid #F0EAE2", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 10px 10px" }}>
        {[{icon:"🏠",label:"Home",active:true},{icon:"👥",label:"Friends",active:false},{icon:"👤",label:"Profile",active:false}].map((t,i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: t.active ? 1 : 0.45 }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: t.active ? 600 : 400, color: t.active ? "#C2410C" : "#78716C" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
