"""
FactoryPulse AI — SQL Seed Generator
Generates INSERT SQL for all fact tables. No DB connection required.
Run: python3 generate_sql.py > seed_output.sql
"""

import math
import random
from datetime import datetime, timedelta, timezone

RNG = random.Random(42)

LINES = [
    {"line_id": 1, "line_name": "SMT-1",  "takt": 15.0},
    {"line_id": 2, "line_name": "SMT-2",  "takt": 15.0},
    {"line_id": 3, "line_name": "FA-1",   "takt": 24.0},
    {"line_id": 4, "line_name": "FA-2",   "takt": 24.0},
    {"line_id": 5, "line_name": "FA-3",   "takt": 24.0},
    {"line_id": 6, "line_name": "Pack-1", "takt": 12.0},
]

STATIONS = {
    1: [{"sid":1,"ideal":12.0},{"sid":2,"ideal":14.0},{"sid":3,"ideal":13.0},
        {"sid":4,"ideal":11.0},{"sid":5,"ideal":15.0},{"sid":6,"ideal":10.0}],
    2: [{"sid":7,"ideal":12.0},{"sid":8,"ideal":14.0},{"sid":9,"ideal":13.0},
        {"sid":10,"ideal":11.0},{"sid":11,"ideal":15.0},{"sid":12,"ideal":10.0}],
    3: [{"sid":13,"ideal":18.0},{"sid":14,"ideal":20.0},{"sid":15,"ideal":22.0},
        {"sid":16,"ideal":19.0},{"sid":17,"ideal":21.0},{"sid":18,"ideal":16.0},
        {"sid":19,"ideal":25.0},{"sid":20,"ideal":14.0}],
    4: [{"sid":21,"ideal":18.0},{"sid":22,"ideal":20.0},{"sid":23,"ideal":22.0},
        {"sid":24,"ideal":19.0},{"sid":25,"ideal":21.0},{"sid":26,"ideal":16.0},
        {"sid":27,"ideal":25.0},{"sid":28,"ideal":14.0}],
    5: [{"sid":29,"ideal":18.0},{"sid":30,"ideal":20.0},{"sid":31,"ideal":22.0},
        {"sid":32,"ideal":19.0},{"sid":33,"ideal":21.0},{"sid":34,"ideal":16.0},
        {"sid":35,"ideal":25.0},{"sid":36,"ideal":14.0}],
    6: [{"sid":37,"ideal":10.0},{"sid":38,"ideal":8.0},
        {"sid":39,"ideal":11.0},{"sid":40,"ideal":9.0}],
}

LINE_DRIFT = {1:1.05, 2:1.08, 3:1.07, 4:1.06, 5:1.00, 6:1.04}

SHIFTS = [
    {"shift_id":1,"start_h":6, "end_h":14,"is_night":False},
    {"shift_id":2,"start_h":14,"end_h":22,"is_night":False},
    {"shift_id":3,"start_h":22,"end_h":30,"is_night":True},
    {"shift_id":4,"start_h":22,"end_h":30,"is_night":True},
]

DEFECT_WEIGHTS = [
    (1, 0.35),(2, 0.25),(3, 0.18),(4, 0.08),(5, 0.04),(6, 0.10)
]
DOWNTIME_REASONS = [
    {"id":1,"is_planned":True, "min":10,"max":25},
    {"id":2,"is_planned":False,"min":20,"max":60},
    {"id":3,"is_planned":False,"min":15,"max":90},
    {"id":4,"is_planned":True, "min":10,"max":25},
    {"id":5,"is_planned":False,"min":10,"max":30},
    {"id":6,"is_planned":True, "min":15,"max":30},
    {"id":7,"is_planned":True, "min":10,"max":20},
]

def weighted_defect():
    r = RNG.random()
    cum = 0
    for did, w in DEFECT_WEIGHTS:
        cum += w
        if r <= cum:
            return did
    return DEFECT_WEIGHTS[-1][0]

def fmt_ts(dt):
    return dt.strftime("'%Y-%m-%d %H:%M:%S+00'")

def bool_sql(v):
    return "true" if v else "false"

