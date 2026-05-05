-- ============================================
-- DIMENSION TABLES
-- ============================================

CREATE TABLE dim_lines (
    line_id         SERIAL PRIMARY KEY,
    line_name       VARCHAR(50) NOT NULL UNIQUE,
    line_type       VARCHAR(30) NOT NULL,
    station_count   INTEGER NOT NULL DEFAULT 1,
    takt_time_sec   NUMERIC(8,2),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dim_stations (
    station_id      SERIAL PRIMARY KEY,
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    station_name    VARCHAR(100) NOT NULL,
    station_seq     INTEGER NOT NULL,
    ideal_cycle_sec NUMERIC(8,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(line_id, station_seq)
);

CREATE TABLE dim_shifts (
    shift_id        SERIAL PRIMARY KEY,
    shift_name      VARCHAR(30) NOT NULL UNIQUE,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    planned_hours   NUMERIC(4,1) NOT NULL
);

CREATE TABLE dim_defect_codes (
    defect_code_id  SERIAL PRIMARY KEY,
    defect_code     VARCHAR(20) NOT NULL UNIQUE,
    defect_name     VARCHAR(100) NOT NULL,
    defect_category VARCHAR(50) NOT NULL,
    severity        VARCHAR(10) NOT NULL DEFAULT 'minor'
);

CREATE TABLE dim_downtime_reasons (
    reason_id       SERIAL PRIMARY KEY,
    reason_code     VARCHAR(20) NOT NULL UNIQUE,
    reason_name     VARCHAR(100) NOT NULL,
    reason_category VARCHAR(50) NOT NULL,
    is_planned      BOOLEAN NOT NULL DEFAULT false
);
