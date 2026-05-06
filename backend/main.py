from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncpg

from config import CORS_ORIGINS
from database import DatabaseConfigError, get_pool, close_pool
from routers import kpi, reference, optimization


def _safe_db_error_type(exc: Exception) -> str:
    return exc.__class__.__name__


def _safe_db_error_message(exc: Exception) -> str:
    error_type = _safe_db_error_type(exc)
    if isinstance(exc, DatabaseConfigError):
        return "DATABASE_URL is not configured"
    if "InvalidPassword" in error_type or "Authentication" in error_type:
        return "database authentication failed"
    if "InvalidCatalogName" in error_type:
        return "database name is invalid"
    if "InvalidAuthorization" in error_type:
        return "database authorization failed"
    if "Connection" in error_type or "Timeout" in error_type or "OSError" in error_type:
        return "database connection failed"
    return "database unavailable"


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_pool()
    except Exception:
        print("WARNING: DB pool init failed")
    yield
    await close_pool()


app = FastAPI(
    title="Manufacturing Operations Intelligence Dashboard",
    description="Smart Manufacturing Analytics Platform — Foxconn WI Operations Research",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kpi.router)
app.include_router(reference.router)
app.include_router(optimization.router)


@app.exception_handler(DatabaseConfigError)
async def database_config_exception_handler(request: Request, exc: DatabaseConfigError):
    return JSONResponse(
        status_code=503,
        content={"detail": _safe_db_error_message(exc)},
    )


@app.exception_handler(asyncpg.PostgresError)
async def postgres_exception_handler(request: Request, exc: asyncpg.PostgresError):
    return JSONResponse(
        status_code=503,
        content={"detail": _safe_db_error_message(exc)},
    )


@app.get("/health")
async def health():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return {
            "status": "ok",
            "db_connected": True,
            "version": "1.0.0",
        }
    except Exception as e:
        return {
            "status": "degraded",
            "db_connected": False,
            "error": _safe_db_error_message(e),
            "error_type": _safe_db_error_type(e),
            "sanitized_error": _safe_db_error_message(e),
            "version": "1.0.0",
        }
