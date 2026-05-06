import { T, font } from "../../utils/tokens";

const NAV = [
  { id: "overview",  label: "Overview",               icon: "dashboard" },
  { id: "lines",     label: "Line Performance",        icon: "precision_manufacturing" },
  { id: "quality",   label: "Quality Analytics",       icon: "query_stats" },
  { id: "balance",   label: "Line Balancing",          icon: "account_tree" },
  { id: "capacity",  label: "Capacity Planning",       icon: "factory" },
  { id: "actions",   label: "Action Center",           icon: "assignment_late" },
];

function Icon({ name, size = 18, style }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, ...style }}>{name}</span>;
}

export default function Sidebar({ page, setPage }) {
  const linkStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 24px",
    fontFamily: font.body, fontSize: 11, fontWeight: 600,
    letterSpacing: "0.05em", textTransform: "uppercase",
    color: active ? T.primary : T.outline,
    background: active ? `${T.primary}0d` : "transparent",
    borderRight: active ? `2px solid ${T.primary}` : "2px solid transparent",
    borderLeft: "none", borderTop: "none", borderBottom: "none",
    cursor: "pointer", transition: "all 0.2s",
    width: "100%", textAlign: "left",
  });

  return (
    <nav style={{
      position: "fixed", left: 0, top: 0, bottom: 0, width: 200,
      background: T.lowest, borderRight: `1px solid ${T.high}`,
      display: "flex", flexDirection: "column", zIndex: 50,
    }}>
      <div style={{ height: 60, display: "flex", alignItems: "center", padding: "0 24px", borderBottom: `1px solid ${T.high}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "-0.01em", color: T.onSurface, fontFamily: font.body, lineHeight: 1.2 }}>Manufacturing Operations</span>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "-0.01em", color: T.primaryContainer, fontFamily: font.body, lineHeight: 1.2 }}>Intelligence Dashboard</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: "16px 0", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setPage(n.id)} style={linkStyle(page === n.id)}>
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: `1px solid ${T.high}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 4, background: T.container, border: `1px solid ${T.outlineVar}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.primary, fontFamily: font.data }}>FP</div>
          <div>
            <div style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: T.onSurface }}>Ops Analyst</div>
            <div style={{ fontSize: 10, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: font.data }}>Precision Control</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
