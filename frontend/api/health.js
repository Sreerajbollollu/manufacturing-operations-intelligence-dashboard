import { query, sendError, sendJson } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { detail: "Method not allowed" });
  }

  try {
    await query("SELECT 1");
    return sendJson(res, 200, {
      status: "ok",
      db_connected: true,
      version: "1.0.0",
    });
  } catch (error) {
    return sendError(res, error);
  }
}
