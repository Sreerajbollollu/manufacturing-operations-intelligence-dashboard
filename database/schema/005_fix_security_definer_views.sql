-- Remove unused SECURITY DEFINER analytics views flagged by Supabase Advisor.
-- The production dashboard reads data through server-side Vercel API routes
-- and does not depend on these views. No anon/authenticated policies or grants
-- are created here.

BEGIN;

DROP VIEW IF EXISTS public.vw_line_oee;
DROP VIEW IF EXISTS public.vw_downtime_pareto;
DROP VIEW IF EXISTS public.vw_daily_production;

COMMIT;
