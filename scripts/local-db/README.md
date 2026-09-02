# Local database harness

Spins up a throwaway PostgreSQL, applies the whole migration history to it, and
runs SQL tests against the result. Nothing here touches Supabase.

## Why

Until this existed, a migration's first execution was against a real database.
`20260807083000_user_data_restore.sql` was written, applied here, and failed
three times before it was correct — a bad column list, a trigger that re-dated
restored history, and a chunk the test never sent. None of that should be
discovered in production.

## Use

```bash
brew install postgresql@17     # once, on macOS
bash scripts/local-db/up.sh    # init + start + apply every migration
bash scripts/local-db/test.sh  # run the SQL tests
bash scripts/local-db/down.sh  # stop and delete the cluster
```

`WT_PGDATA` (default `/tmp/wtpg`) and `WT_PGPORT` (default `55432`) pick the
cluster, so a second one can be stood up beside the first without disturbing it
— which is how the from-scratch run below was checked.

**Finding the binaries.** `pgbin.sh` is sourced by all three scripts and locates
`initdb`/`pg_ctl` itself: `WT_PGBIN` if set, then homebrew's
`postgresql@17`, then Debian's `/usr/lib/postgresql/<major>/bin` (highest
version). This used to be one hardcoded homebrew path in three places, which was
true on one machine. CI runs on Linux, where those are *server* binaries and
Debian deliberately keeps them off `PATH`. `up.sh` refuses with instructions if
none is found; `down.sh` does not, because it must still be able to clean up on
a machine where Postgres has since been removed.

`audit-trigger.test.sql` is the third test and the one that most needs a real
server: it proves the deferred audit triggers of
`20260902120000_a_change_is_audited_wherever_it_is_made.sql` record a change
made in psql while adding nothing to a change an RPC already logged. Deferred
constraint triggers, `ON COMMIT DELETE ROWS` and `pg_trigger_depth()` all behave
differently from any mock of them, so the answer is only worth having from
PostgreSQL itself.

## Caveats, so the harness is not mistaken for the real thing

- **Supabase's `auth` schema is stubbed.** `auth.uid()`, `auth.role()` and
  `auth.jwt()` are local stand-ins reading `request.jwt.claims`. Identity in the
  tests is set with `set_config('request.jwt.claims', '{"sub":"..."}', false)`.
- **RLS is created but never exercised** — psql connects as superuser, which
  bypasses it. These tests prove logic, not isolation. Row-level isolation is
  still only provable against a real Supabase (`npm run test:supabase-smoke`).
- Migrations are applied in **three passes** because filename order is not
  dependency order — the baseline dump sorts after some files it contains, so a
  file can fail on pass 1 for want of something a later file creates.
- **Every migration applies.** Measured 2026-08-12 on a cluster built from
  scratch: `unapplied: 0`.

  This README said "four migrations do not apply" for months and the script
  agreed with it, reporting seven. **Both were an accounting bug.** A migration
  that succeeded on pass 1 was re-run on passes 2 and 3, where it failed with
  *"already exists"* on its own work, and the number printed was the last pass's
  failures — so every non-idempotent migration in the history counted as
  unapplied. Three of the seven were the local edition's own
  (`rows_cannot_name_a_foreign_account`, `preferences_that_travel`,
  `repoint_transfer`) and all three were present in the catalog the whole time.
  `up.sh` now skips what has already succeeded, so *unapplied* means unapplied.

  The reason this mattered enough to fix: a nightly builds this cluster from
  nothing every run, and a line reading `unapplied: 7` in a CI log is one that
  has to be investigated by hand before anyone can tell whether it is a problem.
- **`up.sh` exits 0 even so, on purpose.** It is not the gate. If a migration
  that matters ever fails, a spec in `scripts/local-sqlite` goes red and names
  the constraint it wanted — a better error than any count printed here.
