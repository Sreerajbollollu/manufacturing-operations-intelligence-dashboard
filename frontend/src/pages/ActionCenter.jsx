import { T, font } from "../utils/tokens";

function Card({ children, style, noPad }) {
  return <div style={{ background: T.low, border: `1px solid ${T.high}`, borderRadius: 12, padding: noPad ? 0 : 20, overflow: "hidden", ...style }}>{children}</div>;
}

function PriorityBadge({ priority }) {
  const colors = {
    High: { bg: `${T.danger}1a`, fg: T.danger, border: `${T.danger}55` },
    Medium: { bg: `${T.warning}1a`, fg: T.warning, border: `${T.warning}55` },
    Low: { bg: `${T.primary}1a`, fg: T.primary, border: `${T.primary}55` },
  };
  const c = colors[priority] || colors.Low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 64, padding: "3px 9px", borderRadius: 4,
      background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
      fontFamily: font.data, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      {priority}
    </span>
  );
}

function Stat({ label, value, color = T.onSurface }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline }}>{label}</div>
      <div style={{ fontFamily: font.data, fontSize: 24, color, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function ActionCenter({ recommendations }) {
  const actions = recommendations?.recommendations || [];
  const high = actions.filter((item) => item.priority === "High").length;
  const medium = actions.filter((item) => item.priority === "Medium").length;
  const ownerTeams = new Set(actions.map((item) => item.owner_team)).size;

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Operations Recommendation Center</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Rule-based actions generated from live KPI thresholds.</p>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "center" }}>
          <Stat label="Open Actions" value={actions.length} color={T.primaryContainer} />
          <Stat label="High Priority" value={high} color={high ? T.danger : T.success} />
          <Stat label="Medium Priority" value={medium} color={medium ? T.warning : T.outline} />
          <Stat label="Owner Teams" value={ownerTeams} color={T.secondary} />
          <div style={{ marginLeft: "auto", fontFamily: font.data, fontSize: 11, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Last 30 days
          </div>
        </div>
      </Card>

      <Card noPad>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.high}`, background: `${T.lowest}80`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>Recommended Operational Actions</h2>
          <span style={{ fontFamily: font.data, fontSize: 11, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>{actions.length} Open</span>
        </div>

        {actions.length === 0 ? (
          <div style={{ padding: 28, fontFamily: font.data, color: T.outline }}>No rule-based recommendations are currently open.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {actions.map((item, index) => (
              <div key={item.id} style={{
                display: "grid", gridTemplateColumns: "96px minmax(180px, 1fr) minmax(260px, 1.4fr) minmax(220px, 1.2fr) 130px",
                gap: 16, padding: "16px 20px", borderBottom: index < actions.length - 1 ? `1px solid ${T.high}` : "none",
                alignItems: "start",
              }}>
                <div>
                  <PriorityBadge priority={item.priority} />
                  <div style={{ fontFamily: font.data, fontSize: 10, color: T.outline, marginTop: 8 }}>{item.status}</div>
                </div>
                <div>
                  <div style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, color: T.onSurface, marginBottom: 6 }}>{item.issue}</div>
                  <div style={{ fontFamily: font.data, fontSize: 11, color: T.outline }}>{item.related_kpi} · {item.line_or_shift}</div>
                </div>
                <div>
                  <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline, marginBottom: 5 }}>Evidence</div>
                  <div style={{ fontFamily: font.data, fontSize: 12, color: T.onSurfaceVar, lineHeight: 1.45 }}>{item.evidence}</div>
                </div>
                <div>
                  <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline, marginBottom: 5 }}>Recommended Action</div>
                  <div style={{ fontFamily: font.data, fontSize: 12, color: T.onSurface, lineHeight: 1.45 }}>{item.recommended_action}</div>
                  <div style={{ fontFamily: font.data, fontSize: 11, color: T.success, marginTop: 8 }}>{item.expected_impact}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline, marginBottom: 5 }}>Owner</div>
                  <div style={{ fontFamily: font.data, fontSize: 12, color: T.secondary }}>{item.owner_team}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
