"""
Manufacturing Operations Intelligence Dashboard — Seed Data Generator
Generates 30 days of causally consistent manufacturing data.
Seed: random.Random(42) for reproducibility.
"""

import os
import sys
import math
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import asyncpg
import asyncio

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

DATABASE_URL = os.getenv("DATABASE_URL", "")
RNG = random.Random(42)

# ── Reference data (mirrors what's in dim_ tables) ──────────────────────────

LINES = [
    {"line_id": 1, "line_name": "SMT-1",  "line_type": "smt",           "takt": 15.0},
    {"line_id": 2, "line_name": "SMT-2",  "line_type": "smt",           "takt": 15.0},
    {"line_id": 3, "line_name": "FA-1",   "line_type": "final_assembly", "takt": 24.0},
    {"line_id": 4, "line_name": "FA-2",   "line_type": "final_assembly", "takt": 24.0},
    {"line_id": 5, "line_name": "FA-3",   "line_type": "final_assembly", "takt": 24.0},
    {"line_id": 6, "line_name": "Pack-1", "line_type": "packing",        "takt": 12.0},
]

# station_id ranges from DB insertion order
STATIONS = {
    1: [  # SMT-1
        {"station_id": 1,  "name": "Paste Print",    "seq": 1, "ideal": 12.0},
        {"station_id": 2,  "name": "Pick & Place 1", "seq": 2, "ideal": 14.0},
        {"station_id": 3,  "name": "Pick & Place 2", "seq": 3, "ideal": 13.0},
        {"station_id": 4,  "name": "Reflow Oven",    "seq": 4, "ideal": 11.0},
        {"station_id": 5,  "name": "AOI Inspection", "seq": 5, "ideal": 15.0},
        {"station_id": 6,  "name": "Touch-up",       "seq": 6, "ideal": 10.0},
    ],
    2: [  # SMT-2
        {"station_id": 7,  "name": "Paste Print",    "seq": 1, "ideal": 12.0},
        {"station_id": 8,  "name": "Pick & Place 1", "seq": 2, "ideal": 14.0},
        {"station_id": 9,  "name": "Pick & Place 2", "seq": 3, "ideal": 13.0},
        {"station_id": 10, "name": "Reflow Oven",    "seq": 4, "ideal": 11.0},
        {"station_id": 11, "name": "AOI Inspection", "seq": 5, "ideal": 15.0},
        {"station_id": 12, "name": "Touch-up",       "seq": 6, "ideal": 10.0},
    ],
    3: [  # FA-1
        {"station_id": 13, "name": "Load PCB",       "seq": 1, "ideal": 18.0},
        {"station_id": 14, "name": "Apply Thermal",  "seq": 2, "ideal": 20.0},
        {"station_id": 15, "name": "Mount Heatsink", "seq": 3, "ideal": 22.0},
        {"station_id": 16, "name": "Secure Frame",   "seq": 4, "ideal": 19.0},
        {"station_id": 17, "name": "Cable Connect",  "seq": 5, "ideal": 21.0},
        {"station_id": 18, "name": "Flash FW",       "seq": 6, "ideal": 16.0},
        {"station_id": 19, "name": "Func Test",      "seq": 7, "ideal": 25.0},
        {"station_id": 20, "name": "Final QC",       "seq": 8, "ideal": 14.0},
    ],
    4: [  # FA-2
        {"station_id": 21, "name": "Load PCB",       "seq": 1, "ideal": 18.0},
        {"station_id": 22, "name": "Apply Thermal",  "seq": 2, "ideal": 20.0},
        {"station_id": 23, "name": "Mount Heatsink", "seq": 3, "ideal": 22.0},
        {"station_id": 24, "name": "Secure Frame",   "seq": 4, "ideal": 19.0},
        {"station_id": 25, "name": "Cable Connect",  "seq": 5, "ideal": 21.0},
        {"station_id": 26, "name": "Flash FW",       "seq": 6, "ideal": 16.0},
        {"station_id": 27, "name": "Func Test",      "seq": 7, "ideal": 25.0},
        {"station_id": 28, "name": "Final QC",       "seq": 8, "ideal": 14.0},
    ],
    5: [  # FA-3 (newest line, runs closer to ideal)
        {"station_id": 29, "name": "Load PCB",       "seq": 1, "ideal": 18.0},
        {"station_id": 30, "name": "Apply Thermal",  "seq": 2, "ideal": 20.0},
        {"station_id": 31, "name": "Mount Heatsink", "seq": 3, "ideal": 22.0},
        {"station_id": 32, "name": "Secure Frame",   "seq": 4, "ideal": 19.0},
        {"station_id": 33, "name": "Cable Connect",  "seq": 5, "ideal": 21.0},
        {"station_id": 34, "name": "Flash FW",       "seq": 6, "ideal": 16.0},
        {"station_id": 35, "name": "Func Test",      "seq": 7, "ideal": 25.0},
        {"station_id": 36, "name": "Final QC",       "seq": 8, "ideal": 14.0},
    ],
    6: [  # Pack-1
        {"station_id": 37, "name": "Visual Inspect", "seq": 1, "ideal": 10.0},
        {"station_id": 38, "name": "Label & Scan",   "seq": 2, "ideal":  8.0},
        {"station_id": 39, "name": "Box Pack",       "seq": 3, "ideal": 11.0},
        {"station_id": 40, "name": "Palletize",      "seq": 4, "ideal":  9.0},
    ],
}

