export default function ScreenshotAndroid1() {
  return (
    <div style={{ width: 390, height: 693, background: "#1a1f3c", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(194,65,12,0.18) 0%, transparent 70%)" }} />

      {[
        { emoji: "🍣", top: "10%", left: "8%", size: 38, rot: -12 },
        { emoji: "🍷", top: "16%", right: "10%", size: 32, rot: 8 },
        { emoji: "🍔", top: "6%", left: "44%", size: 30, rot: 5 },
        { emoji: "🥗", top: "32%", left: "6%", size: 28, rot: -6 },
        { emoji: "🍕", top: "26%", right: "6%", size: 34, rot: 10 },
        { emoji: "🧾", bottom: "24%", left: "10%", size: 28, rot: -8 },
        { emoji: "👥", bottom: "18%", right: "12%", size: 32, rot: 6 },
        { emoji: "✨", top: "42%", left: "22%", size: 18, rot: 0 },
        { emoji: "✨", top: "20%", right: "30%", size: 14, rot: 0 },
        { emoji: "✨", bottom: "32%", right: "28%", size: 16, rot: 0 },
      ].map((f, i) => (
        <div key={i} style={{ position: "absolute", top: f.top, bottom: (f as any).bottom, left: f.left, right: (f as any).right, fontSize: f.size, transform: `rotate(${f.rot}deg)`, opacity: 0.85 }}>{f.emoji}</div>
      ))}

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 40px" }}>
        <div style={{ width: 72, height: 72, background: "linear-gradient(135deg, #C2410C 0%, #EA580C 100%)", borderRadius: 20, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(194,65,12,0.45)" }}>
          <span style={{ fontSize: 36 }}>🍽️</span>
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1, marginBottom: 14, letterSpacing: -1 }}>
          Split bills,<br />not friendships.
        </div>
        <div style={{ fontSize: 17, color: "rgba(255,255,255,0.62)", lineHeight: 1.6, marginBottom: 40 }}>
          Plan group dinners, pick the perfect spot, and split the tab — all in one app.
        </div>
        <div style={{ background: "#C2410C", borderRadius: 16, padding: "16px 40px", display: "inline-block", boxShadow: "0 4px 20px rgba(194,65,12,0.5)" }}>
          <span style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>Get started free →</span>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 32, display: "flex", gap: 8 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ width: i === 0 ? 22 : 7, height: 7, borderRadius: 4, background: i === 0 ? "#C2410C" : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
    </div>
  );
}
