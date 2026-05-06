import { getWindow, optionalInt, query, sendError, sendJson } from "../_lib/db.js";
import { intValue, numberValue } from "../_lib/kpi.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const { start, end } = getWindow(req.query.days);
  const lineId = optionalInt(req.query.line_id);
  const lineFilter = lineId ? "AND qd.line_id = $3" : "";
  const params = lineId ? [start, end, lineId] : [start, end];

  const paretoSql = `
    WITH defect_summary AS (
        SELECT
            dc.defect_code_id,
            dc.defect_name,
            dc.defect_category,
            dc.severity,
            SUM(qd.quantity) AS total_count
        FROM fact_quality_defects qd
        JOIN dim_defect_codes dc ON dc.defect_code_id = qd.defect_code_id
        WHERE qd.event_timestamp >= $1 AND qd.event_timestamp < $2
        ${lineFilter}
        GROUP BY dc.defect_code_id, dc.defect_name, dc.defect_category, dc.severity
    ),
    ranked AS (
        SELECT *,
            SUM(total_count) OVER () AS grand_total,
            SUM(total_count) OVER (ORDER BY total_count DESC) AS running_total
        FROM defect_summary
    )
    SELECT
        defect_name, defect_category, severity,
        total_count, grand_total,
        ROUND(total_count::numeric / NULLIF(grand_total, 0), 4) AS pct_of_total,
        ROUND(running_total::numeric / NULLIF(grand_total, 0), 4) AS cumulative_pct
    FROM ranked
    ORDER BY total_count DESC
  `;

  const fpySql = `
    SELECT
        pe.line_id,
        l.line_name,
        SUM(pe.units_good)     AS total_good,
        SUM(pe.units_produced) AS total_produced,
        ROUND(SUM(pe.units_good)::numeric / NULLIF(SUM(pe.units_produced), 0), 4) AS fpy
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    ${lineId ? "AND pe.line_id = $3" : ""}
    GROUP BY pe.line_id, l.line_name
    ORDER BY fpy
  `;

  try {
    const [paretoResult, fpyResult] = await Promise.all([
      query(paretoSql, params),
      query(fpySql, params),
    ]);

    return sendJson(res, 200, {
      defect_pareto: paretoResult.rows.map((row) => ({
        defect_name: row.defect_name,
        defect_category: row.defect_category,
        severity: row.severity,
        total_count: intValue(row.total_count),
        grand_total: intValue(row.grand_total),
        pct_of_total: numberValue(row.pct_of_total),
        cumulative_pct: numberValue(row.cumulative_pct),
      })),
      fpy_by_line: fpyResult.rows.map((row) => ({
        line_id: row.line_id,
        line_name: row.line_name,
        fpy: numberValue(row.fpy),
        total_good: intValue(row.total_good),
        total_produced: intValue(row.total_produced),
      })),
    });
  } catch (error) {
    return sendError(res, error);
  }
}
