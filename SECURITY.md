# Security

## Supabase RLS posture

Row Level Security is enabled on the public application tables. This project intentionally does not create `anon` or `authenticated` RLS policies for those tables.

Browser clients do not access Supabase tables directly. The React frontend calls same-origin Vercel serverless API routes, and those API routes access PostgreSQL using the server-side `DATABASE_URL` environment variable.

Because there are no browser-facing table policies, the Supabase Advisor INFO warning that RLS is enabled with no policy is expected for this architecture. Do not add public `SELECT` policies unless the application architecture changes to require direct browser access to Supabase.
