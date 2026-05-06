import pg from "pg";

const { Client } = pg;

export function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured");
    error.name = "DatabaseConfigError";
    throw error;
  }

  return process.env.DATABASE_URL;
}

function createClient() {
  return new Client({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
}

export async function query(text, params = []) {
  const client = createClient();
  await client.connect();
  try {
    return await client.query({ text, values: params });
  } finally {
    await client.end().catch(() => {});
  }
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

export function safeDiagnosticMessage(error) {
  return String(error?.message || "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/\b\S+:\S+@\S+\b/g, "[redacted-credentials]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-host]")
    .slice(0, 80);
}

export function databaseUrlDiagnostics() {
  try {
    const url = new URL(getDatabaseUrl());
    const host = url.hostname.toLowerCase();
    const username = decodeURIComponent(url.username || "");
    const port = url.port || "unknown";

    return {
      host_type: host.includes("pooler.supabase.com")
        ? "pooler"
        : host.startsWith("db.") && host.endsWith(".supabase.co")
          ? "direct"
          : "unknown",
      port_seen: port === "5432" || port === "6543" ? port : "unknown",
      has_project_ref_in_user: username.includes("pvxoqpskkpfpuxhunmwm"),
    };
  } catch {
    return {
      host_type: "unknown",
      port_seen: "unknown",
      has_project_ref_in_user: false,
    };
  }
}

export function sendError(res, error) {
  sendJson(res, 503, {
    status: "degraded",
    db_connected: false,
    error: safeErrorMessage(error),
    error_type: safeErrorType(error),
    error_code: error?.code || null,
    error_name: error?.name || null,
    error_message: safeDiagnosticMessage(error),
    ...databaseUrlDiagnostics(),
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