# Older lines run slower
LINE_DRIFT = {1: 1.05, 2: 1.08, 3: 1.07, 4: 1.06, 5: 1.00, 6: 1.04}

SHIFTS = [
    {"shift_id": 1, "name": "Day A",   "start_h": 6,  "end_h": 14, "is_night": False},
    {"shift_id": 2, "name": "Day B",   "start_h": 14, "end_h": 22, "is_night": False},
    {"shift_id": 3, "name": "Night A", "start_h": 22, "end_h": 30, "is_night": True},
    {"shift_id": 4, "name": "Night B", "start_h": 22, "end_h": 30, "is_night": True},
]

DEFECT_CODES = [
    {"id": 1, "weight": 0.35},  # Dimensional Variance
    {"id": 2, "weight": 0.25},  # Surface Scratches
    {"id": 3, "weight": 0.18},  # Assembly Misalignment
    {"id": 4, "weight": 0.08},  # Material Flaw
    {"id": 5, "weight": 0.04},  # Labeling Error
    {"id": 6, "weight": 0.10},  # Solder Bridge
]

DOWNTIME_REASONS = [
    {"id": 1, "is_planned": True,  "min_dur": 10, "max_dur": 25},   # Tool Change
    {"id": 2, "is_planned": False, "min_dur": 20, "max_dur": 60},   # Material Shortage
    {"id": 3, "is_planned": False, "min_dur": 15, "max_dur": 90},   # Equipment Failure
    {"id": 4, "is_planned": True,  "min_dur": 10, "max_dur": 25},   # Changeover
    {"id": 5, "is_planned": False, "min_dur": 10, "max_dur": 30},   # Quality Hold
    {"id": 6, "is_planned": True,  "min_dur": 15, "max_dur": 30},   # Preventive Maint
    {"id": 7, "is_planned": True,  "min_dur": 10, "max_dur": 20},   # Operator Break
]


def gauss(mu, sigma):
    return RNG.gauss(mu, sigma)


def weighted_choice(items):
    weights = [i["weight"] for i in items]
    total = sum(weights)
    r = RNG.random() * total
    cumulative = 0
    for item in items:
        cumulative += item["weight"]
        if r <= cumulative:
            return item
    return items[-1]


def generate_cycle_times(line_id, shift, is_weekend, day_of_week):
    """Generate 10 cycle time samples per station per shift."""
    drift = LINE_DRIFT[line_id]
    night_factor = 1.05 if shift["is_night"] else 1.0
    weekend_factor = 1.03 if is_weekend else 1.0
    # FA-3 runs closer to ideal
    fa3_factor = 0.97 if line_id == 5 else 1.0

    records = []
    for station in STATIONS[line_id]:
        base = station["ideal"] * drift * fa3_factor
        for sample in range(10):
            ct = base * night_factor * weekend_factor
            ct += gauss(0, base * 0.08)  # σ = 8%
            ct = max(0.1, min(ct, station["ideal"] * 2.0))
            records.append({
                "station_id": station["station_id"],
                "cycle_time_sec": round(ct, 2),
            })
    return records


def get_bottleneck_cycle(line_id, shift, is_weekend):
    """Get average bottleneck cycle time for output calculation."""
    drift = LINE_DRIFT[line_id]
    night_factor = 1.05 if shift["is_night"] else 1.0
    weekend_factor = 1.03 if is_weekend else 1.0
    fa3_factor = 0.97 if line_id == 5 else 1.0

    max_avg = 0.0
    for station in STATIONS[line_id]:
        base = station["ideal"] * drift * fa3_factor * night_factor * weekend_factor
        max_avg = max(max_avg, base)
    return max_avg


