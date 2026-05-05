import { T, font } from "../../utils/tokens";

export default function AreaChart({ data, dataKey, targetKey, height = 260, id = "default" }) {
  const gradId = `areag-${id}-${dataKey}`;
  const vals = data.map((d) => d[dataKey]);
  const tvals = targetKey ? data.map((d) => d[targetKey]) : [];
  const all = [...vals, ...tvals];
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all) * 1.1;
  const w = 700, h = height;
  const toY = (v) => h - 30 - ((v - min) / (max - min)) * (h - 50);
  const toX = (i) => 40 + (i / (data.length - 1)) * (w - 60);
  const linePts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const areaPts = `${toX(0)},${h - 30} ${linePts} ${toX(vals.length - 1)},${h - 30}`;
  const tLine = tvals.length ? tvals.map((v, i) => `${toX(i)},${toY(v)}`).join(" ") : "";
  const yLabels = [min, min + (max - min) / 3, min + (max - min) * 2 / 3, max].map((v) => Math.round(v));
  const fmtY = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Number.isInteger(v) ? v.toString() : v < 1 ? v.toFixed(3) : v.toFixed(1);
  const step = data.length > 12 ? 6 : data.length > 8 ? 2 : 1;
  const xIndices = data.map((_, i) => i).filter((i) => i % step === 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.primaryContainer} stopOpacity="0.3" />
          <stop offset="100%" stopColor={T.primaryContainer} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={40} x2={w - 20} y1={toY(v)} y2={toY(v)} stroke={T.outline} strokeWidth={0.5} strokeDasharray="4 3" opacity={0.2} />
          <text x={32} y={toY(v) + 4} textAnchor="end" fontSize={10} fontFamily={font.data} fill={T.outline}>{fmtY(v)}</text>
        </g>
      ))}
      <line x1={40} x2={40} y1={12} y2={h - 30} stroke={T.high} strokeWidth={1} />
      <line x1={40} x2={w - 20} y1={h - 30} y2={h - 30} stroke={T.high} strokeWidth={1} />
      {tLine && <polyline points={tLine} fill="none" stroke={T.outline} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />}
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline points={linePts} fill="none" stroke={T.primaryContainer} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(vals.length - 1)} cy={toY(vals[vals.length - 1])} r={4} fill={T.bg} stroke={T.primaryContainer} strokeWidth={2}>
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
      {xIndices.map((i) => (
        <text key={i} x={toX(i)} y={h - 10} textAnchor="middle" fontSize={10} fontFamily={font.data} fill={T.outline}>
          {data[i].label || data[i].day || data[i].month}
        </text>
      ))}
    </svg>
  );
}
