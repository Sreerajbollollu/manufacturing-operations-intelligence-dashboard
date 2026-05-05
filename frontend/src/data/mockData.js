/* Fallback demo data — used if API is unavailable */
const rng = (seed) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

export function generateData() {
  const r = rng(77);
  const rf = (a, b) => a + r() * (b - a);
  const ri = (a, b) => Math.floor(rf(a, b));

  const hourly = Array.from({ length: 24 }, (_, h) => {
    const day = h >= 6 && h < 22;
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      output: day ? ri(950, 1350) : ri(650, 950),
      target: day ? 1200 : 800,
      defects: ri(1, day ? 9 : 14),
    };
  });

  const lines = ["SMT-1", "SMT-2", "FA-1", "FA-2", "FA-3", "Pack-1"].map((name, i) => {
    const avail = rf(0.82, 0.97), perf = rf(0.78, 0.96), qual = rf(0.94, 0.998);
    const oee = avail * perf * qual;
    const takt = [15, 15, 24, 24, 24, 12][i];
    const cycle = takt * rf(0.72, 1.18);
    return {
      line_id: i + 1,
      line_name: name,
      avail, perf, qual, oee,
      takt_time_sec: takt,
      avg_cycle_sec: cycle,
      is_bottleneck: cycle > takt,
      throughput: ri(800, 2400),
      fpy: rf(0.91, 0.995),
      downtime_min: ri(5, 80),
    };
  });

  const defects = [
    { defect_name: "Dimensional Variance", total_count: ri(35, 55), cumulative_pct: 0 },
    { defect_name: "Surface Scratches",    total_count: ri(22, 35), cumulative_pct: 0 },
    { defect_name: "Assembly Misalignment",total_count: ri(10, 20), cumulative_pct: 0 },
    { defect_name: "Solder Bridge",        total_count: ri(5, 12),  cumulative_pct: 0 },
    { defect_name: "Material Flaw",        total_count: ri(3, 9),   cumulative_pct: 0 },
    { defect_name: "Labeling Error",       total_count: ri(1, 5),   cumulative_pct: 0 },
  ].sort((a, b) => b.total_count - a.total_count);
  const dTotal = defects.reduce((s, d) => s + d.total_count, 0);
  let cum = 0;
  defects.forEach((d) => { cum += d.total_count; d.cumulative_pct = cum / dTotal; d.pct_of_total = d.total_count / dTotal; });

  const shifts = [
    { shift_id: 1, shift_name: "Day A",   oee: rf(0.82, 0.88), throughput: ri(1150,1350), downtime_min: ri(8,18),  total_defects: ri(12,25) },
    { shift_id: 2, shift_name: "Day B",   oee: rf(0.83, 0.89), throughput: ri(1200,1400), downtime_min: ri(5,15),  total_defects: ri(10,20) },
    { shift_id: 3, shift_name: "Night A", oee: rf(0.80, 0.86), throughput: ri(1050,1250), downtime_min: ri(15,30), total_defects: ri(14,28) },
    { shift_id: 4, shift_name: "Night B", oee: rf(0.78, 0.84), throughput: ri(1000,1200), downtime_min: ri(30,55), total_defects: ri(18,35) },
  ];

  const stations = ["Load PCB","Apply Thermal","Mount Heatsink","Secure Frame","Cable Connect","Flash FW","Func Test","Final QC"].map((name, i) => ({
    id: `WS-${i + 1}`, name, cycleTime: rf(14, 34), idealTime: 22,
  }));

  const capacity = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((month, m) => {
    const demand = ri(38000, 68000) + (m >= 8 ? ri(8000, 22000) : 0);
    const cap = 55000 + ri(-3000, 6000);
    return { month, demand, capacity: cap, gap: cap - demand };
  });

  const overview = {
    oee: lines.reduce((s, l) => s + l.oee, 0) / lines.length,
    throughput: ri(5000, 8000),
    fpy: lines.reduce((s, l) => s + l.fpy, 0) / lines.length,
    avg_takt_time: 20,
    bottleneck_count: lines.filter((l) => l.is_bottleneck).length,
    active_alerts: lines.filter((l) => l.oee < 0.75).length,
    total_defects: dTotal,
    total_downtime_min: ri(80, 200),
  };

  return { hourly, lines, defects, dTotal, shifts, stations, capacity, overview };
}