def simulate_downtime(line_id, shift, day_date, is_weekend):
    """Return list of downtime events for a line-shift."""
    events = []
    base_prob_1 = 0.25 if shift["is_night"] else 0.15
    base_prob_2 = 0.10 if shift["is_night"] else 0.05
    if is_weekend:
        base_prob_1 += 0.10
        base_prob_2 += 0.05

    num_events = 0
    r = RNG.random()
    if r < base_prob_2:
        num_events = 2
    elif r < base_prob_1 + base_prob_2:
        num_events = 1

    for _ in range(num_events):
        reason = DOWNTIME_REASONS[RNG.randint(0, len(DOWNTIME_REASONS) - 1)]
        dur_min = RNG.uniform(reason["min_dur"], reason["max_dur"])

        # Pick hour within shift
        shift_hours = list(range(8))
        hour_offset = RNG.choice(shift_hours)
        start_dt = day_date.replace(
            hour=shift["start_h"] % 24,
            minute=RNG.randint(0, 59),
            second=0,
            microsecond=0,
        ) + timedelta(hours=hour_offset)
        end_dt = start_dt + timedelta(minutes=dur_min)

        # Clamp to shift end
        shift_end = day_date.replace(
            hour=shift["end_h"] % 24,
            minute=0,
            second=0,
            microsecond=0,
        )
        if shift["end_h"] >= 24:
            shift_end += timedelta(days=1)
        if end_dt > shift_end:
            end_dt = shift_end - timedelta(minutes=1)
        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(minutes=5)

        events.append({
            "line_id": line_id,
            "shift_id": shift["shift_id"],
            "reason_id": reason["id"],
            "start_time": start_dt,
            "end_time": end_dt,
            "duration_min": (end_dt - start_dt).total_seconds() / 60,
        })

    return events


def simulate_hour(line_id, shift, hour, day_date, downtime_min_this_hour, is_weekend, is_shift_start, is_shift_end):
    """Simulate production for one line-hour. Returns (prod_event, defects)."""
    planned_min = 60.0
    operating_min = max(0.0, planned_min - downtime_min_this_hour)

    if operating_min < 2:
        # No meaningful production
        return None, []

    bottleneck = get_bottleneck_cycle(line_id, shift, is_weekend)
    max_units = math.floor(operating_min * 60 / bottleneck)

    # Efficiency factor
    if shift["is_night"]:
        eff = RNG.uniform(0.80, 0.90)
    else:
        eff = RNG.uniform(0.88, 0.96)

    if is_weekend:
        eff *= 0.92
    if is_shift_start:
        eff *= 0.85
    if is_shift_end:
        eff *= 0.90

    units_produced = max(0, math.floor(max_units * eff))

    # Defect rate
    base_rate = 0.015
    if shift["is_night"]:
        base_rate *= 1.35
    if is_weekend:
        base_rate *= 1.15
    takt = next(l["takt"] for l in LINES if l["line_id"] == line_id)
    if bottleneck > takt:
        base_rate *= 1.25
    if is_shift_start or is_shift_end:
        base_rate *= 1.40

    defect_count = math.floor(units_produced * base_rate)
    units_good = max(0, units_produced - defect_count)
    units_scrapped = math.floor(defect_count * 0.3)

    # Safety check
    assert units_good <= units_produced, "CONSTRAINT VIOLATION: units_good > units_produced"

    hour_ts = day_date.replace(hour=hour % 24, minute=0, second=0, microsecond=0)
    if hour >= 24:
        hour_ts += timedelta(days=1)

    prod_event = {
        "line_id": line_id,
        "shift_id": shift["shift_id"],
        "event_timestamp": hour_ts,
        "hour_bucket": hour % 24,
        "units_produced": units_produced,
        "units_good": units_good,
        "units_scrapped": units_scrapped,
    }

    # Generate defect records
    defect_records = []
    stations_for_line = STATIONS[line_id]
    bottleneck_station_ids = {
        s["station_id"] for s in stations_for_line if s["ideal"] * LINE_DRIFT[line_id] > takt
    }

    for _ in range(defect_count):
        code = weighted_choice(DEFECT_CODES)
        # Prefer bottleneck or manual stations
        if bottleneck_station_ids and RNG.random() < 0.4:
            station = RNG.choice([s for s in stations_for_line if s["station_id"] in bottleneck_station_ids])
        else:
            station = RNG.choice(stations_for_line)

        defect_ts = hour_ts + timedelta(minutes=RNG.randint(0, 59))
        defect_records.append({
            "line_id": line_id,
            "station_id": station["station_id"],
            "shift_id": shift["shift_id"],
            "defect_code_id": code["id"],
            "event_timestamp": defect_ts,
            "quantity": 1,
            "is_reworkable": RNG.random() < 0.70,
        })

    return prod_event, defect_records


