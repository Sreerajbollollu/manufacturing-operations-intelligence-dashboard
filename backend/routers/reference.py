from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
import asyncpg
from database import get_db

router = APIRouter(prefix="/api/reference", tags=["reference"])


@router.get("/lines")
async def get_lines(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch(
        "SELECT line_id, line_name, line_type, station_count, takt_time_sec, is_active FROM dim_lines ORDER BY line_id"
    )
    return [dict(r) for r in rows]


@router.get("/stations")
async def get_stations(
    line_id: Optional[int] = Query(None),
    db: asyncpg.Connection = Depends(get_db),
):
    if line_id:
        rows = await db.fetch(
            "SELECT s.*, l.line_name FROM dim_stations s JOIN dim_lines l ON l.line_id = s.line_id WHERE s.line_id = $1 ORDER BY s.station_seq",
            line_id,
        )
    else:
        rows = await db.fetch(
            "SELECT s.*, l.line_name FROM dim_stations s JOIN dim_lines l ON l.line_id = s.line_id ORDER BY s.line_id, s.station_seq"
        )
    return [dict(r) for r in rows]


@router.get("/shifts")
async def get_shifts(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch(
        "SELECT * FROM dim_shifts ORDER BY shift_id"
    )
    return [dict(r) for r in rows]


@router.get("/defect-codes")
async def get_defect_codes(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch(
        "SELECT * FROM dim_defect_codes ORDER BY defect_code_id"
    )
    return [dict(r) for r in rows]


@router.get("/downtime-reasons")
async def get_downtime_reasons(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch(
        "SELECT * FROM dim_downtime_reasons ORDER BY reason_id"
    )
    return [dict(r) for r in rows]
