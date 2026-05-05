-- ============================================
-- ANALYTICS VIEWS
-- ============================================

CREATE MATERIALIZED VIEW kpi_hourly_line_summary AS
SELECT
    pe.line_id,
    pe.shift_id,
    pe.hour_bucket,
    date_trunc('hour', pe.event_timestamp) AS hour_start,
    SUM(pe.units_produced) AS total_produced,
    SUM(pe.units_good) AS total_good,
    SUM(pe.units_scrapped) AS total_scrapped,
    CASE WHEN SUM(pe.units_produced) > 0
         THEN ROUND(SUM(pe.units_good)::numeric / SUM(pe.units_produced), 4)
         ELSE NULL END AS quality_rate,
    COUNT(*) AS event_count
FROM fact_production_events pe
GROUP BY pe.line_id, pe.shift_id, pe.hour_bucket, date_trunc('hour', pe.event_timestamp);

CREATE UNIQUE INDEX idx_kpi_hourly ON kpi_hourly_line_summary(line_id, hour_start);

-- OEE view (requires planned_hours parameter — used as a base query template)
CREATE VIEW vw_oee_by_line AS
SELECT
    l.line_id,
    l.line_name,
    l.takt_time_sec,
    SUM(pe.units_produced) AS total_produced,
    SUM(pe.units_good) AS total_good,
    COALESCE(SUM(de.duration_min), 0) AS total_downtime_min
FROM dim_lines l
LEFT JOIN fact_production_events pe ON pe.line_id = l.line_id
LEFT JOIN fact_downtime_events de ON de.line_id = l.line_id
GROUP BY l.line_id, l.line_name, l.takt_time_sec;

-- Defect pareto view
CREATE VIEW vw_defect_pareto AS
WITH defect_summary AS (
    SELECT
        dc.defect_name,
        dc.defect_category,
        dc.severity,
        SUM(qd.quantity) AS total_count
    FROM fact_quality_defects qd
    JOIN dim_defect_codes dc ON dc.defect_code_id = qd.defect_code_id
    GROUP BY dc.defect_name, dc.defect_category, dc.severity
),
ranked AS (
    SELECT *,
        SUM(total_count) OVER () AS grand_total,
        SUM(total_count) OVER (ORDER BY total_count DESC) AS running_total
    FROM defect_summary
)
SELECT
    defect_name,
    defect_category,
    severity,
    total_count,
    ROUND(total_count::numeric / NULLIF(grand_total, 0), 4) AS pct_of_total,
    ROUND(running_total::numeric / NULLIF(grand_total, 0), 4) AS cumulative_pct
FROM ranked
ORDER BY total_count DESC;
