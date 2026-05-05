import { T, font } from "../utils/tokens";
import { generateData } from "../data/mockData";

const MOCK = generateData();

function Card({ children, style, noPad }) {
  return <div style={{ background: T.low, border: `1px solid ${T.high}`, borderRadius: 12, padding: noPad ? 0 : 20, overflow: "hidden", ...style }}>{children}</div>;
}

export default function CapacityPlanning() {
  const data = MOCK.capacity;
  const maxV = Math.max(...data.map((d) => Math.max(d.demand, d.capacity))) * 1.1;
  const w = 700, h = 240;
  const toX = (i) => 50 + (i / 11) * (w - 70);
  const toY = (v) => h - 30 - ((v / maxV) * (h - 50));

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Capacity Planning</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>12-month demand vs capacity forecast with gap analysis.</p>
      </div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>Annual Capacity vs Demand</h2>
            <p style={{ fontFamily: font.data, fontSize: 11, color: T.outline, margin: "4px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>Monthly projections with deficit highlighting</p>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: font.data, color: T.onSurfaceVar }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 3, background: T.success, display: "inline-block" }} />Capacity</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 3, background: T.secondary, display: "inline-block" }} />Demand</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h }}>
          <defs>
            <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.success} stopOpacity="0.15" />
              <stop offset="100%" stopColor={T.success} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={50} x2={w - 20} y1={h - 30 - p * (h - 50)} y2={h - 30 - p * (h - 50)} stroke={T.outlineVar} strokeWidth={0.5} strokeDasharray="4 3" opacity={0.2} />
              <text x={44} y={h - 26 - p * (h - 50)} textAnchor="end" fontSize={9} fontFamily={font.data} fill={T.outline}>{Math.round(maxV * p / 1000)}k</text>
            </g>
          ))}
          {data.map((d, i) => d.gap < 0 && <rect key={i} x={toX(i) - 18} y={12} width={36} height={h - 42} fill={T.danger} opacity={0.05} rx={4} />)}
          <polygon points={`${toX(0)},${h - 30} ${data.map((d, i) => `${toX(i)},${toY(d.capacity)}`).join(" ")} ${toX(11)},${h - 30}`} fill="url(#cg2)" />
          <polyline points={data.map((d, i) => `${toX(i)},${toY(d.capacity)}`).join(" ")} fill="none" stroke={T.success} strokeWidth={2.5} strokeLinecap="round" />
          <polyline points={data.map((d, i) => `${toX(i)},${toY(d.demand)}`).join(" ")} fill="none" stroke={T.secondary} strokeWidth={2.5} strokeDasharray="6 3" />
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(d.capacity)} r={3} fill={T.success} />
              <circle cx={toX(i)} cy={toY(d.demand)} r={3} fill={T.secondary} />
              <text x={toX(i)} y={h - 10} textAnchor="middle" fontSize={10} fontFamily={font.data} fill={T.outline}>{d.month}</text>
            </g>
          ))}
        </svg>
      </Card>
      <Card noPad>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.high}`, background: `${T.lowest}80` }}>
          <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>Monthly Gap Analysis</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.high}` }}>
              {["Month", "Demand", "Capacity", "Gap", "Status"].map((h, i) => (
                <th key={h} style={{ padding: "10px 20px", textAlign: i > 0 ? "right" : "left", fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.month} style={{ borderBottom: `1px solid ${T.high}`, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.container}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "10px 20px", fontFamily: font.data, fontSize: 13, fontWeight: 600 }}>{d.month}</td>
                <td style={{ padding: "10px 20px", textAlign: "right", fontFamily: font.data, fontSize: 13 }}>{d.demand.toLocaleString()}</td>
                <td style={{ padding: "10px 20px", textAlign: "right", fontFamily: font.data, fontSize: 13 }}>{d.capacity.toLocaleString()}</td>
                <td style={{ padding: "10px 20px", textAlign: "right", fontFamily: font.data, fontSize: 13, fontWeight: 600, color: d.gap >= 0 ? T.success : T.danger }}>{d.gap >= 0 ? "+" : ""}{d.gap.toLocaleString()}</td>
                <td style={{ padding: "10px 20px", textAlign: "right" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: d.gap >= 0 ? `${T.success}1a` : `${T.danger}1a`, color: d.gap >= 0 ? T.success : T.danger, border: `1px solid ${d.gap >= 0 ? `${T.success}4d` : `${T.danger}4d`}` }}>{d.gap >= 0 ? "Surplus" : "Deficit"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ padding: "12px 16px", borderRadius: 8, background: `${T.secondary}0d`, border: `1px solid ${T.secondary}26`, fontSize: 12, fontFamily: font.data }}>
        <strong style={{ color: T.secondary }}>Predictive Insight: </strong>
        <span style={{ color: T.onSurfaceVar }}>Q4 demand surge — {data.filter((d) => d.gap < 0).length} deficit months — recommend overtime to close <span style={{ color: T.danger, fontWeight: 600 }}>{Math.abs(Math.min(...data.map((d) => d.gap))).toLocaleString()}</span> unit gap.</span>
      </div>
    </>
  );
}
