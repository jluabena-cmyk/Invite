export default function ScreenshotAndroid3() {
  const places = [
    { emoji: "🍣", name: "Nobu Downtown", type: "Japanese", rating: "4.8", dist: "0.3 mi", price: "$$$$", selected: true },
    { emoji: "🍣", name: "Sushi Yasuda", type: "Japanese", rating: "4.9", dist: "0.5 mi", price: "$$$", selected: false },
    { emoji: "🦞", name: "Catch Rooftop", type: "Seafood", rating: "4.6", dist: "0.7 mi", price: "$$$$", selected: false },
  ];
  return (
    <div style={{ width: 390, height: 693, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 44, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 24px 6px", fontSize: 13, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6 }}><span>●●●</span><span>🔋</span></div>
      </div>

      <div style={{ padding: "10px 20px 8px" }}>
        <div style={{ fontSize: 13, color: "#78716C", marginBottom: 4 }}>Creating an event</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1917" }}>Pick a restaurant 🍣</div>
      </div>

      <div style={{ padding: "0 20px 10px" }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F0EAE2", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <span style={{ fontSize: 15, color: "#A8A29E" }}>Search restaurants near you…</span>
        </div>
      </div>

      <div style={{ padding: "0 20px 8px", display: "flex", gap: 8 }}>
        {["Nearby","Japanese","Seafood","Italian"].map((tag, i) => (
          <div key={i} style={{ background: i === 0 ? "#C2410C" : "#fff", borderRadius: 20, padding: "6px 14px", border: i === 0 ? "none" : "1px solid #F0EAE2" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? "#fff" : "#78716C" }}>{tag}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
        {places.map((p, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: p.selected ? "2px solid #C2410C" : "1px solid #F0EAE2", boxShadow: p.selected ? "0 0 0 3px rgba(194,65,12,0.08)" : "0 1px 4px rgba(0,0,0,0.04)", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FAF5EF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#78716C", marginTop: 2 }}>{p.type} · {p.price}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#D97706" }}>⭐ {p.rating}</span>
                  <span style={{ fontSize: 13, color: "#A8A29E" }}>· {p.dist}</span>
                </div>
              </div>
              {p.selected ? (
                <div style={{ width: 28, height: 28, borderRadius: 14, background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>✓</span>
                </div>
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 14, border: "2px solid #F0EAE2", flexShrink: 0 }} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 20px 12px" }}>
        <div style={{ background: "#C2410C", borderRadius: 16, padding: "16px", textAlign: "center", boxShadow: "0 4px 16px rgba(194,65,12,0.35)" }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Confirm Nobu Downtown →</span>
        </div>
      </div>

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
