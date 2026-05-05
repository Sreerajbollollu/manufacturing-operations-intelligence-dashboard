from __future__ import annotations
import asyncpg
from config import DATABASE_URL

_pool: asyncpg.Pool | None = None


class DatabaseConfigError(RuntimeError):
    pass


async def get_pool() -> asyncpg.Pool:
    global _pool
    if not DATABASE_URL:
        raise DatabaseConfigError("DATABASE_URL is not configured")
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
