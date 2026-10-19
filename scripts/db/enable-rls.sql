-- Turns on Row Level Security for every table in "public", with no policies.
--
-- The anon key ships in the frontend, so without RLS anyone could read or
-- change these tables through Supabase's REST API (e.g. list "Admin" staff
-- accounts, or delete "RevokedToken" rows to bring a logged-out token back).
-- With RLS on and no policy, that API sees nothing. The backend is not
-- affected: Prisma connects as the tables' owner, which RLS doesn't apply to.
-- The browser only uses Realtime broadcast/presence channels, never tables.
--
-- `prisma db push` creates new tables with RLS off, so run this after every
-- push (scripts/local-up.sh does it locally). Safe to re-run.
--
--   docker exec -i -e DIRECT_URL=... <backend> \
--     npx prisma db execute --stdin < scripts/db/enable-rls.sql

DO $$
DECLARE
	t record;
BEGIN
	FOR t IN
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
	LOOP
		EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
	END LOOP;
END
$$;
