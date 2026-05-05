export const fmtPct = (v, decimals = 1) =>
  v == null ? "—" : `${(v * 100).toFixed(decimals)}%`;

export const fmtNum = (v) =>
  v == null ? "—" : Math.round(v).toLocaleString();

export const fmtSec = (v, decimals = 1) =>
  v == null ? "—" : `${Number(v).toFixed(decimals)}s`;

export const fmtMin = (v) =>
  v == null ? "—" : `${Math.round(v)}m`;

export const oeeColor = (oee, T) =>
  oee >= 0.85 ? T.success : oee >= 0.65 ? T.warning : T.danger;
