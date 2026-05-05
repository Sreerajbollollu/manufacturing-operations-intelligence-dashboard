import { T, font } from "../utils/tokens";
import { fmtPct, fmtNum, fmtSec, fmtMin, oeeColor } from "../utils/formatters";

export default function LinePerformance({ lines }) {
  if (!lines?.length) return <div style={{ color: T.outline, fontFamily: font.data, padding: 40 }}>Loading lines…</div>;

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Line Performance</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Real-time KPIs across all assembly and packing lines · SQL-computed from PostgreSQL.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {lines.map((line) => (
          <div key={line.line_id} style={{ background: T.low, border: `1px solid ${line.is_bottleneck ? `${T.danger}4d` : T.high}`, borderRadius: 12, padding: 20, position: "relative" }}>
            {line.is_bottleneck && (
              <div style={{ position: "absolute", top: 0, right: 0, background: T.danger, color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: "0 12px 0 8px", letterSpacing: "0.05em" }}>BOTTLENECK</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: font.data }}>{line.line_name}</h3>
              <span style={{ fontFamily: font.data, fontSize: 28, fontWeight: 500, color: oeeColor(line.oee, T) }}>{fmtPct(line.oee)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                ["Availability", fmtPct(line.availability), line.availability >= 0.90],
                ["Performance",  fmtPct(line.performance),  line.performance >= 0.85],
                ["Quality",      fmtPct(line.quality),      line.quality >= 0.95],
                ["Throughput",   fmtNum(line.throughput),   true],
                ["Takt",         fmtSec(line.takt_time_sec), true],
                ["Avg Cycle",    fmtSec(line.avg_cycle_sec), line.avg_cycle_sec <= line.takt_time_sec],
                ["Downtime",     fmtMin(line.downtime_min), line.downtime_min < 60],
                ["Bottleneck St", line.bottleneck_station_count, line.bottleneck_station_count === 0],
                ["FPY",          fmtPct(line.fpy),          line.fpy >= 0.95],
              ].map(([lbl, val, ok]) => (
                <div key={lbl} style={{ padding: "8px 10px", background: `${T.container}80`, borderRadius: 6, border: `1px solid ${T.high}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline, marginBottom: 3, fontFamily: font.body }}>{lbl}</div>
                  <div style={{ fontFamily: font.data, fontSize: 14, fontWeight: 500, color: ok ? T.onSurface : T.danger }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline, marginBottom: 4, fontFamily: font.body }}>OEE Gauge</div>
              <div style={{ height: 4, background: T.container, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${(line.oee || 0) * 100}%`, background: oeeColor(line.oee, T), transition: "width 0.6s" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
