# Restoring the production DB backup — verified 2026-09-22

This isn't theoretical — it was actually run end to end against a throwaway database (not
local dev, not production) and the results checked. See `db-backups/` for the files
(`prod_schema_*.sql`, `prod_data_*.sql`), gitignored — not in this repo.

## What was proven

1. Restored the schema dump, then the data dump, into a brand-new database.
2. Row counts after restore matched what was read directly from production beforehand,
   exactly: `User` 4, `Tree` 11, `TreeMember` 145, `profiles` 134, `AuditLog` 37,
   `Invitation` 0.
3. Checked referential integrity, not just counts — zero `TreeMember` rows pointing at a
   missing `Tree`, zero `Tree`s with a missing root member, zero `TreeMember`s with a missing
   profile, zero `AuditLog` rows with a missing `Tree`. The dump's own warning about circular
   foreign keys on `Tree`/`TreeMember`/`profiles` did **not** cause any actual data loss or
   corruption on restore — the concern was about restore *order*/tooling, not the data itself.
4. Local dev's real database was never touched by any of this — the test used a separate
   throwaway database, dropped afterward.

## The one real gotcha: `supabase db dump` assumes an already-bootstrapped Supabase project

The schema dump deliberately excludes "internal schemas maintained by platform" (that's
Supabase's own wording) — `auth`, `storage`, etc. It only contains **your** schema
(`public` — `User`, `Tree`, `TreeMember`, `profiles`, `AuditLog`, `Invitation`,
`_prisma_migrations`). Restoring it cleanly needs three small pieces of platform scaffolding
to already exist, which any real Supabase project (local `supabase start` or a fresh hosted
project) already has, but a bare/ad-hoc Postgres does not:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE PUBLICATION supabase_realtime;
```

Run those three lines first, on the target database, before restoring the schema dump.

**The data dump also includes `auth.*` rows** (`auth.users`, `auth.identities`,
`auth.sessions`, `auth.refresh_tokens`, `auth.mfa_amr_claims` — i.e. the actual login
accounts). Those fail to insert unless the target is a real Supabase project with the `auth`
schema's own tables already in place (that schema's *structure* isn't part of this dump at
all — restoring `auth.*` data is a separate, Supabase-managed concern, not something this
backup reproduces by itself). **This backup restores your app's data — the family trees,
members, profiles, audit log — completely and correctly. It does not by itself restore who
can log in.** Getting login accounts back means either running this against a target that
already has its own `auth` schema (i.e. actually restoring into local `supabase start` or a
fresh hosted project, not a scratch database like this test used), or falling back on
Supabase's own project-level backup/PITR for the `auth` schema specifically.

## Actual restore procedure (once you have real schema.sql/data.sql files)

```bash
# 1. On the TARGET Supabase project's Postgres (local `supabase_db_transpeed`, or a
#    production project's connection string) — never run this against a database you
#    haven't decided to overwrite.
psql "<target-connection-string>" \
  -c "CREATE SCHEMA IF NOT EXISTS extensions;" \
  -c "CREATE SCHEMA IF NOT EXISTS vault;" \
  -c "CREATE PUBLICATION supabase_realtime;"

# 2. Schema first, then data — order matters, data needs the tables to exist.
psql "<target-connection-string>" -f prod_schema_<date>.sql
psql "<target-connection-string>" -f prod_data_<date>.sql

# 3. Verify — same shape of check as above: row counts + a few FK-integrity queries,
#    don't just assume it worked because psql didn't error.
```

If restoring onto a database that already has data (not a fresh one), expect unique-key
conflicts — this procedure is for "get back to exactly this snapshot" on an empty/fresh
target, not merging onto live data.
