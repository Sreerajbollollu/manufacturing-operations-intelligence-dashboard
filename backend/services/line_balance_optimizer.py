"""
Line Balancing Optimization using Google OR-Tools CP-SAT solver.
Assigns operators to stations to minimize bottleneck cycle time.
"""
from dataclasses import dataclass
from ortools.sat.python import cp_model


@dataclass
class Station:
    station_id: int
    name: str
    base_cycle_sec: float
    min_operators: int = 1
    max_operators: int = 4


@dataclass
class LineBalanceResult:
    station_assignments: list
    bottleneck_station: str
    bottleneck_cycle_sec: float
    balance_efficiency: float
    total_operators: int
    meets_takt: bool
    takt_time: float


def optimize_line_balance(
    stations: list[Station],
    available_operators: int,
    takt_time_sec: float,
    speed_factor: float = 1.0,
) -> dict:
    model = cp_model.CpModel()
    n = len(stations)
    SCALE = 100

    ops = [
        model.NewIntVar(s.min_operators, min(s.max_operators, available_operators), f"ops_{i}")
        for i, s in enumerate(stations)
    ]
    model.Add(sum(ops) <= available_operators)

    # Approximate cycle time as base / operators (linearized via product constraint)
    # ct[i] * ops[i] = base[i]  → minimize max(ct[i])
    cycle_upper = [int(s.base_cycle_sec * speed_factor * SCALE * 2) for s in stations]
    cts = [model.NewIntVar(0, cycle_upper[i], f"ct_{i}") for i in range(n)]

    for i, s in enumerate(stations):
        base_scaled = int(s.base_cycle_sec * speed_factor * SCALE)
        model.AddDivisionEquality(cts[i], base_scaled, ops[i])

    max_ct = model.NewIntVar(0, max(cycle_upper), "max_ct")
    for ct in cts:
        model.Add(max_ct >= ct)
    model.Minimize(max_ct)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ValueError("No feasible solution found — try more operators")

    assignments = []
    for i, s in enumerate(stations):
        op_count = solver.Value(ops[i])
        ct = s.base_cycle_sec * speed_factor / op_count
        assignments.append({
            "station_id": s.station_id,
            "station_name": s.name,
            "operators": op_count,
            "cycle_time_sec": round(ct, 2),
            "exceeds_takt": ct > takt_time_sec,
        })

    cycle_times = [a["cycle_time_sec"] for a in assignments]
    bottleneck_ct = max(cycle_times)
    bottleneck_name = assignments[cycle_times.index(bottleneck_ct)]["station_name"]
    total_cycle = sum(cycle_times)
    efficiency = total_cycle / (n * bottleneck_ct) * 100 if bottleneck_ct > 0 else 0

    return {
        "station_assignments": assignments,
        "bottleneck_station": bottleneck_name,
        "bottleneck_cycle_sec": round(bottleneck_ct, 2),
        "balance_efficiency": round(efficiency, 1),
        "total_operators": sum(a["operators"] for a in assignments),
        "meets_takt": bottleneck_ct <= takt_time_sec,
        "takt_time": takt_time_sec,
    }
