-- ============================================
-- FACT / EVENT TABLES
-- ============================================

CREATE TABLE fact_production_events (
    event_id        BIGSERIAL PRIMARY KEY,
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    shift_id        INTEGER NOT NULL REFERENCES dim_shifts(shift_id),
    event_timestamp TIMESTAMPTZ NOT NULL,
    hour_bucket     SMALLINT NOT NULL,
    units_produced  INTEGER NOT NULL CHECK (units_produced >= 0),
    units_good      INTEGER NOT NULL CHECK (units_good >= 0),
    units_scrapped  INTEGER NOT NULL DEFAULT 0 CHECK (units_scrapped >= 0),
    CONSTRAINT chk_good_le_produced CHECK (units_good <= units_produced)
);

CREATE INDEX idx_prod_events_line_ts ON fact_production_events(line_id, event_timestamp);
CREATE INDEX idx_prod_events_shift   ON fact_production_events(shift_id, event_timestamp);

CREATE TABLE fact_station_cycle_times (
    cycle_id        BIGSERIAL PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES dim_stations(station_id),
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    shift_id        INTEGER NOT NULL REFERENCES dim_shifts(shift_id),
    event_timestamp TIMESTAMPTZ NOT NULL,
    cycle_time_sec  NUMERIC(8,2) NOT NULL CHECK (cycle_time_sec > 0),
    operator_count  SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_cycle_station_ts ON fact_station_cycle_times(station_id, event_timestamp);

CREATE TABLE fact_quality_defects (
    defect_id       BIGSERIAL PRIMARY KEY,
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    station_id      INTEGER REFERENCES dim_stations(station_id),
    shift_id        INTEGER NOT NULL REFERENCES dim_shifts(shift_id),
    defect_code_id  INTEGER NOT NULL REFERENCES dim_defect_codes(defect_code_id),
    event_timestamp TIMESTAMPTZ NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    is_reworkable   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_defects_line_ts ON fact_quality_defects(line_id, event_timestamp);

CREATE TABLE fact_downtime_events (
    downtime_id     BIGSERIAL PRIMARY KEY,
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    station_id      INTEGER REFERENCES dim_stations(station_id),
    shift_id        INTEGER NOT NULL REFERENCES dim_shifts(shift_id),
    reason_id       INTEGER NOT NULL REFERENCES dim_downtime_reasons(reason_id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    duration_min    NUMERIC(8,2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0
    ) STORED,
    CONSTRAINT chk_end_after_start CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE INDEX idx_downtime_line_ts ON fact_downtime_events(line_id, start_time);

-- ============================================
-- ANALYTICS / OUTPUT TABLES
-- ============================================

CREATE TABLE optimization_recommendations (
    rec_id          SERIAL PRIMARY KEY,
    line_id         INTEGER NOT NULL REFERENCES dim_lines(line_id),
    rec_type        VARCHAR(30) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    parameters      JSONB NOT NULL,
    results         JSONB NOT NULL,
    before_metrics  JSONB,
    after_metrics   JSONB
);

CREATE TABLE data_quality_audit_log (
    audit_id        BIGSERIAL PRIMARY KEY,
    check_name      VARCHAR(100) NOT NULL,
    table_name      VARCHAR(100) NOT NULL,
    record_id       BIGINT,
    severity        VARCHAR(10) NOT NULL,
    detail          TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
