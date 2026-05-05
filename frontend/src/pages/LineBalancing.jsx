import { useState, useMemo } from "react";
import { T, font } from "../utils/tokens";

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

const FA1_STATIONS = [
  { id: "WS-1", name: "Load PCB",       idealTime: 18 },
  { id: "WS-2", name: "Apply Thermal",  idealTime: 20 },
  { id: "WS-3", name: "Mount Heatsink", idealTime: 22 },
  { id: "WS-4", name: "Secure Frame",   idealTime: 19 },
  { id: "WS-5", name: "Cable Connect",  idealTime: 21 },
  { id: "WS-6", name: "Flash FW",       idealTime: 16 },
  { id: "WS-7", name: "Func Test",      idealTime: 25 },
  { id: "WS-8", name: "Final QC",       idealTime: 14 },
];

export default function LineBalancing() {
  const [simOps, setSimOps] = useState(6);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const simTakt = 24;

  const simStations = useMemo(() => FA1_STATIONS.map((s) => ({
    ...s,
    simTime: Math.max(8, s.idealTime * (6 / simOps) * simSpeed),
  })), [simOps, simSpeed]);

  const simBN = Math.max(...simStations.map((s) => s.simTime));
  const simEff = simStations.reduce((s, st) => s + st.simTime, 0) / (simStations.length * simBN) * 100;

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Line Balancing Simulator</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Interactive workstation optimization for FA-1 Final Assembly.</p>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 6, fontFamily: font.body }}>
              Operators: <span style={{ color: T.primary, fontFamily: font.data }}>{simOps}</span>
            </label>
            <input type="range" min={3} max={14} value={simOps} onChange={(e) => setSimOps(+e.target.value)} style={{ width: 200, accentColor: T.primaryContainer }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 6, fontFamily: font.body }}>
              Speed Factor: <span style={{ color: T.secondary, fontFamily: font.data }}>{simSpeed.toFixed(1)}×</span>
            </label>
            <input type="range" min={0.5} max={2.0} step={0.1} value={simSpeed} onChange={(e) => setSimSpeed(+e.target.value)} style={{ width: 200, accentColor: T.secondary }} />
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.outline, fontFamily: font.body }}>Line Balance Efficiency</div>
            <div style={{ fontFamily: font.data, fontSize: 36, fontWeight: 500, lineHeight: 1, marginTop: 4, color: simEff >= 85 ? T.success : simEff >= 70 ? T.warning : T.danger }}>{simEff.toFixed(1)}%</div>
          </div>
        </div>
      </Card>

      <Card>
        <SH title="Station Cycle Times" subtitle={`Takt: ${simTakt}s | Bottleneck: ${simBN.toFixed(1)}s`} />
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 260, padding: "0 10px 20px", position: "relative" }}>
          {(() => {
            const maxCT = Math.max(simTakt * 1.4, ...simStations.map((st) => st.simTime));
            const taktPct = (simTakt / maxCT) * 200;
            return (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 20 + taktPct, borderTop: `2px dashed ${T.warning}`, opacity: 0.6, zIndex: 1 }}>
                <span style={{ position: "absolute", right: 4, top: -16, fontSize: 9, fontFamily: font.data, color: T.warning, fontWeight: 600 }}>Takt {simTakt}s</span>
              </div>
            );
          })()}
          {simStations.map((s) => {
            const maxCT = Math.max(simTakt * 1.4, ...simStations.map((st) => st.simTime));
            const h = (s.simTime / maxCT) * 200;
            const over = s.simTime > simTakt;
            return (
              <div key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 500, fontFamily: font.data, color: over ? T.danger : T.success, marginBottom: 4 }}>{s.simTime.toFixed(1)}s</div>
                <div style={{ width: "80%", height: h, borderRadius: "6px 6px 0 0", background: over ? `linear-gradient(180deg, ${T.danger}, #991b1b)` : `linear-gradient(180deg, ${T.primaryContainer}, #0891b2)`, opacity: 0.8, transition: "height 0.5s ease" }} />
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 8, color: T.onSurfaceVar, fontFamily: font.data }}>{s.id}</div>
                <div style={{ fontSize: 9, color: T.outline, textAlign: "center", maxWidth: 70, fontFamily: font.data }}>{s.name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 12, fontFamily: font.data, color: T.outline, marginTop: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.primaryContainer }} />Under Takt</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.danger }} />Over Takt</span>
        </div>
      </Card>

      <Card>
        <SH title="Optimization Recommendations" />
        {simStations.filter((s) => s.simTime > simTakt).length > 0
          ? simStations.filter((s) => s.simTime > simTakt).map((s) => (
            <div key={s.id} style={{ padding: "12px 16px", borderRadius: 8, background: `${T.danger}0d`, border: `1px solid ${T.danger}26`, fontSize: 12, fontFamily: font.data, marginBottom: 8 }}>
              <strong style={{ color: T.error }}>{s.id} ({s.name})</strong>
              <span style={{ color: T.onSurfaceVar }}> — Exceeds takt by </span>
              <span style={{ color: T.danger, fontWeight: 600 }}>{(s.simTime - simTakt).toFixed(1)}s</span>
              <span style={{ color: T.onSurfaceVar }}> — Add operator or improve cycle time</span>
            </div>
          ))
          : <div style={{ padding: "12px 16px", borderRadius: 8, background: `${T.success}0d`, border: `1px solid ${T.success}26`, fontSize: 12, fontFamily: font.data, color: T.success }}>✓ All stations within takt — line balanced.</div>
        }
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: `${T.secondary}0d`, border: `1px solid ${T.secondary}26`, fontSize: 11, fontFamily: font.data, color: T.onSurfaceVar }}>
          <strong style={{ color: T.secondary }}>Formula: </strong>
          Balance Efficiency = Σ(Station CT) / (N × Bottleneck CT) × 100 | OEE = Availability × Performance × Quality
        </div>
      </Card>
    </>
  );
}
