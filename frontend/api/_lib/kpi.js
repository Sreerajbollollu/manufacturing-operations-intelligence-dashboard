export const PLANNED_MIN_PER_SLOT = 60;

export const OVERVIEW_LINE_SQL = `
WITH
line_prod AS (
    SELECT
        pe.line_id,
        SUM(pe.units_produced)  AS total_produced,
        SUM(pe.units_good)      AS total_good,
        SUM(pe.units_scrapped)  AS total_scrapped,
        COUNT(*) AS planned_slots
    FROM fact_production_events pe
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    GROUP BY pe.line_id
),
line_dt AS (
    SELECT line_id, SUM(duration_min) AS dt_min
    FROM fact_downtime_events
    WHERE start_time >= $1 AND start_time < $2
    GROUP BY line_id
),
line_cycle AS (
    SELECT ct.line_id, AVG(ct.cycle_time_sec) AS avg_cycle_sec
    FROM fact_station_cycle_times ct
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY ct.line_id
),
bn_stations AS (
    SELECT s.line_id
    FROM fact_station_cycle_times ct
    JOIN dim_stations s  ON s.station_id = ct.station_id
    JOIN dim_lines    dl ON dl.line_id   = s.line_id
    WHERE ct.event_timestamp >= $1 AND ct.event_timestamp < $2
    GROUP BY s.line_id, s.station_id, dl.takt_time_sec
    HAVING AVG(ct.cycle_time_sec) > dl.takt_time_sec
),
bn_flag AS (
    SELECT line_id, TRUE AS is_bottleneck FROM bn_stations GROUP BY line_id
)
SELECT
    l.line_id,
    l.line_name,
    l.takt_time_sec,
    COALESCE(lp.total_produced, 0)          AS total_produced,
    COALESCE(lp.total_good,     0)          AS total_good,
    COALESCE(lp.total_scrapped, 0)          AS total_scrapped,
    COALESCE(lp.planned_slots,  0) * ${PLANNED_MIN_PER_SLOT} AS planned_min,
    COALESCE(ld.dt_min, 0)                  AS dt_min,
    COALESCE(lc.avg_cycle_sec, 0)           AS avg_cycle_sec,
    COALESCE(bf.is_bottleneck, FALSE)       AS bottleneck_flag,
    CASE WHEN COALESCE(lp.planned_slots, 0) > 0
         THEN ROUND(
                (COALESCE(lp.planned_slots, 0) * ${PLANNED_MIN_PER_SLOT} - COALESCE(ld.dt_min, 0))::numeric
                / (COALESCE(lp.planned_slots, 0) * ${PLANNED_MIN_PER_SLOT})
              , 4)
         ELSE 0
    END AS avail_proxy,
    CASE WHEN COALESCE(lc.avg_cycle_sec, 0) > 0
         THEN LEAST(1.0, ROUND(l.takt_time_sec / lc.avg_cycle_sec, 4))
         ELSE 0
    END AS perf_proxy,
    CASE WHEN COALESCE(lp.total_produced, 0) > 0
         THEN ROUND(lp.total_good::numeric / lp.total_produced, 4)
         ELSE 0
    END AS qual_rate
FROM dim_lines l
LEFT JOIN line_prod  lp ON lp.line_id = l.line_id
LEFT JOIN line_dt    ld ON ld.line_id = l.line_id
LEFT JOIN line_cycle lc ON lc.line_id = l.line_id
LEFT JOIN bn_flag    bf ON bf.line_id = l.line_id
WHERE l.is_active = TRUE
ORDER BY l.line_id
`;

export const QUALITY_SUMMARY_SQL = `
SELECT
    COALESCE(SUM(quantity), 0) AS total_defects,
    (
        SELECT dc.defect_category
        FROM fact_quality_defects qd2
        JOIN dim_defect_codes dc ON dc.defect_code_id = qd2.defect_code_id
        WHERE qd2.event_timestamp >= $1 AND qd2.event_timestamp < $2
        GROUP BY dc.defect_category
        ORDER BY SUM(qd2.quantity) DESC
        LIMIT 1
    ) AS top_category
FROM fact_quality_defects
WHERE event_timestamp >= $1 AND event_timestamp < $2
`;

export const DOWNTIME_SUMMARY_SQL = `
SELECT
    COALESCE(ROUND(SUM(duration_min)::numeric, 1), 0) AS total_dt_min,
    COUNT(*)                                           AS event_count,
    (
        SELECT dr.reason_name
        FROM fact_downtime_events de2
        JOIN dim_downtime_reasons dr ON dr.reason_id = de2.reason_id
        WHERE de2.start_time >= $1 AND de2.start_time < $2
        GROUP BY dr.reason_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) AS top_reason
FROM fact_downtime_events
WHERE start_time >= $1 AND start_time < $2
`;

export function numberValue(value) {
  return value == null ? 0 : Number(value);
}

export function intValue(value) {
  return value == null ? 0 : Number.parseInt(value, 10);
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
