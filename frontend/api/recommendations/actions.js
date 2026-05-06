import { queryWithClient, sendError, sendJson, withClient } from "../_lib/db.js";
import { intValue, numberValue, round } from "../_lib/kpi.js";

const WINDOW_DAYS = 30;
const PROJECT_REF_MIN_PER_SLOT = 60;

function windowRange() {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

function priorityFor(value, high, medium) {
  if (value >= high) return "High";
  if (value >= medium) return "Medium";
  return "Low";
}

function recommendation(id, priority, issue, evidence, recommendedAction, expectedImpact, ownerTeam, relatedKpi, lineOrShift) {
  return {
    id,
    priority,
    issue,
    evidence,
    recommended_action: recommendedAction,
    expected_impact: expectedImpact,
    owner_team: ownerTeam,
    related_kpi: relatedKpi,
    line_or_shift: lineOrShift,
    status: "Open",
  };
}

const LINE_SQL = `
WITH line_prod AS (
    SELECT
        pe.line_id,
        l.line_name,
        l.takt_time_sec,
        SUM(pe.units_produced) AS total_produced,
        COUNT(*) AS planned_slots
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    GROUP BY pe.line_id, l.line_name, l.takt_time_sec
),
line_dt AS (
    SELECT line_id, SUM(duration_min) AS downtime_min
    FROM fact_downtime_events
    WHERE start_time >= $1 AND start_time < $2
    GROUP BY line_id
),
avg_cycle AS (
    SELECT ct.line_id, ROUND(AVG(ct.cycle_time_sec)::numeric, 2) AS avg_cycle_sec
    FROM fact_station_cycle_times ct
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY ct.line_id
),
bn AS (
    SELECT s.line_id, COUNT(*) AS bottleneck_station_count
    FROM fact_station_cycle_times ct
    JOIN dim_stations s ON s.station_id = ct.station_id
    JOIN dim_lines dl ON dl.line_id = s.line_id
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY s.line_id, s.station_id, dl.takt_time_sec
    HAVING AVG(ct.cycle_time_sec) > dl.takt_time_sec
),
bn_agg AS (
    SELECT line_id, COUNT(*) AS bottleneck_station_count FROM bn GROUP BY line_id
)
SELECT
    lp.line_id,
    lp.line_name,
    lp.takt_time_sec,
    lp.total_produced,
    lp.planned_slots * ${PROJECT_REF_MIN_PER_SLOT} AS planned_min,
    COALESCE(ld.downtime_min, 0) AS downtime_min,
    COALESCE(ac.avg_cycle_sec, 0) AS avg_cycle_sec,
    COALESCE(ba.bottleneck_station_count, 0) AS bottleneck_station_count,
    GREATEST(lp.planned_slots * ${PROJECT_REF_MIN_PER_SLOT} - COALESCE(ld.downtime_min, 0), 0) AS operating_min,
    ROUND(
      GREATEST(lp.planned_slots * ${PROJECT_REF_MIN_PER_SLOT} - COALESCE(ld.downtime_min, 0), 0)
      * 60.0 / NULLIF(lp.takt_time_sec, 0)
    ) AS theoretical_capacity
FROM line_prod lp
LEFT JOIN line_dt ld ON ld.line_id = lp.line_id
LEFT JOIN avg_cycle ac ON ac.line_id = lp.line_id
LEFT JOIN bn_agg ba ON ba.line_id = lp.line_id
ORDER BY lp.line_id
`;

const QUALITY_SQL = `
WITH defect_summary AS (
    SELECT
        dc.defect_category,
        SUM(qd.quantity) AS total_count
    FROM fact_quality_defects qd
    JOIN dim_defect_codes dc ON dc.defect_code_id = qd.defect_code_id
    WHERE qd.event_timestamp >= $1 AND qd.event_timestamp < $2
    GROUP BY dc.defect_category
),
ranked AS (
    SELECT
        defect_category,
        total_count,
        SUM(total_count) OVER () AS grand_total
    FROM defect_summary
)
SELECT defect_category, total_count, grand_total
FROM ranked
ORDER BY total_count DESC
LIMIT 1
`;

const SHIFT_SQL = `
SELECT
    s.shift_id,
    s.shift_name,
    SUM(pe.units_good) AS total_good,
    SUM(pe.units_produced) AS total_produced,
    ROUND(SUM(pe.units_good)::numeric / NULLIF(SUM(pe.units_produced), 0), 4) AS fpy
FROM fact_production_events pe
JOIN dim_shifts s ON s.shift_id = pe.shift_id
WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
GROUP BY s.shift_id, s.shift_name
ORDER BY s.shift_id
`;

function buildRecommendations(lineRows, qualityRow, shiftRows) {
  const actions = [];

  lineRows.forEach((line) => {
    const lineName = line.line_name;
    const bottleneckCount = intValue(line.bottleneck_station_count);
    const avgCycle = numberValue(line.avg_cycle_sec);
    const takt = numberValue(line.takt_time_sec);
    const downtimeMin = numberValue(line.downtime_min);
    const produced = intValue(line.total_produced);
    const capacity = intValue(line.theoretical_capacity);

    if (bottleneckCount > 0 || (takt > 0 && avgCycle >= takt * 0.95)) {
      const cycleRatio = takt > 0 ? avgCycle / takt : 0;
      actions.push(recommendation(
        `BOTTLENECK-${line.line_id}`,
        bottleneckCount > 1 || cycleRatio >= 1 ? "High" : "Medium",
        "Line bottleneck risk detected",
        `${lineName}: ${bottleneckCount} bottleneck station(s), avg cycle ${round(avgCycle, 2)}s vs takt ${round(takt, 2)}s.`,
        "Review station work content, rebalance operators, and validate standard work at constrained stations.",
        "Reduce cycle-time constraint and improve throughput stability.",
        "Manufacturing Engineering",
        "Cycle Time / Bottleneck",
        lineName,
      ));
    }

    if (downtimeMin >= 500) {
      actions.push(recommendation(
        `DOWNTIME-${line.line_id}`,
        priorityFor(downtimeMin, 750, 500),
        "High downtime concentration",
        `${lineName}: ${round(downtimeMin, 1)} downtime minutes in the last ${WINDOW_DAYS} days.`,
        "Run downtime root cause review, confirm maintenance triggers, and prioritize repeat-loss equipment checks.",
        "Recover operating minutes and reduce schedule interruptions.",
        "Maintenance",
        "Downtime",
        lineName,
      ));
    }

    if (capacity > 0 && produced > capacity) {
      const gap = produced - capacity;
      actions.push(recommendation(
        `CAPACITY-${line.line_id}`,
        priorityFor(gap / capacity, 0.05, 0.01),
        "Demand exceeds modeled capacity",
        `${lineName}: produced ${produced.toLocaleString()} units vs modeled capacity ${capacity.toLocaleString()} units.`,
        "Review overtime, shift coverage, and labor allocation for the constrained production window.",
        "Close capacity gap while protecting takt adherence.",
        "Production Planning",
        "Capacity",
        lineName,
      ));
    }
  });

  const defectTotal = intValue(qualityRow?.grand_total);
  const topDefectCount = intValue(qualityRow?.total_count);
  const topDefectShare = defectTotal > 0 ? topDefectCount / defectTotal : 0;
  if (topDefectShare > 0.4) {
    actions.push(recommendation(
      "QUALITY-PARETO-1",
      topDefectShare >= 0.55 ? "High" : "Medium",
      "Top defect category dominates quality losses",
      `${qualityRow.defect_category}: ${round(topDefectShare * 100, 1)}% of ${defectTotal.toLocaleString()} defects.`,
      "Run Pareto root cause review and add targeted quality inspection for the dominant category.",
      "Reduce recurring defects and improve first pass yield.",
      "Quality Engineering",
      "Defect Pareto",
      "All lines",
    ));
  }

  const day = shiftRows.filter((shift) => /^day/i.test(shift.shift_name));
  const night = shiftRows.filter((shift) => /^night/i.test(shift.shift_name));
  const weightedFpy = (rows) => {
    const produced = rows.reduce((sum, row) => sum + intValue(row.total_produced), 0);
    const good = rows.reduce((sum, row) => sum + intValue(row.total_good), 0);
    return produced ? good / produced : 0;
  };
  const dayFpy = weightedFpy(day);
  const nightFpy = weightedFpy(night);
  const fpyGap = dayFpy - nightFpy;
  if (dayFpy > 0 && nightFpy > 0 && fpyGap > 0.005) {
    actions.push(recommendation(
      "SHIFT-FPY-1",
      fpyGap >= 0.01 ? "High" : "Medium",
      "Night shift FPY trails day shift",
      `Night FPY ${round(nightFpy * 100, 2)}% vs day FPY ${round(dayFpy * 100, 2)}%, gap ${round(fpyGap * 100, 2)} percentage points.`,
      "Compare day/night process conditions, staffing patterns, material lots, and inspection handoff discipline.",
      "Lift night shift yield toward day shift baseline.",
      "Operations Leadership",
      "Shift FPY",
      "Night shifts",
    ));
  }

  return actions.sort((a, b) => {
    const rank = { High: 0, Medium: 1, Low: 2 };
    return rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id);
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const { start, end } = windowRange();

  try {
    const actions = await withClient(async (client) => {
      const lineResult = await queryWithClient(client, LINE_SQL, [start, end]);
      const qualityResult = await queryWithClient(client, QUALITY_SQL, [start, end]);
      const shiftResult = await queryWithClient(client, SHIFT_SQL, [start, end]);
      return buildRecommendations(lineResult.rows, qualityResult.rows[0], shiftResult.rows);
    });

    return sendJson(res, 200, {
      recommendations: actions,
      count: actions.length,
      window_days: WINDOW_DAYS,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return sendError(res, error);
  }
}