async def run(db: asyncpg.Connection):
    print("=" * 60)
    print("Manufacturing Operations Intelligence Dashboard — Seed Data Generator")
    print("=" * 60)

    # 30-day window ending today at midnight UTC
    end_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=30)

    all_prod = []
    all_cycles = []
    all_defects = []
    all_downtime = []
    violations = 0

    for day_offset in range(30):
        day_date = start_date + timedelta(days=day_offset)
        is_weekend = day_date.weekday() >= 5
        # Week A (0-13) uses shifts 1,3; Week B (14-29) uses shifts 2,4
        if day_offset < 14:
            day_shift = SHIFTS[0]   # Day A
            night_shift = SHIFTS[2]  # Night A
        else:
            day_shift = SHIFTS[1]   # Day B
            night_shift = SHIFTS[3]  # Night B

        active_shifts = [day_shift, night_shift]

        for shift in active_shifts:
            shift_hours = list(range(shift["start_h"], shift["end_h"]))  # 8 hours

            for line in LINES:
                lid = line["line_id"]

                # 1. Simulate downtime for entire shift
                dt_events = simulate_downtime(lid, shift, day_date, is_weekend)
                all_downtime.extend(dt_events)

                # Build downtime-per-hour map
                dt_by_hour = {}
                for dte in dt_events:
                    s_h = dte["start_time"].hour
                    e_h = dte["end_time"].hour
                    if s_h == e_h:
                        dt_by_hour[s_h] = dt_by_hour.get(s_h, 0) + dte["duration_min"]
                    else:
                        for h in range(s_h, e_h + 1):
                            dt_by_hour[h % 24] = dt_by_hour.get(h % 24, 0) + min(60, dte["duration_min"])

                # 2. Generate cycle times for this line-shift
                ct_records = generate_cycle_times(lid, shift, is_weekend, day_date.weekday())
                for ct in ct_records:
                    h = RNG.choice(shift_hours)
                    ct_ts = day_date.replace(hour=h % 24, minute=RNG.randint(0, 59), second=0, microsecond=0)
                    if h >= 24:
                        ct_ts += timedelta(days=1)
                    all_cycles.append({
                        "station_id": ct["station_id"],
                        "line_id": lid,
                        "shift_id": shift["shift_id"],
                        "event_timestamp": ct_ts,
                        "cycle_time_sec": ct["cycle_time_sec"],
                        "operator_count": 1,
                    })

                # 3. Simulate each hour
                for i, hour in enumerate(shift_hours):
                    is_start = i == 0
                    is_end = i == len(shift_hours) - 1
                    dt_min = dt_by_hour.get(hour % 24, 0)

                    prod, defects = simulate_hour(
                        lid, shift, hour, day_date, dt_min,
                        is_weekend, is_start, is_end,
                    )
                    if prod:
                        # Validate
                        if prod["units_good"] > prod["units_produced"]:
                            violations += 1
                            prod["units_good"] = prod["units_produced"]
                        all_prod.append(prod)
                        all_defects.extend(defects)

    print(f"\nGenerated (pre-insert validation):")
    print(f"  Production events : {len(all_prod):,}")
    print(f"  Cycle time records: {len(all_cycles):,}")
    print(f"  Defect records    : {len(all_defects):,}")
    print(f"  Downtime events   : {len(all_downtime):,}")
    print(f"  Violations        : {violations}")
    assert violations == 0, "Data consistency violations detected — aborting"

    # ── Insert in batches ──────────────────────────────────────────────────

    print("\nInserting production events...")
    batch = 500
    for i in range(0, len(all_prod), batch):
        chunk = all_prod[i:i+batch]
        await db.executemany(
            """INSERT INTO fact_production_events
               (line_id, shift_id, event_timestamp, hour_bucket, units_produced, units_good, units_scrapped)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            [(r["line_id"], r["shift_id"], r["event_timestamp"], r["hour_bucket"],
              r["units_produced"], r["units_good"], r["units_scrapped"]) for r in chunk],
        )

    print("Inserting cycle times...")
    for i in range(0, len(all_cycles), batch):
        chunk = all_cycles[i:i+batch]
        await db.executemany(
            """INSERT INTO fact_station_cycle_times
               (station_id, line_id, shift_id, event_timestamp, cycle_time_sec, operator_count)
               VALUES ($1,$2,$3,$4,$5,$6)""",
            [(r["station_id"], r["line_id"], r["shift_id"], r["event_timestamp"],
              r["cycle_time_sec"], r["operator_count"]) for r in chunk],
        )

    print("Inserting defects...")
    for i in range(0, len(all_defects), batch):
        chunk = all_defects[i:i+batch]
        await db.executemany(
            """INSERT INTO fact_quality_defects
               (line_id, station_id, shift_id, defect_code_id, event_timestamp, quantity, is_reworkable)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            [(r["line_id"], r["station_id"], r["shift_id"], r["defect_code_id"],
              r["event_timestamp"], r["quantity"], r["is_reworkable"]) for r in chunk],
        )

    print("Inserting downtime events...")
    for i in range(0, len(all_downtime), batch):
        chunk = all_downtime[i:i+batch]
        await db.executemany(
            """INSERT INTO fact_downtime_events
               (line_id, shift_id, reason_id, start_time, end_time)
               VALUES ($1,$2,$3,$4,$5)""",
            [(r["line_id"], r["shift_id"], r["reason_id"], r["start_time"], r["end_time"]) for r in chunk],
        )

    # ── Validation summary ─────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)

    counts = await db.fetchrow("""
        SELECT
            (SELECT COUNT(*) FROM fact_production_events)  AS prod_count,
            (SELECT COUNT(*) FROM fact_station_cycle_times) AS cycle_count,
            (SELECT COUNT(*) FROM fact_quality_defects)     AS defect_count,
            (SELECT COUNT(*) FROM fact_downtime_events)     AS downtime_count
    """)
    print(f"  fact_production_events   : {counts['prod_count']:,}")
    print(f"  fact_station_cycle_times : {counts['cycle_count']:,}")
    print(f"  fact_quality_defects     : {counts['defect_count']:,}")
    print(f"  fact_downtime_events     : {counts['downtime_count']:,}")

    oee_row = await db.fetchrow("""
        WITH lp AS (
            SELECT pe.line_id, l.takt_time_sec,
                   SUM(pe.units_produced) tp, SUM(pe.units_good) tg,
                   COUNT(DISTINCT date_trunc('hour', pe.event_timestamp)) ah
            FROM fact_production_events pe
            JOIN dim_lines l ON l.line_id = pe.line_id
            GROUP BY pe.line_id, l.takt_time_sec
        ),
        ld AS (SELECT line_id, SUM(duration_min) dtm FROM fact_downtime_events GROUP BY line_id)
        SELECT
            ROUND(AVG(
                (lp.ah*60 - COALESCE(ld.dtm,0)) / NULLIF(lp.ah*60,0)
                * CASE WHEN (lp.ah*60 - COALESCE(ld.dtm,0)) > 0
                  THEN (lp.takt_time_sec/60.0 * lp.tp) / (lp.ah*60 - COALESCE(ld.dtm,0))
                  ELSE 0 END
                * lp.tg::numeric / NULLIF(lp.tp,0)
            ) * 100, 1) AS avg_oee,
            ROUND(SUM(lp.tg)::numeric / NULLIF(SUM(lp.tp),0) * 100, 1) AS avg_fpy
        FROM lp LEFT JOIN ld ON ld.line_id = lp.line_id
    """)
    print(f"  Average OEE              : {oee_row['avg_oee']}%")
    print(f"  Average FPY              : {oee_row['avg_fpy']}%")

    bn_count = await db.fetchval("""
        SELECT COUNT(DISTINCT s.station_id)
        FROM fact_station_cycle_times ct
        JOIN dim_stations s ON s.station_id = ct.station_id
        JOIN dim_lines l ON l.line_id = s.line_id
        GROUP BY s.station_id, l.takt_time_sec
        HAVING AVG(ct.cycle_time_sec) > l.takt_time_sec
    """)
    print(f"  Bottleneck stations      : {bn_count}")

    cv = await db.fetchval("SELECT COUNT(*) FROM fact_production_events WHERE units_good > units_produced")
    print(f"  Consistency violations   : {cv}")
    print("=" * 60)
    if cv > 0:
        print("WARNING: consistency violations found in DB!")
    else:
        print("✓ All consistency checks passed")
    print("=" * 60)


async def main():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await run(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
