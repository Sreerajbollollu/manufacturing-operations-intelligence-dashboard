"""
KPI service helpers — Manufacturing Operations Intelligence Dashboard.

OEE proxy formula (project-level, not certified plant OEE):
  Availability  = operating_minutes / planned_minutes
  Performance   = takt_time_sec / avg_cycle_time_sec  (capped at 1.0)
  Quality       = units_good / units_produced
  OEE proxy     = Availability × Performance × Quality × 100
"""
from datetime import datetime, timedelta, timezone

PLANNED_MIN_PER_SLOT = 60  # one fact_production_events row = one active hour slot


def oee_window(days: int = 30) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    return end - timedelta(days=days), end


def compute_oee_proxy(
    avail_proxy: float,
    perf_proxy: float,
    quality: float,
) -> float:
    return round(avail_proxy * perf_proxy * quality * 100, 2)


# Reference SQL for per-line OEE used by the /lines endpoint.
LINE_OEE_SQL = """
WITH
line_prod AS (
    SELECT
        pe.line_id,
        l.line_name,
        l.takt_time_sec,
        SUM(pe.units_produced) AS total_produced,
        SUM(pe.units_good)     AS total_good,
        COUNT(*) AS planned_slots
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    GROUP BY pe.line_id, l.line_name, l.takt_time_sec
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
)
SELECT
    lp.line_id,
    lp.line_name,
    lp.takt_time_sec,
    lp.total_produced,
    lp.total_good,
    COALESCE(ld.dt_min, 0)       AS dt_min,
    COALESCE(lc.avg_cycle_sec,0) AS avg_cycle_sec,
    lp.planned_slots * {pms}     AS planned_min,
    -- availability proxy
    ROUND(
        (lp.planned_slots * {pms} - COALESCE(ld.dt_min, 0))::numeric
        / NULLIF(lp.planned_slots * {pms}, 0)
    , 4) AS avail_proxy,
    -- performance proxy (capped at 1)
    LEAST(1.0, ROUND(lp.takt_time_sec / NULLIF(lc.avg_cycle_sec, 0), 4))
             AS perf_proxy,
    -- quality
    ROUND(lp.total_good::numeric / NULLIF(lp.total_produced, 0), 4)
             AS qual_rate
FROM line_prod lp
LEFT JOIN line_dt    ld ON ld.line_id = lp.line_id
LEFT JOIN line_cycle lc ON lc.line_id = lp.line_id
ORDER BY lp.line_id
""".format(pms=PLANNED_MIN_PER_SLOT)
