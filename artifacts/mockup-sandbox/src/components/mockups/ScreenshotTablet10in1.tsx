export default function ScreenshotTablet10in1() {
  return (
    <div style={{ width: 800, height: 1280, background: "#1a1f3c", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(194,65,12,0.22) 0%, transparent 70%)" }} />

      {[
        { emoji: "🍣", top: "8%", left: "6%", size: 64, rot: -12 },
        { emoji: "🍷", top: "14%", right: "8%", size: 54, rot: 8 },
        { emoji: "🍔", top: "5%", left: "46%", size: 50, rot: 5 },
        { emoji: "🥗", top: "30%", left: "4%", size: 48, rot: -6 },
        { emoji: "🍕", top: "24%", right: "5%", size: 58, rot: 10 },
        { emoji: "🧾", bottom: "22%", left: "8%", size: 48, rot: -8 },
        { emoji: "👥", bottom: "16%", right: "10%", size: 54, rot: 6 },
        { emoji: "✨", top: "42%", left: "18%", size: 30, rot: 0 },
        { emoji: "✨", top: "18%", right: "28%", size: 24, rot: 0 },
        { emoji: "✨", bottom: "30%", right: "24%", size: 26, rot: 0 },
        { emoji: "🥂", top: "10%", left: "32%", size: 46, rot: 15 },
        { emoji: "🍜", bottom: "28%", right: "30%", size: 42, rot: -10 },
      ].map((f, i) => (
        <div key={i} style={{ position: "absolute", top: f.top, bottom: (f as any).bottom, left: f.left, right: (f as any).right, fontSize: f.size, transform: `rotate(${f.rot}deg)`, opacity: 0.8 }}>{f.emoji}</div>
      ))}

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 86px" }}>
        <div style={{ width: 128, height: 128, background: "linear-gradient(135deg, #C2410C 0%, #EA580C 100%)", borderRadius: 34, margin: "0 auto 36px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 64px rgba(194,65,12,0.5)" }}>
          <span style={{ fontSize: 64 }}>🍽️</span>
        </div>
        <div style={{ fontSize: 70, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.08, marginBottom: 26, letterSpacing: -2 }}>
          Split bills,<br />not friendships.
        </div>
        <div style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: 70 }}>
          Plan group dinners, pick the perfect spot,<br />and split the tab — all in one app.
        </div>
        <div style={{ background: "#C2410C", borderRadius: 26, padding: "26px 80px", display: "inline-block", boxShadow: "0 8px 36px rgba(194,65,12,0.55)" }}>
          <span style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Get started free →</span>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 54, display: "flex", gap: 12 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ width: i === 0 ? 36 : 12, height: 12, borderRadius: 6, background: i === 0 ? "#C2410C" : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
    </div>
  );
}
