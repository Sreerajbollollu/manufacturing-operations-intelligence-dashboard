import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured");
    error.name = "DatabaseConfigError";
    throw error;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export function sendJson(res, status, body) {
  res.status(status).json(body);
}

export function safeErrorType(error) {
  return error?.name || error?.code || "DatabaseError";
}

export function safeErrorMessage(error) {
  const type = safeErrorType(error);
  const code = error?.code;

  if (type === "DatabaseConfigError") return "DATABASE_URL is not configured";
  if (code === "28P01" || /auth|password/i.test(type)) return "database authentication failed";
  if (code === "3D000") return "database name is invalid";
  if (code === "28000") return "database authorization failed";
  if (/timeout|connection|network|enotfound|econnrefused/i.test(`${type} ${code || ""}`)) {
    return "database connection failed";
  }
  return "database unavailable";
}

export function sendError(res, error) {
  sendJson(res, 503, {
    status: "degraded",
    db_connected: false,
    error: safeErrorMessage(error),
    error_type: safeErrorType(error),
    sanitized_error: safeErrorMessage(error),
    version: "1.0.0",
  });
}

export function getWindow(daysValue, defaultDays = 30) {
  const parsed = Number.parseInt(daysValue ?? defaultDays, 10);
  const days = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 365) : defaultDays;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { days, start, end };
}

export function optionalInt(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
