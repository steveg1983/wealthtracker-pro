# Disaster Recovery Audit — 2026-06-11

Principle applied throughout: **an untested backup is not a backup.** This
audit ends with an executed restore drill, not a description of one.

---

## What existed before this audit

| Mechanism | Honest assessment |
|---|---|
| `automaticBackupService` (client) | Backs up browser **localStorage into browser IndexedDB on the same machine**. Its "cloud sync" is a stub that logs *"Would sync"*. As DR for a cloud app this protects against approximately nothing: same device, same browser profile, and it snapshots a storage layer that is no longer the primary store. Should be repositioned as a convenience export or removed — it must not be described as a backup system. |
| Supabase platform backups / PITR | **Unknown — needs your dashboard check** (Settings → Database → Backups). Free tier has none; Pro has daily backups; PITR is an add-on. This is the single most important DR control for the primary store. |
| Schema | ✅ Fully recoverable from git (`supabase/migrations/` is the complete, ordered schema). |
| Application data | ❌ No application-level backup existed. |

## What exists now (built + tested this audit)

- **`npm run backup:db`** — logical backup of all 25 application tables via
  the service role to `backups/db/<timestamp>/` (one JSON per table +
  manifest with row counts). Local artifacts ride the machine's existing
  Time Machine → NAS backups, giving an **off-project copy** — backups that
  live only inside the Supabase project don't survive project loss. Tables
  missing from the source (pending migrations) are noted, not failed;
  genuine dump failures exit non-zero. `backups/` is gitignored (financial
  data must never enter git history).
- **`npm run restore:db -- --dir=<backup> [--table=X] [--user-id=Y] [--apply]`**
  — upsert-based restore, parents-before-children order, dry-run by default,
  scopable to a single table or user (the realistic case: restoring one
  user's data after an incident, not only full-disaster recovery).
- **`npm run dr:drill`** — the proof. Creates a scratch user with an account
  and 25 transactions, takes a real backup, **deletes the user** (cascade
  verified empty), restores from the backup, and verifies the restored rows
  are **byte-identical** to the pre-disaster state, then cleans up. Never
  touches real users' rows.

## Drill result (2026-06-11, executed against the live dev project)

| Stage | Result |
|---|---|
| Backup (full DB, 303 rows + scratch) | 1,187 ms |
| Simulated disaster (cascade delete, verified empty) | 113 ms |
| Restore (scoped to scratch user) | 498 ms |
| Verification | ✅ byte-identical |

**PASSED.** At current data volume, application-level RTO is measured in
seconds. These numbers scale roughly linearly with row count via the
paged API.

## RPO / RTO — current posture and targets

| | Current reality | Recommendation |
|---|---|---|
| **RPO** (max data loss) | Unbounded — backups exist only when run by hand | Nightly scheduled `backup:db` (cron/launchd on this machine, or a GitHub Action with the service key as a secret) → 24 h. Supabase PITR → minutes. |
| **RTO** (time to restore) | Seconds–minutes at current volume (drill-measured), **plus** Supabase project re-creation time in a total-loss scenario | Document the runbook: new project → run migrations (`npm run db:migrate`) → `restore:db --apply` → `audit:data` to verify the invariant. |

## Actions for you (can't be done from code)

1. **Check the Supabase plan's backup status** (dashboard → Settings →
   Database → Backups). If on Free tier: no platform backups exist — the
   logical backups built today are currently the ONLY recovery path. For
   production, Pro + PITR is the right baseline for a financial app.
2. **Schedule `npm run backup:db` nightly** (happy to wire a GitHub Action
   or local launchd job on request).
3. **Run `npm run dr:drill` quarterly** — a restore drill that isn't
   repeated rots like an untested backup.

## Honest limitations

- The logical backup is **not point-in-time consistent**: tables are dumped
  sequentially, so writes landing mid-backup could produce a transaction
  whose account snapshot predates it. At single-user/dev scale this is
  negligible; at production scale, platform PITR is the consistent
  mechanism and this remains the off-project safety net.
- Restore is upsert-based: it restores deleted/changed rows but does not
  remove rows created *after* the backup (it is not a full point-in-time
  rollback).
- Stripe/Clerk hold their own state (subscriptions, identities) with their
  own durability; the runbook above recovers OUR data, after which Clerk
  users re-link on sign-in and the Stripe reconcile cron re-syncs
  subscription state — by design from the P2 work.
