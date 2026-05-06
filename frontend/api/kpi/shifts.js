import { getWindow, query, sendError, sendJson } from "../_lib/db.js";
import { intValue, numberValue } from "../_lib/kpi.js";

const SQL = `
WITH shift_prod AS (
    SELECT
        pe.shift_id,
        s.shift_name,
        SUM(pe.units_produced) AS total_produced,
        SUM(pe.units_good)     AS total_good
    FROM fact_production_events pe
    JOIN dim_shifts s ON s.shift_id = pe.shift_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    GROUP BY pe.shift_id, s.shift_name
),
shift_dt AS (
    SELECT shift_id,
           SUM(duration_min) AS dt_min,
           COUNT(*)          AS incidents
    FROM fact_downtime_events
    WHERE start_time >= $1 AND start_time < $2
    GROUP BY shift_id
),
shift_defects AS (
    SELECT shift_id, SUM(quantity) AS total_defects
    FROM fact_quality_defects
    WHERE event_timestamp >= $1 AND event_timestamp < $2
    GROUP BY shift_id
)
SELECT
    sp.shift_id,
    sp.shift_name,
    sp.total_produced,
    sp.total_good,
    COALESCE(sd.dt_min, 0) AS dt_min,
    COALESCE(sd.incidents, 0) AS downtime_incidents,
    COALESCE(sdef.total_defects, 0) AS total_defects,
    ROUND(sp.total_good::numeric / NULLIF(sp.total_produced, 0), 4) AS fpy
FROM shift_prod sp
LEFT JOIN shift_dt      sd   ON sd.shift_id   = sp.shift_id
LEFT JOIN shift_defects sdef ON sdef.shift_id = sp.shift_id
ORDER BY sp.shift_id
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
      rows.map((row) => ({
        shift_id: row.shift_id,
        shift_name: row.shift_name,
        throughput: intValue(row.total_produced),
        fpy: numberValue(row.fpy),
        downtime_min: numberValue(row.dt_min),
        downtime_incidents: intValue(row.downtime_incidents),
        total_defects: intValue(row.total_defects),
      })),
    );
  } catch (error) {
    return sendError(res, error);
  }
}
