import { getWindow, query, sendError, sendJson } from "../_lib/db.js";
import { intValue, numberValue, round } from "../_lib/kpi.js";

const SQL = `
WITH line_prod AS (
    SELECT
        pe.line_id,
        l.line_name,
        l.takt_time_sec,
        l.station_count,
        SUM(pe.units_produced)  AS total_produced,
        SUM(pe.units_good)      AS total_good,
        COUNT(*) * 60 AS planned_min
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    GROUP BY pe.line_id, l.line_name, l.takt_time_sec, l.station_count
),
line_dt AS (
    SELECT line_id, SUM(duration_min) AS dt_min
    FROM fact_downtime_events
    WHERE start_time >= $1 AND start_time < $2
    GROUP BY line_id
),
bn AS (
    SELECT s.line_id, COUNT(*) AS bn_count
    FROM fact_station_cycle_times ct
    JOIN dim_stations s  ON s.station_id = ct.station_id
    JOIN dim_lines    dl ON dl.line_id   = s.line_id
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY s.line_id, s.station_id, dl.takt_time_sec
    HAVING AVG(ct.cycle_time_sec) > dl.takt_time_sec
),
bn_agg AS (SELECT line_id, COUNT(*) AS bn_count FROM bn GROUP BY line_id),
avg_cycle AS (
    SELECT ct.line_id, ROUND(AVG(ct.cycle_time_sec)::numeric, 2) AS avg_cycle_sec
    FROM fact_station_cycle_times ct
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY ct.line_id
)
SELECT
    lp.line_id,
    lp.line_name,
    lp.takt_time_sec,
    lp.total_produced,
    lp.total_good,
    lp.planned_min,
    COALESCE(ld.dt_min, 0) AS dt_min,
    COALESCE(ac.avg_cycle_sec, 0) AS avg_cycle_sec,
    COALESCE(ba.bn_count, 0) AS bottleneck_station_count,
    ROUND((lp.planned_min - COALESCE(ld.dt_min, 0))::numeric / NULLIF(lp.planned_min, 0), 4)
        AS avail,
    LEAST(1.0, ROUND(lp.takt_time_sec / NULLIF(ac.avg_cycle_sec, 0), 4))
        AS perf,
    ROUND(lp.total_good::numeric / NULLIF(lp.total_produced, 0), 4)
        AS quality
FROM line_prod lp
LEFT JOIN line_dt   ld ON ld.line_id = lp.line_id
LEFT JOIN avg_cycle ac ON ac.line_id = lp.line_id
LEFT JOIN bn_agg    ba ON ba.line_id = lp.line_id
ORDER BY lp.line_id
`;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const { start, end } = getWindow(req.query.days);

  try {
    const { rows } = await query(SQL, [start, end]);
    return sendJson(
      res,
      200,
      rows.map((row) => {
        const avail = numberValue(row.avail);
        const perf = numberValue(row.perf);
        const qual = numberValue(row.quality);
        const bottleneckCount = intValue(row.bottleneck_station_count);

        return {
          line_id: row.line_id,
          line_name: row.line_name,
          takt_time_sec: numberValue(row.takt_time_sec),
          oee_proxy: round(avail * perf * qual * 100, 2),
          availability: round(avail * 100, 2),
          performance: round(perf * 100, 2),
          quality: round(qual * 100, 2),
          throughput: intValue(row.total_produced),
          fpy: round(qual * 100, 2),
          avg_cycle_sec: numberValue(row.avg_cycle_sec),
          downtime_min: numberValue(row.dt_min),
          bottleneck_station_count: bottleneckCount,
          is_bottleneck: bottleneckCount > 0,
        };
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
}
