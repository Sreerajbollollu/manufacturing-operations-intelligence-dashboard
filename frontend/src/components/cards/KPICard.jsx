import { useState } from "react";
import { T, font } from "../../utils/tokens";

function Icon({ name, size = 18, style }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, ...style }}>{name}</span>;
}

function TrendBadge({ label, status }) {
  const colors = {
    up:     { bg: `${T.success}1a`, border: `${T.success}33`, text: T.success,       icon: "trending_up" },
    down:   { bg: `${T.danger}1a`,  border: `${T.danger}33`,  text: T.danger,        icon: "trending_down" },
    flat:   { bg: `${T.warning}1a`, border: `${T.warning}33`, text: T.warning,       icon: "trending_flat" },
    stable: { bg: T.high,           border: T.outlineVar,      text: T.onSurfaceVar,  icon: "horizontal_rule" },
  };
  const c = colors[status] || colors.stable;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontFamily: font.data, color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: "2px 6px", width: "fit-content" }}>
      <Icon name={c.icon} size={12} />
      <span>{label}</span>
    </div>
  );
}

export default function KPICard({ title, value, unit, trend, trendStatus, icon, isAlert }) {
  const [hov, setHov] = useState(false);
  const borderColor = isAlert ? `${T.danger}4d` : (hov ? `${T.primaryContainer}80` : T.high);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: T.low, border: `1px solid ${borderColor}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8, transition: "border-color 0.2s", cursor: "default", flex: "1 1 0", minWidth: 160 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: isAlert ? T.error : T.onSurfaceVar }}>{title}</span>
        <Icon name={icon} size={16} style={{ color: isAlert ? `${T.error}b3` : (hov ? T.primaryContainer : T.outline), transition: "color 0.2s" }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
        <span style={{ fontFamily: font.data, fontSize: 32, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", color: isAlert ? T.error : T.onSurface }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: T.outline, fontFamily: font.data }}>{unit}</span>}
      </div>
      {trend && <TrendBadge label={trend} status={trendStatus} />}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24, marginTop: 4, opacity: hov ? 1 : 0.5, transition: "opacity 0.3s" }}>
        {[0.3, 0.5, 0.4, 0.75, 0.65, 1].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: "2px 2px 0 0", background: i === 5 ? (isAlert ? T.error : T.primaryContainer) : T.outlineVar }} />
        ))}
      </div>
    </div>
  );
}
