import { T, font } from "../utils/tokens";
import { fmtPct, fmtNum, fmtSec, fmtMin, oeeColor } from "../utils/formatters";
import KPICard from "../components/cards/KPICard";
import AreaChart from "../components/charts/AreaChart";
import DonutChart from "../components/charts/DonutChart";
import HBar from "../components/charts/HBar";

function Card({ children, style, noPad }) {
  return <div style={{ background: T.low, border: `1px solid ${T.high}`, borderRadius: 12, padding: noPad ? 0 : 20, overflow: "hidden", ...style }}>{children}</div>;
}
function SectionHeader({ title, subtitle, icon, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontFamily: font.data, fontSize: 11, color: T.outline, margin: "4px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>{subtitle}</p>}
      </div>
      {right || (icon && <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.outline }}>{icon}</span>)}
    </div>
  );
}

export default function Overview({ overview, hourly, lines, defects, shifts }) {
  if (!overview) return <div style={{ color: T.outline, fontFamily: font.data, padding: 40 }}>Loading overview…</div>;

  const firstLine = lines?.[0] || {};
  const avail = firstLine.availability ?? 0.85;
  const perf  = firstLine.performance  ?? 0.90;
  const qual  = firstLine.quality      ?? 0.97;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 8, borderBottom: `1px solid ${T.high}50` }}>
        <div>
          <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, lineHeight: 1.3, margin: 0 }}>Factory Overview</h1>
          <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Real-time performance metrics across all active lines.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font.data, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primaryContainer, display: "inline-block", animation: "pulse 2s infinite" }} />
          Live · Last 30 days
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KPICard title="OEE %" value={fmtPct(overview.oee)} icon="donut_large" trend="+2.1% vs prev" trendStatus="up" />
        <KPICard title="Throughput" value={fmtNum(overview.throughput)} unit="units" icon="conveyor_belt" trend="-0.4%" trendStatus="flat" />
        <KPICard title="First Pass Yield" value={fmtPct(overview.fpy)} icon="check_circle" trend="+0.2%" trendStatus="up" />
        <KPICard title="Avg Takt Time" value={fmtSec(overview.avg_takt_time)} unit="/unit" icon="timer" trend="Stable" trendStatus="stable" />
        <KPICard title="Active Alerts" value={overview.active_alerts} icon="warning" trend={overview.active_alerts > 0 ? "OEE < 75%" : "All clear"} trendStatus={overview.active_alerts > 0 ? "down" : "up"} isAlert={overview.active_alerts > 0} />
        <KPICard title="Total Defects" value={fmtNum(overview.total_defects)} unit="units" icon="bug_report" trend={`${fmtMin(overview.total_downtime_min)} downtime`} trendStatus="flat" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card>
          <SectionHeader title="Hourly Output vs Target"
            subtitle={`Line ${lines?.[0]?.line_name || "FA-1"} · Last 7 days`}
            right={<div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: font.data, color: T.onSurfaceVar }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primaryContainer }} />Actual</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px dashed ${T.outline}` }} />Target</span>
            </div>}
          />
          {hourly?.length > 0
            ? <AreaChart data={hourly} dataKey="output" targetKey="target" id="overview" />
            : <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: T.outline, fontFamily: font.data }}>Loading chart…</div>
          }
        </Card>
        <Card>
          <SectionHeader title="OEE Breakdown" icon="more_vert" />
          <DonutChart avail={avail} perf={perf} qual={qual} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card noPad>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.high}`, background: `${T.lowest}80` }}>
            <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>Shift Comparison</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.high}` }}>
                {["Shift", "OEE", "Output", "Downtime", "Defects"].map((h, i) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: i > 0 ? "right" : "left", fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(shifts || []).map((s, i) => (
                <tr key={s.shift_id} style={{ borderBottom: i < (shifts.length - 1) ? `1px solid ${T.high}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = T.container}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 16px", fontFamily: font.data, fontSize: 13, color: T.onSurface }}>{s.shift_name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: oeeColor(s.oee, T) }}>{fmtPct(s.oee)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.onSurfaceVar }}>{fmtNum(s.throughput)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.outline }}>{fmtMin(s.downtime_min)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: font.data, fontSize: 13, color: T.outline }}>{s.total_defects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <SectionHeader title="Defect Pareto (Top 5)" subtitle="Last 30 days" icon="bar_chart" />
          {defects?.length > 0
            ? <HBar items={defects.slice(0, 5)} valueKey="total_count" />
            : <div style={{ color: T.outline, fontFamily: font.data }}>Loading…</div>
          }
        </Card>
      </div>
    </>
  );
}
