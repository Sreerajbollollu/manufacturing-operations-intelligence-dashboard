import { T, font } from "../../utils/tokens";

export default function HBar({ items, valueKey }) {
  const mx = Math.max(...items.map((i) => i[valueKey]));
  const defColors = [`${T.error}cc`, T.warning, `${T.primary}b3`, `${T.primary}66`, `${T.primary}33`, `${T.primary}1a`];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font.data, marginBottom: 5 }}>
            <span style={{ color: T.onSurface }}>{item.type || item.defect_name || item.name}</span>
            <span style={{ color: T.outline }}>{item[valueKey]}</span>
          </div>
          <div style={{ height: 6, background: T.container, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${(item[valueKey] / mx) * 100}%`, background: defColors[i] || T.primary, transition: "width 0.8s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
