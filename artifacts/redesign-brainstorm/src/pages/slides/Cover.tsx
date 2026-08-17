export default function Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#111318" }}>
      <div className="absolute left-[8vw] top-0 bottom-0 w-[0.25vw]" style={{ background: "linear-gradient(to bottom, transparent, #3B82F6 30%, #3B82F6 70%, transparent)" }} />

      <div className="absolute top-[7vh] left-[10vw]">
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.2vw", fontWeight: 300, letterSpacing: "0.18em", color: "#6B7280", textTransform: "uppercase" }}>
          Bill Splitter
        </p>
      </div>

      <div className="absolute left-[10vw] top-[22vh]" style={{ maxWidth: "62vw" }}>
        <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: "7.5vw", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#F0EDE8" }}>
          Layout
        </h1>
        <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: "7.5vw", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#3B82F6" }}>
          Directions
        </h1>
        <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: "7.5vw", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#F0EDE8" }}>
          Redesign
        </h1>
      </div>

      <div className="absolute left-[10vw] bottom-[12vh]">
        <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.6vw", fontWeight: 400, color: "#9CA3AF", letterSpacing: "0.01em" }}>
          3 layout structures · Home Screen · Event Detail
        </p>
      </div>

      <div className="absolute right-[8vw] top-[50%]" style={{ transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5vh" }}>
          <div style={{ width: "5vw", height: "0.3vh", background: "#1D4ED8" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 700, color: "#6B7280" }}>A</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 300, color: "#4B5563" }}>Hero Balance</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5vh" }}>
          <div style={{ width: "5vw", height: "0.3vh", background: "#F97316" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 700, color: "#6B7280" }}>B</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 300, color: "#4B5563" }}>Ticket Stubs</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5vh" }}>
          <div style={{ width: "5vw", height: "0.3vh", background: "#6B7280" }} />
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4vw", fontWeight: 700, color: "#6B7280" }}>C</p>
          <p style={{ fontFamily: "Sora, sans-serif", fontSize: "2vw", fontWeight: 300, color: "#4B5563" }}>Statement Rows</p>
        </div>
      </div>

      <div className="absolute bottom-[8vh] left-[10vw] right-[8vw] h-[0.15vh]" style={{ background: "#1F2937" }} />
    </div>
  );
}
