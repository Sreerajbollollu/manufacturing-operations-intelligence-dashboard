import { T, font } from "../../utils/tokens";

function Icon({ name, size = 18, style }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, ...style }}>{name}</span>;
}

export default function TopBar({ dbConnected }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40, height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      background: `${T.lowest}cc`, backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${T.high}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, height: "100%" }}>
        <span style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.primary, borderBottom: `2px solid ${T.primary}`, height: "100%", display: "flex", alignItems: "center" }}>
          Live Data
        </span>
        <span style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: dbConnected ? T.success : T.warning }}>
          {dbConnected ? "● DB Connected" : "● Demo Mode"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {["calendar_today", "schedule"].map((ic) => (
          <button key={ic} style={{ width: 32, height: 32, borderRadius: 4, border: "none", background: "transparent", color: T.outline, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={ic} size={18} />
          </button>
        ))}
        <button style={{ width: 32, height: 32, borderRadius: 4, border: "none", background: "transparent", color: T.outline, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <Icon name="notifications" size={18} />
          <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: T.danger }} />
        </button>
        <div style={{ width: 1, height: 16, background: T.high, margin: "0 8px" }} />
        <div style={{ background: T.container, border: `1px solid ${T.outlineVar}`, color: T.onSurface, fontFamily: font.data, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", padding: "6px 16px", borderRadius: 4 }}>
          PostgreSQL · FastAPI · React
        </div>
      </div>
    </header>
  );
}
