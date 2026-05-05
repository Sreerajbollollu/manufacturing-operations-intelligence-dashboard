import { T, font } from "../../utils/tokens";

export default function DonutChart({ avail, perf, qual }) {
  const oee = avail * perf * qual;
  const r = 44, cx = 55, cy = 55, circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = [
    { val: avail, color: T.warning,         label: "Availability" },
    { val: perf,  color: T.primaryContainer, label: "Performance" },
    { val: qual,  color: T.success,          label: "Quality" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg viewBox="0 0 110 110" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.high} strokeWidth={13} />
          {segments.map((seg, i) => {
            const dash = circ * seg.val * 0.3;
            const gap = circ - dash;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
                strokeWidth={13} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} opacity={0.85} />
            );
            offset += dash + 4;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: font.data, fontSize: 26, fontWeight: 500, color: T.onSurface, lineHeight: 1 }}>{(oee * 100).toFixed(1)}</span>
          <span style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", color: T.outline, marginTop: 2 }}>% OEE</span>
        </div>
      </div>
      <div style={{ width: "100%", marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        {segments.map((item) => (
          <div key={item.label}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontFamily: font.data, padding: "5px 8px", borderRadius: 4, border: "1px solid transparent", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.container; e.currentTarget.style.borderColor = T.high; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
              <span style={{ color: T.onSurfaceVar }}>{item.label}</span>
            </div>
            <span style={{ fontFamily: font.data, color: T.onSurface }}>{(item.val * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
