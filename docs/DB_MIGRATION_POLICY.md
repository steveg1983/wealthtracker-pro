# Database Migration Policy

This policy ensures safe, auditable, and reversible schema changes.

## Rules
- All schema changes are applied via files in `../supabase/migrations/` only.
- Every change must include a new migration file; never edit historical migrations.
- Migrations must be small and atomic; one logical change per file.
- Provide a rollback plan in the PR description.
- Test migrations locally or in staging before merging.

## Author Checklist
- Explain the reason for the change and its impact.
- Include data backfill/update scripts if needed.
- Validate application code and types after schema changes.
- Update seed data and fixtures if impacted.

## CI Enforcement
- PRs that change files in `../supabase/` (excluding `../supabase/migrations/`) must include a new SQL file under `../supabase/migrations/`.
- See workflow: `.github/workflows/db-migration-check.yml`.

## Production Runbook (Manual via Supabase UI)
Use this checklist when you must run a migration manually in production (e.g., initial bootstrap or break‑glass):

1) Open Supabase → your project → SQL Editor → New query
2) Paste the migration SQL content from `../supabase/migrations/<NNN>_*.sql` and Run
   - Example: initial categories setup: `../supabase/migrations/009_create_categories_table.sql`
3) Verify results with a simple query (example): `SELECT COUNT(*) FROM categories;`
4) Validate application behavior (affected screens and dropdowns)
5) Rollback plan: keep the `down` script or compensating SQL ready; document in the PR

Notes
- Migrations should be idempotent when possible (safe to re‑run without data loss)
- Prefer running migrations via automated deploy pipelines; manual runs are the exception
