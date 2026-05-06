import { query, sendError, sendJson } from "../_lib/db.js";
import { numberValue } from "../_lib/kpi.js";

function optimizeLineBalance(stations, availableOperators, taktTimeSec, speedFactor = 1) {
  if (!stations.length) throw new Error("No stations found for line");

  const choices = stations.map((station) => {
    const maxOperators = Math.min(4, availableOperators);
    return Array.from({ length: maxOperators }, (_, index) => {
      const operators = index + 1;
      return {
        station,
        operators,
        cycleTimeSec: (station.base_cycle_sec * speedFactor) / operators,
      };
    });
  });

  let best = null;

  function search(index, usedOperators, assignments) {
    if (usedOperators > availableOperators) return;
    if (index === choices.length) {
      const cycleTimes = assignments.map((item) => item.cycleTimeSec);
      const bottleneckCycleSec = Math.max(...cycleTimes);
      const totalCycle = cycleTimes.reduce((sum, value) => sum + value, 0);
      const balanceEfficiency = bottleneckCycleSec > 0
        ? (totalCycle / (assignments.length * bottleneckCycleSec)) * 100
        : 0;

      const candidate = {
        assignments,
        bottleneckCycleSec,
        balanceEfficiency,
        totalOperators: usedOperators,
      };

      if (
        !best ||
        candidate.bottleneckCycleSec < best.bottleneckCycleSec ||
        (
          candidate.bottleneckCycleSec === best.bottleneckCycleSec &&
          candidate.balanceEfficiency > best.balanceEfficiency
        )
      ) {
        best = candidate;
      }
      return;
    }

    for (const choice of choices[index]) {
      search(index + 1, usedOperators + choice.operators, [...assignments, choice]);
    }
  }

  search(0, 0, []);
  if (!best) throw new Error("No feasible solution found - try more operators");

  const stationAssignments = best.assignments.map((item) => ({
    station_id: item.station.station_id,
    station_name: item.station.station_name,
    operators: item.operators,
    cycle_time_sec: Math.round(item.cycleTimeSec * 100) / 100,
    exceeds_takt: item.cycleTimeSec > taktTimeSec,
  }));
  const bottleneck = stationAssignments.reduce((max, item) => (
    item.cycle_time_sec > max.cycle_time_sec ? item : max
  ));

  return {
    station_assignments: stationAssignments,
    bottleneck_station: bottleneck.station_name,
    bottleneck_cycle_sec: Math.round(best.bottleneckCycleSec * 100) / 100,
    balance_efficiency: Math.round(best.balanceEfficiency * 10) / 10,
    total_operators: best.totalOperators,
    meets_takt: best.bottleneckCycleSec <= taktTimeSec,
    takt_time: taktTimeSec,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const lineId = Number.parseInt(body.line_id, 10);
  const availableOperators = Number.parseInt(body.available_operators, 10);
  const taktTimeSec = numberValue(body.takt_time_sec);
  const speedFactor = numberValue(body.speed_factor || 1);

  if (!lineId || !availableOperators || !taktTimeSec) {
    return sendJson(res, 400, { detail: "line_id, available_operators, and takt_time_sec are required" });
  }

  try {
    const { rows } = await query(
      "SELECT station_id, station_name, ideal_cycle_sec FROM dim_stations WHERE line_id = $1 ORDER BY station_seq",
      [lineId],
    );
    const stations = rows.map((row) => ({
      station_id: row.station_id,
      station_name: row.station_name,
      base_cycle_sec: numberValue(row.ideal_cycle_sec),
    }));

    return sendJson(
      res,
      200,
      optimizeLineBalance(stations, availableOperators, taktTimeSec, speedFactor),
    );
  } catch (error) {
    return sendError(res, error);
  }
}
