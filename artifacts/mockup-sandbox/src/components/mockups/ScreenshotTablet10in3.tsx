export default function ScreenshotTablet10in3() {
  const venues = [
    { emoji: "🍣", name: "Nobu Downtown", cuisine: "Japanese · $$$$", rating: "4.8", dist: "0.3 mi", tags: ["Trending","Reservations"] },
    { emoji: "🍕", name: "Roberta's Pizza", cuisine: "Italian · $$", rating: "4.6", dist: "0.7 mi", tags: ["Casual","Outdoor"] },
    { emoji: "☕", name: "Café Roam", cuisine: "All-day · $", rating: "4.5", dist: "0.4 mi", tags: ["Brunch","Quiet"] },
    { emoji: "🍔", name: "Shake Shack", cuisine: "American · $$", rating: "4.4", dist: "0.2 mi", tags: ["Quick","Popular"] },
  ];
  return (
    <div style={{ width: 800, height: 1280, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 58, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 38px 8px", fontSize: 18, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 10 }}><span>●●●</span><span>WiFi</span><span>🔋</span></div>
      </div>

      <div style={{ padding: "14px 38px 8px" }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#1C1917", marginBottom: 6 }}>Pick a spot 📍</div>
        <div style={{ fontSize: 18, color: "#78716C" }}>Restaurants near you · Lower Manhattan</div>
      </div>

      <div style={{ padding: "14px 38px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: "16px 22px", border: "1px solid #F0EAE2", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 24, color: "#78716C" }}>🔍</span>
          <span style={{ fontSize: 20, color: "#A8A29E" }}>Search restaurants…</span>
        </div>
      </div>

      <div style={{ padding: "0 38px 14px", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["Nearby","Top Rated","$$","Japanese","Italian","All"].map((f, i) => (
          <div key={i} style={{ background: i === 0 ? "#C2410C" : "#fff", borderRadius: 26, padding: "8px 22px", border: `1px solid ${i === 0 ? "#C2410C" : "#F0EAE2"}` }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: i === 0 ? "#fff" : "#78716C" }}>{f}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 38px", display: "flex", flexDirection: "column", gap: 16, overflowY: "hidden" }}>
        {venues.map((v, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 22, padding: "22px 26px", border: i === 0 ? "2px solid #C2410C" : "1px solid #F0EAE2", boxShadow: i === 0 ? "0 2px 16px rgba(194,65,12,0.12)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
              <div style={{ width: 74, height: 74, borderRadius: 18, background: "#FAF5EF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, flexShrink: 0 }}>{v.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1917" }}>{v.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>⭐</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#1C1917" }}>{v.rating}</span>
                    <span style={{ fontSize: 17, color: "#78716C" }}>· {v.dist}</span>
                  </div>
                </div>
                <div style={{ fontSize: 17, color: "#78716C", marginTop: 4 }}>{v.cuisine}</div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  {v.tags.map((tag, j) => (
                    <div key={j} style={{ background: "#F5F0EB", borderRadius: 10, padding: "4px 14px" }}>
                      <span style={{ fontSize: 15, color: "#78716C", fontWeight: 500 }}>{tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {i === 0 && (
              <div style={{ marginTop: 16, background: "#C2410C", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Vote for this spot →</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 106, background: "#fff", borderTop: "1px solid #F0EAE2", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 26px 14px" }}>
        {[{icon:"🏠",label:"Home",active:false},{icon:"👥",label:"Friends",active:false},{icon:"👤",label:"Profile",active:false}].map((t,i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.45 }}>
            <span style={{ fontSize: 34 }}>{t.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 400, color: "#78716C" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
