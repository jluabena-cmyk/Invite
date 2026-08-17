export default function BoldPalette() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute top-[6vh] left-[6vw]" style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
        <div style={{ width: "3.5vw", height: "0.35vh", background: "#F97316" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 700, letterSpacing: "0.15em", color: "#FB923C", textTransform: "uppercase" }}>
          Direction B — Concept
        </p>
      </div>

      <div className="absolute top-[15vh] left-[6vw]" style={{ maxWidth: "38vw" }}>
        <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "6vw", fontWeight: 800, color: "#F0EDE8", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
          Ticket Stubs
        </h2>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 300, color: "#9CA3AF", marginTop: "1vh", lineHeight: 1.5 }}>
          Each event is a horizontal ticket card — strong left-border accent, event name left, amount right. One glance, all the info.
        </p>
        <div style={{ marginTop: "3vh", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Inspired by: boarding passes, concert tickets, event wristbands</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Left border color signals the event's balance direction (owed/owing)</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: "#FB923C", flexShrink: 0 }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 400, color: "#6B7280" }}>Detail view uses a 2×2 stat grid — no tabs, all key facts visible</p>
          </div>
        </div>
      </div>

      {/* Annotated ticket card diagram */}
      <div className="absolute right-[6vw] top-[14vh]" style={{ width: "36vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.8vw", fontWeight: 400, color: "#4B5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>Card anatomy</p>

        {/* Ticket card example */}
        <div style={{ background: "#1A1F2B", borderRadius: "1vw", overflow: "hidden", display: "flex", position: "relative" }}>
          {/* Left border */}
          <div style={{ width: "0.6vw", background: "#2563EB", flexShrink: 0 }} />
          <div style={{ flex: 1, padding: "2.5vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.1 }}>Dinner at Nobu</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.8vw", color: "#6B7280", marginTop: "0.8vh" }}>Sat Jun 28 · 4 people</p>
            </div>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3vw", fontWeight: 800, color: "#4ADE80", letterSpacing: "-0.02em" }}>+$61</p>
            </div>
          </div>
        </div>

        {/* Annotations */}
        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: "0 0 0.6vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5vh" }}>
            <div style={{ width: "0.6vw", height: "5vh", background: "#2563EB", borderRadius: "0.3vw" }} />
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.4vw", color: "#60A5FA", fontWeight: 600, whiteSpace: "nowrap", marginTop: "0.5vh" }}>Border = status</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", color: "#4B5563", textAlign: "center", lineHeight: 1.3 }}>Blue = owed to you, red = you owe</p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5vh" }}>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.4vw", color: "#FB923C", fontWeight: 600 }}>Amount = hero right</p>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.3vw", color: "#4B5563", textAlign: "right", lineHeight: 1.3 }}>Right-aligned, colored, large — instant scan</p>
          </div>
        </div>

        {/* Second card example — different color */}
        <div style={{ background: "#1A1F2B", borderRadius: "1vw", overflow: "hidden", display: "flex" }}>
          <div style={{ width: "0.6vw", background: "#DC2626", flexShrink: 0 }} />
          <div style={{ flex: 1, padding: "2.5vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.1 }}>Bar Goto</p>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "1.8vw", color: "#6B7280", marginTop: "0.8vh" }}>Fri Jun 27 · 6 people</p>
            </div>
            <div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: "3vw", fontWeight: 800, color: "#F87171", letterSpacing: "-0.02em" }}>-$32</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw]" style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, color: "#4B5563", letterSpacing: "0.2em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Scannable · Structured · Action-ready
        </p>
        <div style={{ height: "0.15vh", flex: 1, background: "#1F2937" }} />
      </div>
    </div>
  );
}
