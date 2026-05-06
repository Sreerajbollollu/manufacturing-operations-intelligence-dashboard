import { getWindow, queryWithClient, sendError, sendJson, withClient } from "../_lib/db.js";
import {
  DOWNTIME_SUMMARY_SQL,
  OVERVIEW_LINE_SQL,
  QUALITY_SUMMARY_SQL,
  intValue,
  numberValue,
  round,
} from "../_lib/kpi.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const { days, start, end } = getWindow(req.query.days);

  try {
    const { lineResult, qualityResult, downtimeResult } = await withClient(async (client) => ({
      lineResult: await queryWithClient(client, OVERVIEW_LINE_SQL, [start, end]),
      qualityResult: await queryWithClient(client, QUALITY_SUMMARY_SQL, [start, end]),
      downtimeResult: await queryWithClient(client, DOWNTIME_SUMMARY_SQL, [start, end]),
    }));

    const lineRows = lineResult.rows;
    const qualityRow = qualityResult.rows[0] || {};
    const downtimeRow = downtimeResult.rows[0] || {};

    const totalProduced = lineRows.reduce((sum, row) => sum + intValue(row.total_produced), 0);
    const totalGood = lineRows.reduce((sum, row) => sum + intValue(row.total_good), 0);
    const totalScrapped = lineRows.reduce((sum, row) => sum + intValue(row.total_scrapped), 0);
    const avgFPY = totalProduced ? round((totalGood / totalProduced) * 100, 2) : 0;

    const weightedCycle = lineRows.reduce((sum, row) => {
      const avgCycle = numberValue(row.avg_cycle_sec);
      return avgCycle > 0 ? sum + avgCycle * intValue(row.total_produced) : sum;
    }, 0);
    const weightedProd = lineRows.reduce((sum, row) => {
      const avgCycle = numberValue(row.avg_cycle_sec);
      return avgCycle > 0 ? sum + intValue(row.total_produced) : sum;
    }, 0);
    const avgCycleTime = weightedProd ? round(weightedCycle / weightedProd, 2) : 0;

    const totalOpMin = lineRows.reduce((sum, row) => {
      return sum + Math.max(0, numberValue(row.planned_min) - numberValue(row.dt_min));
    }, 0);
    const throughputPerHour = totalOpMin > 0 ? round(totalProduced / (totalOpMin / 60), 1) : 0;

    let activeAlerts = 0;
    const lineSummary = lineRows.map((row) => {
      const avail = numberValue(row.avail_proxy);
      const perf = numberValue(row.perf_proxy);
      const qual = numberValue(row.qual_rate);
      const oee = round(avail * perf * qual * 100, 2);
      if (oee < 75) activeAlerts += 1;

      return {
        lineName: row.line_name,
        oeeProxy: oee,
        throughput: intValue(row.total_produced),
        fpy: round(qual * 100, 2),
        avgCycleTime: round(numberValue(row.avg_cycle_sec), 2),
        taktTime: numberValue(row.takt_time_sec),
        bottleneckFlag: Boolean(row.bottleneck_flag),
      };
    });

    const totalDefects = intValue(qualityRow.total_defects);
    const defectRate = totalProduced ? round((totalDefects / totalProduced) * 100, 4) : 0;

    return sendJson(res, 200, {
      totalProduced,
      totalGood,
      totalScrapped,
      avgFPY,
      avgCycleTime,
      throughputPerHour,
      linesActive: lineRows.length,
      activeAlerts,
      lineSummary,
      qualitySummary: {
        totalDefects,
        defectRate,
        topDefectCategory: qualityRow.top_category || "",
      },
      downtimeSummary: {
        totalDowntimeMinutes: numberValue(downtimeRow.total_dt_min),
        downtimeEvents: intValue(downtimeRow.event_count),
        topDowntimeReason: downtimeRow.top_reason || "",
      },
      _meta: {
        windowDays: days,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        oeeNote:
          "OEE values are project proxies. Availability = operating_min / planned_min (planned = COUNT(*) production event slots x 60 min). Performance = takt / avg_cycle_time, capped at 1. Not a certified plant OEE calculation.",
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
