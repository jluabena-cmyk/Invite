export default function ScreenshotAndroid2() {
  const events = [
    { emoji: "🍣", title: "Friday Night Sushi", venue: "Nobu Downtown", time: "Today · 7:30 PM", badge: "Today", badgeColor: "#16A34A", badgeBg: "rgba(22,163,74,0.1)", members: ["JM","SK","AT"], role: "Host" },
    { emoji: "☕", title: "Brunch at Café Roam", venue: "Café Roam", time: "Tomorrow · 10:00 AM", badge: "Tomorrow", badgeColor: "#D97706", badgeBg: "rgba(217,119,6,0.1)", members: ["JM","RB"], role: "Member" },
    { emoji: "🍕", title: "Team Dinner", venue: "Roberta's Pizza", time: "Sat, Jul 18 · 6:00 PM", badge: "Upcoming", badgeColor: "#C2410C", badgeBg: "rgba(194,65,12,0.1)", members: ["JM","SK","AT","RB"], role: "Host" },
  ];
  const avatarColors = ["#C2410C","#F97316","#10B981","#F59E0B","#7C3AED"];
  return (
    <div style={{ width: 390, height: 693, background: "#FAF5EF", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ height: 44, background: "#FAF5EF", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 24px 6px", fontSize: 13, fontWeight: 600, color: "#1C1917" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>●●●</span><span>WiFi</span><span>🔋</span>
        </div>
      </div>

      <div style={{ padding: "12px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1917" }}>Good evening, Jordan 👋</div>
          <div style={{ fontSize: 14, color: "#78716C", marginTop: 2 }}>3 upcoming dinners</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>JM</span>
        </div>
      </div>

      <div style={{ padding: "0 20px 10px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", border: "1px solid #F0EAE2", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1917" }}>Sam K. invited you to Rooftop BBQ</div>
            <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>Tap to respond</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ background: "#C2410C", borderRadius: 8, padding: "5px 12px" }}><span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>✓</span></div>
            <div style={{ background: "#F0EAE2", borderRadius: 8, padding: "5px 12px" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#78716C" }}>✗</span></div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", border: "1px solid #F0EAE2", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FAF5EF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{ev.emoji}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>{ev.venue}</div>
                </div>
              </div>
              <div style={{ background: ev.badgeBg, borderRadius: 8, padding: "3px 9px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ev.badgeColor }}>{ev.badge}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14 }}>🕐</span>
                <span style={{ fontSize: 13, color: "#78716C" }}>{ev.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {ev.members.map((m, j) => (
                  <div key={j} style={{ width: 22, height: 22, borderRadius: 11, background: avatarColors[j % avatarColors.length], border: "2px solid #fff", marginLeft: j > 0 ? -6 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{m[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
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