def simulate():
    end_date = datetime(2026, 5, 4, 0, 0, 0, tzinfo=timezone.utc)
    start_date = end_date - timedelta(days=30)

    prod_rows = []
    cycle_rows = []
    defect_rows = []
    dt_rows = []

    for day_offset in range(30):
        day_date = start_date + timedelta(days=day_offset)
        is_weekend = day_date.weekday() >= 5
        day_shift   = SHIFTS[0] if day_offset < 14 else SHIFTS[1]
        night_shift = SHIFTS[2] if day_offset < 14 else SHIFTS[3]

        for shift in [day_shift, night_shift]:
            shift_hours = list(range(shift["start_h"], shift["end_h"]))

            for line in LINES:
                lid = line["line_id"]
                takt = line["takt"]
                drift = LINE_DRIFT[lid]
                fa3 = 0.97 if lid == 5 else 1.0
                night_f = 1.05 if shift["is_night"] else 1.0
                wk_f = 1.03 if is_weekend else 1.0

                # --- Downtime ---
                base_p1 = 0.25 if shift["is_night"] else 0.15
                base_p2 = 0.10 if shift["is_night"] else 0.05
                if is_weekend:
                    base_p1 += 0.10; base_p2 += 0.05
                r = RNG.random()
                n_events = 2 if r < base_p2 else (1 if r < base_p1 + base_p2 else 0)

                dt_by_hour = {}
                for _ in range(n_events):
                    reason = DOWNTIME_REASONS[RNG.randint(0, 6)]
                    dur = RNG.uniform(reason["min"], reason["max"])
                    h_off = RNG.randint(0, 7)
                    start_h = shift["start_h"] + h_off
                    s_dt = day_date.replace(hour=start_h % 24, minute=RNG.randint(0,59), second=0, microsecond=0, tzinfo=timezone.utc)
                    if start_h >= 24:
                        s_dt += timedelta(days=1)
                    e_dt = s_dt + timedelta(minutes=dur)
                    # clamp
                    shift_end = day_date.replace(hour=shift["end_h"] % 24, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                    if shift["end_h"] >= 24:
                        shift_end += timedelta(days=1)
                    if e_dt > shift_end:
                        e_dt = shift_end - timedelta(minutes=1)
                    if e_dt <= s_dt:
                        e_dt = s_dt + timedelta(minutes=5)
                    actual_dur = (e_dt - s_dt).total_seconds() / 60
                    dt_rows.append((lid, shift["shift_id"], reason["id"], s_dt, e_dt))
                    # track downtime by hour
                    sh = s_dt.hour
                    dt_by_hour[sh] = dt_by_hour.get(sh, 0) + actual_dur

                # --- Cycle times (10 samples per station) ---
                for st in STATIONS[lid]:
                    base = st["ideal"] * drift * fa3 * night_f * wk_f
                    for _ in range(10):
                        ct = base + RNG.gauss(0, base * 0.08)
                        ct = max(0.5, min(ct, st["ideal"] * 2.0))
                        h = RNG.choice(shift_hours)
                        ts = day_date.replace(hour=h % 24, minute=RNG.randint(0,59), second=0, microsecond=0, tzinfo=timezone.utc)
                        if h >= 24:
                            ts += timedelta(days=1)
                        cycle_rows.append((st["sid"], lid, shift["shift_id"], ts, round(ct, 2)))

                # --- Bottleneck cycle (for throughput calc) ---
                bottleneck = max(st["ideal"] * drift * fa3 * night_f * wk_f for st in STATIONS[lid])

                # --- Production per hour ---
                for i, hour in enumerate(shift_hours):
                    is_start = (i == 0)
                    is_end   = (i == len(shift_hours) - 1)
                    dt_min = dt_by_hour.get(hour % 24, 0)
                    operating_min = max(0.0, 60.0 - dt_min)
                    if operating_min < 2:
                        continue

                    max_units = math.floor(operating_min * 60 / bottleneck)

                    if shift["is_night"]:
                        eff = RNG.uniform(0.80, 0.90)
                    else:
                        eff = RNG.uniform(0.88, 0.96)
                    if is_weekend: eff *= 0.92
                    if is_start:   eff *= 0.85
                    if is_end:     eff *= 0.90

                    units_produced = max(0, math.floor(max_units * eff))

                    base_rate = 0.015
                    if shift["is_night"]:  base_rate *= 1.35
                    if is_weekend:         base_rate *= 1.15
                    if bottleneck > takt:  base_rate *= 1.25
                    if is_start or is_end: base_rate *= 1.40

                    defect_count = math.floor(units_produced * base_rate)
                    units_good = max(0, units_produced - defect_count)
                    units_scrapped = math.floor(defect_count * 0.3)

                    # Hard safety clamp
                    if units_good > units_produced:
                        units_good = units_produced

                    ts = day_date.replace(hour=hour % 24, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                    if hour >= 24:
                        ts += timedelta(days=1)

                    prod_rows.append((lid, shift["shift_id"], ts, hour % 24,
                                      units_produced, units_good, units_scrapped))

                    # --- Defects ---
                    for _ in range(defect_count):
                        code_id = weighted_defect()
                        st = STATIONS[lid][RNG.randint(0, len(STATIONS[lid])-1)]
                        d_ts = ts + timedelta(minutes=RNG.randint(0, 59))
                        is_rework = RNG.random() < 0.70
                        defect_rows.append((lid, st["sid"], shift["shift_id"],
                                            code_id, d_ts, 1, is_rework))

    return prod_rows, cycle_rows, defect_rows, dt_rows


def main():
    prod_rows, cycle_rows, defect_rows, dt_rows = simulate()

    print(f"-- Generated: {len(prod_rows)} prod, {len(cycle_rows)} cycles, "
          f"{len(defect_rows)} defects, {len(dt_rows)} downtime")

    # Production events
    BATCH = 200
    for i in range(0, len(prod_rows), BATCH):
        chunk = prod_rows[i:i+BATCH]
        vals = ",\n  ".join(
            f"({r[0]},{r[1]},{fmt_ts(r[2])},{r[3]},{r[4]},{r[5]},{r[6]})"
            for r in chunk
        )
        print(f"INSERT INTO fact_production_events "
              f"(line_id,shift_id,event_timestamp,hour_bucket,units_produced,units_good,units_scrapped) VALUES\n  {vals};")

    # Cycle times
    for i in range(0, len(cycle_rows), BATCH):
        chunk = cycle_rows[i:i+BATCH]
        vals = ",\n  ".join(
            f"({r[0]},{r[1]},{r[2]},{fmt_ts(r[3])},{r[4]},1)"
            for r in chunk
        )
        print(f"INSERT INTO fact_station_cycle_times "
              f"(station_id,line_id,shift_id,event_timestamp,cycle_time_sec,operator_count) VALUES\n  {vals};")

    # Defects
    for i in range(0, len(defect_rows), BATCH):
        chunk = defect_rows[i:i+BATCH]
        vals = ",\n  ".join(
            f"({r[0]},{r[1]},{r[2]},{r[3]},{fmt_ts(r[4])},{r[5]},{bool_sql(r[6])})"
            for r in chunk
        )
        print(f"INSERT INTO fact_quality_defects "
              f"(line_id,station_id,shift_id,defect_code_id,event_timestamp,quantity,is_reworkable) VALUES\n  {vals};")

    # Downtime
    for i in range(0, len(dt_rows), BATCH):
        chunk = dt_rows[i:i+BATCH]
        vals = ",\n  ".join(
            f"({r[0]},{r[1]},{r[2]},{fmt_ts(r[3])},{fmt_ts(r[4])})"
            for r in chunk
        )
        print(f"INSERT INTO fact_downtime_events "
              f"(line_id,shift_id,reason_id,start_time,end_time) VALUES\n  {vals};")

    import sys
    print(f"\n-- DONE: {len(prod_rows)} prod | {len(cycle_rows)} cycles | "
          f"{len(defect_rows)} defects | {len(dt_rows)} downtime",
          file=sys.stderr)


if __name__ == "__main__":
    main()
