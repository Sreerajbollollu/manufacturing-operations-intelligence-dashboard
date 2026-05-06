import { getWindow, optionalInt, query, sendError, sendJson } from "../_lib/db.js";
import { intValue } from "../_lib/kpi.js";

const SQL = `
SELECT
    pe.hour_bucket,
    LPAD(pe.hour_bucket::text, 2, '0') || ':00' AS hour_label,
    SUM(pe.units_produced) AS output,
    ROUND(3600.0 / NULLIF(l.takt_time_sec, 0)) AS target
FROM fact_production_events pe
JOIN dim_lines l ON l.line_id = pe.line_id
WHERE pe.event_timestamp >= $1
  AND pe.event_timestamp < $2
  AND pe.line_id = $3
GROUP BY pe.hour_bucket, l.takt_time_sec
ORDER BY pe.hour_bucket
`;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const lineId = optionalInt(req.query.line_id);
  if (!lineId) return sendJson(res, 400, { detail: "line_id is required" });

  const { start, end } = getWindow(req.query.days, 7);

  try {
    const { rows } = await query(SQL, [start, end, lineId]);
    return sendJson(
      res,
      200,
      rows.map((row) => ({
        hour: intValue(row.hour_bucket),
        label: row.hour_label,
        output: intValue(row.output),
        target: intValue(row.target),
      })),
    );
  } catch (error) {
    return sendError(res, error);
  }
}
