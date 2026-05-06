# Manufacturing Operations Intelligence Dashboard

Manufacturing Operations Intelligence Platform — full-stack portfolio project targeting Operations Research / Data Analytics roles in high-volume electronics manufacturing.

## What it does

Real-time OEE (Overall Equipment Effectiveness) dashboard backed by 30 days of causally-consistent production data across 6 lines, 40 stations, 4 shifts, and ~760,000 cycle-time observations.

**Key capabilities:**
- OEE = Availability × Performance × Quality computed in SQL, served via FastAPI
- Defect Pareto analysis with Fibonacci-80 cumulative % detection
- Bottleneck station identification (avg cycle time > takt time)
- Shift vs. shift performance benchmarking
- OR-Tools CP-SAT line-balancing optimizer endpoint

## Stack

| Layer | Tech |
|-------|------|
| Database | PostgreSQL 15 (Supabase) |
| Backend | FastAPI + asyncpg (Python 3.11) |
| Frontend | React 18 + Vite + Recharts |
| Optimization | Google OR-Tools CP-SAT |
| Seed data | Pure-Python generator (`random.Random(42)`) |

## Database schema

```
dim_lines          6 rows   — takt_time_sec, station_count
dim_stations      40 rows   — line FK, cycle targets
dim_shifts         4 rows   — morning / afternoon / evening / night
dim_defect_codes   6 rows   — severity, rework flag
dim_downtime_reasons 7 rows — planned vs unplanned

fact_production_events   ~4,900 rows  — hourly line output, OEE source
fact_station_cycle_times ~24,000 rows — per-station cycle seconds
fact_quality_defects     ~9,000 rows  — defect code, quantity
fact_downtime_events       147 rows   — GENERATED duration_min column
```

## KPI formulas

```
Availability = (Planned Time − Downtime) / Planned Time
Performance  = MIN(Ideal Cycle Time × Output / Operating Time, 1.0)
Quality      = Units Good / Units Produced
OEE          = Availability × Performance × Quality

FPY          = Units Good / Units Produced  (line level)
```

Planned Time = COUNT(*) production-event rows × 60 min (each row = one hour-slot).

## Quick start

### Environment

Create local env files from the examples. Do not commit real `.env` files.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env` needs `DATABASE_URL`. `frontend/.env` should point at FastAPI with `VITE_API_BASE_URL=http://localhost:8000`.

### Backend

```bash
cd backend
pip install -r requirements.txt

uvicorn main:app --reload
# API docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kpi/overview` | Aggregate OEE, FPY, throughput, alert count |
| GET | `/api/kpi/lines` | Per-line OEE breakdown with A × P × Q components |
| GET | `/api/kpi/quality` | Defect Pareto + FPY by line |
| GET | `/api/kpi/downtime` | Downtime summary and reason Pareto |
| GET | `/api/kpi/capacity` | Capacity utilization by line |
| GET | `/api/kpi/shifts` | Shift comparison — OEE, downtime incidents, defects |
| GET | `/api/kpi/hourly?line_id=1` | Hourly output vs. takt target for sparklines |
| POST | `/api/optimization/line-balance` | OR-Tools CP-SAT workload balancer |
| GET | `/api/reference/lines` | Dimension data |

All time-window endpoints accept `?days=30` and optional `?shift_id=`.

## Supabase views (for dashboard exploration)

```sql
SELECT * FROM vw_line_oee;         -- OEE components per line
SELECT * FROM vw_daily_production;  -- Daily FPY trend
SELECT * FROM vw_downtime_pareto;   -- Top downtime reasons
```

## OEE results (30-day period)

| Line | Availability | Performance | Quality | OEE |
|------|-------------|-------------|---------|-----|
| SMT-1 | 98.6% | 76.2% | 97.9% | **73.5%** |
| SMT-2 | 98.7% | 74.0% | 97.9% | **71.5%** |
| FA-1 | 98.7% | 71.2% | 98.0% | **68.8%** |
| FA-2 | 98.9% | 71.8% | 98.0% | **69.6%** |
| FA-3 | 99.0% | 79.4% | 97.9% | **77.0%** |
| Pack-1 | 98.7% | 84.8% | 97.9% | **82.0%** |

Performance is the primary loss factor — typical for high-mix electronics assembly where frequent changeovers reduce net throughput vs. theoretical takt.

## Project structure

```
factorypulse-ai/
├── backend/
│   ├── main.py              FastAPI app + CORS + lifespan pool
│   ├── config.py            env var loading
│   ├── database.py          asyncpg connection pool
│   ├── routers/
│   │   ├── kpi.py           OEE / quality / shift endpoints
│   │   ├── reference.py     dim table endpoints
│   │   └── optimization.py  OR-Tools line balancer
│   └── services/
│       └── line_balance_optimizer.py
├── database/
│   ├── schema/
│   │   ├── 001_dimensions.sql
│   │   └── 002_facts.sql
│   └── seed/
│       └── generate_sql.py  Reproducible seed generator (seed=42)
└── frontend/
    └── src/
        ├── App.jsx
        ├── api/client.js
        ├── pages/           Dashboard, Quality, Shifts, Optimizer
        └── utils/tokens.js  Stitch design tokens
```
