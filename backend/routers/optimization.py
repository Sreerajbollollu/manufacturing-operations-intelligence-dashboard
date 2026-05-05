from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import asyncpg
from database import get_db
from services.line_balance_optimizer import optimize_line_balance, Station

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


class LineBalanceRequest(BaseModel):
    line_id: int
    available_operators: int
    takt_time_sec: float
    speed_factor: float = 1.0


@router.post("/line-balance")
async def run_line_balance(
    request: LineBalanceRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT station_id, station_name, ideal_cycle_sec FROM dim_stations WHERE line_id = $1 ORDER BY station_seq",
        request.line_id,
    )
    stations = [
        Station(
            station_id=r["station_id"],
            name=r["station_name"],
            base_cycle_sec=float(r["ideal_cycle_sec"]),
        )
        for r in rows
    ]

    result = optimize_line_balance(
        stations=stations,
        available_operators=request.available_operators,
        takt_time_sec=request.takt_time_sec,
        speed_factor=request.speed_factor,
    )

    return result
