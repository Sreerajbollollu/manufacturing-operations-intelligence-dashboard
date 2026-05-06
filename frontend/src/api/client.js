const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function apiFetch(path, params = {}) {
  const url = new URL(apiUrl(path), window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

const asRatio = (value) => (value == null ? value : Number(value) / 100);

const normalizeOverview = (data) => ({
  ...data,
  oee: data.lineSummary?.length
    ? data.lineSummary.reduce((sum, line) => sum + Number(line.oeeProxy || 0), 0) / data.lineSummary.length / 100
    : 0,
  throughput: data.totalProduced,
  fpy: asRatio(data.avgFPY),
  avg_takt_time: data.lineSummary?.length
    ? data.lineSummary.reduce((sum, line) => sum + Number(line.taktTime || 0), 0) / data.lineSummary.length
    : 0,
  active_alerts: data.activeAlerts,
  total_defects: data.qualitySummary?.totalDefects || 0,
  total_downtime_min: data.downtimeSummary?.totalDowntimeMinutes || 0,
});

const normalizeLine = (line) => ({
  ...line,
  oee: asRatio(line.oee_proxy),
  availability: asRatio(line.availability),
  performance: asRatio(line.performance),
  quality: asRatio(line.quality),
  fpy: asRatio(line.fpy),
});

export const fetchOverview = async (params) => normalizeOverview(await apiFetch("/api/kpi/overview", params));
export const fetchLines = async (params) => (await apiFetch("/api/kpi/lines", params)).map(normalizeLine);
export const fetchQuality = (params) => apiFetch("/api/kpi/quality", params);
export const fetchDowntime = (params) => apiFetch("/api/kpi/downtime", params);
export const fetchCapacity = (params) => apiFetch("/api/kpi/capacity", params);
export const fetchShifts = (params) => apiFetch("/api/kpi/shifts", params);
export const fetchHourly = (params) => apiFetch("/api/kpi/hourly", params);
export const fetchRecommendations = (params) => apiFetch("/api/recommendations/actions", params);
export const fetchRefLines = () => apiFetch("/api/reference/lines");
export const fetchRefStations = (line_id) => apiFetch("/api/reference/stations", { line_id });
export const fetchRefShifts = () => apiFetch("/api/reference/shifts");
export const fetchHealth = () => apiFetch("/api/health");

export async function optimizeLineBalance(payload) {
  const res = await fetch(apiUrl("/api/optimization/line-balance"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API /api/optimization/line-balance -> ${res.status}`);
  return res.json();
}
