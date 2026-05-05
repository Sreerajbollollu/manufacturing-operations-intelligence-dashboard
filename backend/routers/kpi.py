"""
KPI router — FactoryPulse AI.

OEE proxy disclaimer:
  This is a project-level proxy, NOT a certified plant OEE calculation.
  Availability  = operating_minutes / planned_minutes
                  where planned_minutes = COUNT(*) production event slots × 60 min.
  Performance   = takt_time_sec / avg_cycle_time_sec, capped at 1.0.
  Quality       = units_good / units_produced.
  OEE proxy     = Availability × Performance × Quality × 100.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta, timezone
import asyncpg
from database import get_db

router = APIRouter(prefix="/api/kpi", tags=["kpi"])

PLANNED_MIN_PER_SLOT = 60  # one fact_production_events row = one active hour slot


def _window(days: int = 30):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return start, end


# ── /overview ────────────────────────────────────────────────────────────────

_LINE_OEE_SQL = """
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
    COALESCE(lp.planned_slots,  0) * {pms} AS planned_min,
    COALESCE(ld.dt_min, 0)                  AS dt_min,
    COALESCE(lc.avg_cycle_sec, 0)           AS avg_cycle_sec,
    COALESCE(bf.is_bottleneck, FALSE)       AS bottleneck_flag,
    -- availabilityProxy
    CASE WHEN COALESCE(lp.planned_slots, 0) > 0
         THEN ROUND(
                (COALESCE(lp.planned_slots, 0) * {pms} - COALESCE(ld.dt_min, 0))::numeric
                / (COALESCE(lp.planned_slots, 0) * {pms})
              , 4)
         ELSE 0
    END AS avail_proxy,
    -- performanceProxy: takt / avg_cycle, capped at 1
    CASE WHEN COALESCE(lc.avg_cycle_sec, 0) > 0
         THEN LEAST(1.0, ROUND(l.takt_time_sec / lc.avg_cycle_sec, 4))
         ELSE 0
    END AS perf_proxy,
    -- quality
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
""".format(pms=PLANNED_MIN_PER_SLOT)

_QUALITY_SQL = """
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
"""

_DOWNTIME_SQL = """
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
"""


@router.get("/overview")
async def get_overview(
    days: int = Query(30, ge=1, le=365),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)

    line_rows = await db.fetch(_LINE_OEE_SQL, start, end)
    qual_row  = await db.fetchrow(_QUALITY_SQL, start, end)
    dt_row    = await db.fetchrow(_DOWNTIME_SQL, start, end)

    # ── aggregate production totals ──────────────────────────────────────────
    total_produced = sum(int(r["total_produced"]) for r in line_rows)
    total_good     = sum(int(r["total_good"])     for r in line_rows)
    total_scrapped = sum(int(r["total_scrapped"]) for r in line_rows)
    avg_fpy = round(total_good / total_produced * 100, 2) if total_produced else 0

    # weighted avg cycle time (weight by line throughput)
    weighted_cycle = sum(
        float(r["avg_cycle_sec"]) * int(r["total_produced"])
        for r in line_rows if float(r["avg_cycle_sec"]) > 0
    )
    weighted_prod = sum(
        int(r["total_produced"])
        for r in line_rows if float(r["avg_cycle_sec"]) > 0
    )
    avg_cycle_time = round(weighted_cycle / weighted_prod, 2) if weighted_prod else 0

    # throughput per operating hour (across all lines)
    total_op_min = sum(
        max(0.0, float(r["planned_min"]) - float(r["dt_min"]))
        for r in line_rows
    )
    throughput_per_hour = round(total_produced / (total_op_min / 60), 1) if total_op_min > 0 else 0

    # ── line summary ─────────────────────────────────────────────────────────
    active_alerts = 0
    line_summary = []
    for r in line_rows:
        avail  = float(r["avail_proxy"])
        perf   = float(r["perf_proxy"])
        qual   = float(r["qual_rate"])
        oee    = round(avail * perf * qual * 100, 2)
        if oee < 75:
            active_alerts += 1
        line_summary.append({
            "lineName":       r["line_name"],
            "oeeProxy":       oee,
            "throughput":     int(r["total_produced"]),
            "fpy":            round(qual * 100, 2),
            "avgCycleTime":   round(float(r["avg_cycle_sec"]), 2),
            "taktTime":       float(r["takt_time_sec"]),
            "bottleneckFlag": bool(r["bottleneck_flag"]),
        })

    # ── quality summary ──────────────────────────────────────────────────────
    total_defects = int(qual_row["total_defects"])
    defect_rate   = round(total_defects / total_produced * 100, 4) if total_produced else 0

    # ── downtime summary ─────────────────────────────────────────────────────
    total_dt_min   = float(dt_row["total_dt_min"])
    downtime_events = int(dt_row["event_count"])
    top_reason     = dt_row["top_reason"] or ""

    return {
        "totalProduced":     total_produced,
        "totalGood":         total_good,
        "totalScrapped":     total_scrapped,
        "avgFPY":            avg_fpy,
        "avgCycleTime":      avg_cycle_time,
        "throughputPerHour": throughput_per_hour,
        "linesActive":       len(line_rows),
        "activeAlerts":      active_alerts,
        "lineSummary":       line_summary,
        "qualitySummary": {
            "totalDefects":      total_defects,
            "defectRate":        defect_rate,
            "topDefectCategory": qual_row["top_category"] or "",
        },
        "downtimeSummary": {
            "totalDowntimeMinutes": total_dt_min,
            "downtimeEvents":       downtime_events,
            "topDowntimeReason":    top_reason,
        },
        "_meta": {
            "windowDays":   days,
            "windowStart":  start.isoformat(),
            "windowEnd":    end.isoformat(),
            "oeeNote": (
                "OEE values are project proxies. "
                "Availability = operating_min / planned_min (planned = COUNT(*) production event slots x 60 min). "
                "Performance = takt / avg_cycle_time, capped at 1. "
                "Not a certified plant OEE calculation."
            ),
        },
    }


# ── /lines ───────────────────────────────────────────────────────────────────

@router.get("/lines")
async def get_lines(
    days: int = Query(30),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)

    sql = """
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
        -- OEE components
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
    """
    rows = await db.fetch(sql, start, end)

    result = []
    for r in rows:
        avail = float(r["avail"] or 0)
        perf  = float(r["perf"]  or 0)
        qual  = float(r["quality"] or 0)
        result.append({
            "line_id":                r["line_id"],
            "line_name":              r["line_name"],
            "takt_time_sec":          float(r["takt_time_sec"]),
            "oee_proxy":              round(avail * perf * qual * 100, 2),
            "availability":           round(avail * 100, 2),
            "performance":            round(perf  * 100, 2),
            "quality":                round(qual  * 100, 2),
            "throughput":             int(r["total_produced"] or 0),
            "fpy":                    round(qual  * 100, 2),
            "avg_cycle_sec":          float(r["avg_cycle_sec"] or 0),
            "downtime_min":           float(r["dt_min"] or 0),
            "bottleneck_station_count": int(r["bottleneck_station_count"] or 0),
            "is_bottleneck":          int(r["bottleneck_station_count"] or 0) > 0,
        })
    return result


# ── /quality ─────────────────────────────────────────────────────────────────

@router.get("/quality")
async def get_quality(
    line_id: Optional[int] = Query(None),
    days: int = Query(30),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)
    line_filter = "AND qd.line_id = $3" if line_id else ""
    params = [start, end, line_id] if line_id else [start, end]

    pareto_sql = f"""
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
        {line_filter}
        GROUP BY dc.defect_code_id, dc.defect_name, dc.defect_category, dc.severity
    ),
    ranked AS (
        SELECT *,
            SUM(total_count) OVER ()                         AS grand_total,
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
    """
    pareto = await db.fetch(pareto_sql, *params)

    fpy_sql = f"""
    SELECT
        pe.line_id,
        l.line_name,
        SUM(pe.units_good)     AS total_good,
        SUM(pe.units_produced) AS total_produced,
        ROUND(SUM(pe.units_good)::numeric / NULLIF(SUM(pe.units_produced), 0), 4) AS fpy
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1 AND pe.event_timestamp < $2
    {"AND pe.line_id = $3" if line_id else ""}
    GROUP BY pe.line_id, l.line_name
    ORDER BY fpy
    """
    fpy = await db.fetch(fpy_sql, *params)

    return {
        "defect_pareto": [
            {
                "defect_name":    r["defect_name"],
                "defect_category": r["defect_category"],
                "severity":       r["severity"],
                "total_count":    int(r["total_count"]),
                "grand_total":    int(r["grand_total"]),
                "pct_of_total":   float(r["pct_of_total"] or 0),
                "cumulative_pct": float(r["cumulative_pct"] or 0),
            }
            for r in pareto
        ],
        "fpy_by_line": [
            {
                "line_id":        r["line_id"],
                "line_name":      r["line_name"],
                "fpy":            float(r["fpy"] or 0),
                "total_good":     int(r["total_good"]),
                "total_produced": int(r["total_produced"]),
            }
            for r in fpy
        ],
    }


# ── /downtime ─────────────────────────────────────────────────────────────────

@router.get("/downtime")
async def get_downtime(
    line_id: Optional[int] = Query(None),
    days: int = Query(30),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)
    line_filter = "AND de.line_id = $3" if line_id else ""
    params = [start, end, line_id] if line_id else [start, end]

    sql = f"""
    SELECT
        dl.line_name,
        dr.reason_name,
        COUNT(*)                                    AS events,
        ROUND(SUM(de.duration_min)::numeric, 1)    AS total_min,
        ROUND(AVG(de.duration_min)::numeric, 1)    AS avg_min
    FROM fact_downtime_events de
    JOIN dim_lines            dl ON dl.line_id  = de.line_id
    JOIN dim_downtime_reasons dr ON dr.reason_id = de.reason_id
    WHERE de.start_time >= $1 AND de.start_time < $2
    {line_filter}
    GROUP BY dl.line_name, dr.reason_name
    ORDER BY total_min DESC
    """
    rows = await db.fetch(sql, *params)

    totals_sql = f"""
    SELECT
        COUNT(*)                                 AS total_events,
        ROUND(SUM(duration_min)::numeric, 1)    AS total_min,
        ROUND(AVG(duration_min)::numeric, 1)    AS avg_min
    FROM fact_downtime_events
    WHERE start_time >= $1 AND start_time < $2
    {"AND line_id = $3" if line_id else ""}
    """
    totals = await db.fetchrow(totals_sql, *params)

    return {
        "summary": {
            "total_events": int(totals["total_events"]),
            "total_downtime_min": float(totals["total_min"] or 0),
            "avg_event_min": float(totals["avg_min"] or 0),
        },
        "by_reason": [
            {
                "line_name":   r["line_name"],
                "reason_name": r["reason_name"],
                "events":      int(r["events"]),
                "total_min":   float(r["total_min"] or 0),
                "avg_min":     float(r["avg_min"] or 0),
            }
            for r in rows
        ],
    }


# ── /capacity ─────────────────────────────────────────────────────────────────

@router.get("/capacity")
async def get_capacity(
    days: int = Query(30),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)

    sql = """
    WITH line_prod AS (
        SELECT
            pe.line_id,
            SUM(pe.units_produced) AS actual_output,
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
    )
    SELECT
        l.line_name,
        l.takt_time_sec,
        lp.actual_output,
        lp.planned_slots * 60                              AS planned_min,
        COALESCE(ld.dt_min, 0)                             AS dt_min,
        lp.planned_slots * 60 - COALESCE(ld.dt_min, 0)   AS operating_min,
        -- theoretical max at takt rate during operating time
        ROUND((lp.planned_slots * 60 - COALESCE(ld.dt_min, 0))
              * 60.0 / NULLIF(l.takt_time_sec, 0))         AS theoretical_max,
        -- capacity utilisation %
        ROUND(lp.actual_output::numeric
              / NULLIF(
                  (lp.planned_slots * 60 - COALESCE(ld.dt_min, 0))
                  * 60.0 / NULLIF(l.takt_time_sec, 0)
              , 0) * 100, 2)                               AS capacity_utilisation_pct
    FROM dim_lines l
    JOIN line_prod lp ON lp.line_id = l.line_id
    LEFT JOIN line_dt ld ON ld.line_id = l.line_id
    WHERE l.is_active = TRUE
    ORDER BY l.line_name
    """
    rows = await db.fetch(sql, start, end)

    return [
        {
            "line_name":              r["line_name"],
            "takt_time_sec":          float(r["takt_time_sec"]),
            "actual_output":          int(r["actual_output"] or 0),
            "planned_min":            int(r["planned_min"] or 0),
            "dt_min":                 float(r["dt_min"] or 0),
            "operating_min":          float(r["operating_min"] or 0),
            "theoretical_max":        int(r["theoretical_max"] or 0),
            "capacity_utilisation_pct": float(r["capacity_utilisation_pct"] or 0),
        }
        for r in rows
    ]


# ── /shifts ───────────────────────────────────────────────────────────────────

@router.get("/shifts")
async def get_shifts(
    days: int = Query(30),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)

    sql = """
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
        COALESCE(sd.dt_min,        0) AS dt_min,
        COALESCE(sd.incidents,     0) AS downtime_incidents,
        COALESCE(sdef.total_defects,0) AS total_defects,
        ROUND(sp.total_good::numeric / NULLIF(sp.total_produced, 0), 4) AS fpy
    FROM shift_prod sp
    LEFT JOIN shift_dt      sd   ON sd.shift_id   = sp.shift_id
    LEFT JOIN shift_defects sdef ON sdef.shift_id = sp.shift_id
    ORDER BY sp.shift_id
    """
    rows = await db.fetch(sql, start, end)
    return [
        {
            "shift_id":           r["shift_id"],
            "shift_name":         r["shift_name"],
            "throughput":         int(r["total_produced"] or 0),
            "fpy":                float(r["fpy"] or 0),
            "downtime_min":       float(r["dt_min"] or 0),
            "downtime_incidents": int(r["downtime_incidents"] or 0),
            "total_defects":      int(r["total_defects"] or 0),
        }
        for r in rows
    ]


# ── /hourly ───────────────────────────────────────────────────────────────────

@router.get("/hourly")
async def get_hourly(
    line_id: int = Query(...),
    days: int = Query(7),
    db: asyncpg.Connection = Depends(get_db),
):
    start, end = _window(days)

    sql = """
    SELECT
        pe.hour_bucket,
        LPAD(pe.hour_bucket::text, 2, '0') || ':00' AS hour_label,
        SUM(pe.units_produced)                       AS output,
        ROUND(3600.0 / NULLIF(l.takt_time_sec, 0))  AS target
    FROM fact_production_events pe
    JOIN dim_lines l ON l.line_id = pe.line_id
    WHERE pe.event_timestamp >= $1
      AND pe.event_timestamp < $2
      AND pe.line_id = $3
    GROUP BY pe.hour_bucket, l.takt_time_sec
    ORDER BY pe.hour_bucket
    """
    rows = await db.fetch(sql, start, end, line_id)
    return [
        {
            "hour":   int(r["hour_bucket"]),
            "label":  r["hour_label"],
            "output": int(r["output"] or 0),
            "target": int(r["target"] or 0),
        }
        for r in rows
    ]
