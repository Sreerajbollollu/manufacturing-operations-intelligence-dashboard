-- Enable Supabase Row Level Security for application tables.
-- Manufacturing Operations Intelligence reads data through server-side
-- Vercel API routes using DATABASE_URL. Browser clients must not query
-- these public tables directly through Supabase anon/authenticated roles.
--
-- This migration intentionally does not create anon/authenticated policies
-- and does not enable FORCE ROW LEVEL SECURITY.

BEGIN;

ALTER TABLE public.dim_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_downtime_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_station_cycle_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_quality_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_downtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dim_lines FROM anon;
REVOKE ALL ON TABLE public.dim_lines FROM authenticated;
REVOKE ALL ON TABLE public.dim_stations FROM anon;
REVOKE ALL ON TABLE public.dim_stations FROM authenticated;
REVOKE ALL ON TABLE public.dim_shifts FROM anon;
REVOKE ALL ON TABLE public.dim_shifts FROM authenticated;
REVOKE ALL ON TABLE public.dim_defect_codes FROM anon;
REVOKE ALL ON TABLE public.dim_defect_codes FROM authenticated;
REVOKE ALL ON TABLE public.dim_downtime_reasons FROM anon;
REVOKE ALL ON TABLE public.dim_downtime_reasons FROM authenticated;
REVOKE ALL ON TABLE public.fact_production_events FROM anon;
REVOKE ALL ON TABLE public.fact_production_events FROM authenticated;
REVOKE ALL ON TABLE public.fact_station_cycle_times FROM anon;
REVOKE ALL ON TABLE public.fact_station_cycle_times FROM authenticated;
REVOKE ALL ON TABLE public.fact_quality_defects FROM anon;
REVOKE ALL ON TABLE public.fact_quality_defects FROM authenticated;
REVOKE ALL ON TABLE public.fact_downtime_events FROM anon;
REVOKE ALL ON TABLE public.fact_downtime_events FROM authenticated;
REVOKE ALL ON TABLE public.optimization_recommendations FROM anon;
REVOKE ALL ON TABLE public.optimization_recommendations FROM authenticated;
REVOKE ALL ON TABLE public.data_quality_audit_log FROM anon;
REVOKE ALL ON TABLE public.data_quality_audit_log FROM authenticated;

GRANT SELECT ON TABLE public.dim_lines TO service_role;
GRANT SELECT ON TABLE public.dim_stations TO service_role;
GRANT SELECT ON TABLE public.dim_shifts TO service_role;
GRANT SELECT ON TABLE public.dim_defect_codes TO service_role;
GRANT SELECT ON TABLE public.dim_downtime_reasons TO service_role;
GRANT SELECT ON TABLE public.fact_production_events TO service_role;
GRANT SELECT ON TABLE public.fact_station_cycle_times TO service_role;
GRANT SELECT ON TABLE public.fact_quality_defects TO service_role;
GRANT SELECT ON TABLE public.fact_downtime_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.optimization_recommendations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.data_quality_audit_log TO service_role;

COMMIT;
