import {
  databaseUrlDiagnostics,
  errorDiagnostics,
  safeErrorMessage,
  sendJson,
  testConnection,
} from "../_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  const diagnostics = databaseUrlDiagnostics();

  try {
    const result = await testConnection();
    return sendJson(res, 200, {
      status: "ok",
      db_connected: result.ok,
      select_1_ok: result.ok,
      elapsed_ms: result.elapsed_ms,
      ...diagnostics,
      version: "1.0.0",
    });
  } catch (error) {
    return sendJson(res, 503, {
      status: "degraded",
      db_connected: false,
      select_1_ok: false,
      error: safeErrorMessage(error),
      ...diagnostics,
      ...errorDiagnostics(error),
      version: "1.0.0",
    });
  }
}
