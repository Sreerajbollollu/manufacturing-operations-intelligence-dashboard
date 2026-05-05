import { T, font } from "../utils/tokens";
import { fmtPct } from "../utils/formatters";
import HBar from "../components/charts/HBar";

function Card({ children, style }) {
  return <div style={{ background: T.low, border: `1px solid ${T.high}`, borderRadius: 12, padding: 20, overflow: "hidden", ...style }}>{children}</div>;
}
function SH({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: font.data, fontSize: 11, color: T.outline, margin: "4px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>{subtitle}</p>}
    </div>
  );
}

export default function QualityAnalytics({ quality }) {
  if (!quality) return <div style={{ color: T.outline, fontFamily: font.data, padding: 40 }}>Loading quality data…</div>;

  const { defect_pareto = [], fpy_by_line = [] } = quality;
  const dTotal = defect_pareto.reduce((s, d) => s + d.total_count, 0);
  const top2 = defect_pareto.slice(0, 2).reduce((s, d) => s + d.total_count, 0);

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Quality Analytics</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Defect analysis, yield trends, and Six Sigma process indicators.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SH title="Defect Pareto Analysis" subtitle="80/20 rule identification" />
          <HBar items={defect_pareto} valueKey="total_count" />
          {dTotal > 0 && (
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: `${T.danger}0d`, border: `1px solid ${T.danger}26`, fontSize: 12, fontFamily: font.data, color: T.onSurfaceVar }}>
              <strong style={{ color: T.error }}>Insight: </strong>
              Top 2 defects = {Math.round(top2 / dTotal * 100)}% of {dTotal.toLocaleString()} incidents — prioritize DMAIC here.
            </div>
          )}
        </Card>

        <Card>
          <SH title="Cumulative Pareto Distribution" subtitle="80% threshold line" />
          <svg viewBox="0 0 300 180" style={{ width: "100%", height: 180 }}>
            <line x1={0} x2={300} y1={180 - 0.8 * 150 - 10} y2={180 - 0.8 * 150 - 10} stroke={T.danger} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            <text x={8} y={180 - 0.8 * 150 - 14} fontSize={9} fontFamily={font.data} fill={T.danger}>80%</text>
            {defect_pareto.map((d, i) => {
              const bw = 300 / defect_pareto.length;
              const bh = (d.total_count / (defect_pareto[0]?.total_count || 1)) * 120;
              return (
                <g key={i}>
                  <rect x={i * bw + 6} y={180 - bh - 10} width={bw - 12} height={bh} rx={4} fill={T.primaryContainer} opacity={0.5} />
                  <circle cx={i * bw + bw / 2} cy={180 - d.cumulative_pct * 150 - 10} r={3.5} fill={T.warning} />
                  {i > 0 && <line x1={(i-1)*bw+bw/2} y1={180 - defect_pareto[i-1].cumulative_pct*150-10} x2={i*bw+bw/2} y2={180 - d.cumulative_pct*150-10} stroke={T.warning} strokeWidth={2} />}
                  <text x={i * bw + bw / 2} y={176} textAnchor="middle" fontSize={8} fontFamily={font.data} fill={T.outline}>{d.defect_name.split(" ")[0]}</text>
                </g>
              );
            })}
          </svg>
        </Card>
      </div>

      <Card>
        <SH title="First Pass Yield by Line" subtitle="SQL-computed from fact_production_events" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.high}` }}>
              {["Line", "FPY", "Good Units", "Total Produced", "Defect Rate"].map((h, i) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: i > 0 ? "right" : "left", fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fpy_by_line.map((row, i) => (
              <tr key={row.line_id} style={{ borderBottom: i < fpy_by_line.length - 1 ? `1px solid ${T.high}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.container}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "10px 16px", fontFamily: font.data, fontSize: 13, color: T.onSurface }}>{row.line_name}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: row.fpy >= 0.95 ? T.success : row.fpy >= 0.90 ? T.warning : T.danger, fontWeight: 600 }}>{fmtPct(row.fpy)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.onSurfaceVar }}>{row.total_good?.toLocaleString()}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.onSurfaceVar }}>{row.total_produced?.toLocaleString()}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.outline }}>{fmtPct(1 - (row.fpy || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
