import pg from "pg";

const { Client } = pg;
const PROJECT_REF = "pvxoqpskkpfpuxhunmwm";
const QUERY_TIMEOUT_MS = 20_000;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured");
    error.name = "DatabaseConfigError";
    throw error;
  }

  return process.env.DATABASE_URL;
}

function getConnectionString() {
  const raw = getDatabaseUrl();
  let url;

  try {
    url = new URL(raw);
  } catch {
    const error = new Error("DATABASE_URL is invalid");
    error.name = "DatabaseConfigError";
    throw error;
  }

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  if (!url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

function createClient() {
  return new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: QUERY_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
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

export async function testConnection() {
  const startedAt = Date.now();
  const result = await query("SELECT 1 AS ok");
  return {
    ok: Number(result.rows?.[0]?.ok) === 1,
    elapsed_ms: Date.now() - startedAt,
  };
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
  const text = `${type} ${code || ""} ${error?.message || ""}`;

  if (type === "DatabaseConfigError") return error?.message || "DATABASE_URL is not configured";
  if (code === "28P01" || /auth|password/i.test(text)) return "database authentication failed";
  if (code === "3D000") return "database name is invalid";
  if (code === "28000") return "database authorization failed";
  if (/timeout|connection|network|enotfound|econnrefused|08006/i.test(text)) {
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

function usernameShape(username) {
  if (!username) return "unknown";
  if (username === "postgres") return "postgres";
  if (username.startsWith("postgres.")) return "postgres.project_ref";
  return "other";
}

export function databaseUrlDiagnostics() {
  if (!hasDatabaseUrl()) {
    return {
      has_database_url: false,
      host_type: "unknown",
      port_seen: "unknown",
      username_shape: "unknown",
      has_project_ref_in_user: false,
    };
  }

  try {
    const url = new URL(getDatabaseUrl());
    const host = url.hostname.toLowerCase();
    const username = decodeURIComponent(url.username || "");
    const port = url.port || "unknown";

    return {
      has_database_url: true,
      host_type: host.includes("pooler.supabase.com")
        ? "pooler"
        : host.startsWith("db.") && host.endsWith(".supabase.co")
          ? "direct"
          : "unknown",
      port_seen: port === "5432" || port === "6543" ? port : "unknown",
      username_shape: usernameShape(username),
      has_project_ref_in_user: username.includes(PROJECT_REF),
    };
  } catch {
    return {
      has_database_url: true,
      host_type: "unknown",
      port_seen: "unknown",
      username_shape: "unknown",
      has_project_ref_in_user: false,
    };
  }
}

export function errorDiagnostics(error) {
  return {
    error_code: error?.code || null,
    error_name: error?.name || null,
    sanitized_message: safeDiagnosticMessage(error),
  };
}

export function sendError(res, error) {
  sendJson(res, 503, {
    status: "degraded",
    db_connected: false,
    error: safeErrorMessage(error),
    error_type: safeErrorType(error),
    ...databaseUrlDiagnostics(),
    ...errorDiagnostics(error),
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
