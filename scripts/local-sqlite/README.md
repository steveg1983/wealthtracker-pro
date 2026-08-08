# Differential constraint harness

Applies the proposed local-edition SQLite schema and the cloud's Postgres schema
side by side, runs the same operation against both, and records what each one
does with it. Fifty-four specs, one declarative invariant each.

Nothing here touches Supabase, `src/`, `api/` or `supabase/migrations/`.

## Why

The local edition moves 87 money rules out of Postgres. DESIGN.md classifies 26
of them as *declarative* — expressible as a CHECK, a UNIQUE index, a foreign key
or a trigger, and therefore impossible for any future write path to skip. This
harness is where that claim gets executed rather than asserted.

It is deliberately scoped to the declarative set. The ~46 procedural rules need
the command verbs to exist first; they are not attempted here, and a spec that
needed one would be testing a plan rather than a schema.

## Use

```bash
bash scripts/local-db/up.sh      # once: the Postgres side needs that cluster
npm run test:local-sqlite        # both engines
npm run test:local-sqlite -- --engine=sqlite   # SQLite only, acknowledged
npm run test:local-sqlite -- --filter=s5       # one family
npm run test:local-sqlite -- --list            # what is in here
```

Exit code is 1 if any spec fails, if a fixture breaks, **or** if the Postgres
cluster is missing and `--engine=sqlite` was not asked for. A run that cannot
fill in the Postgres column says so and fails rather than printing a green
half-table.

## What this proves

- Every constraint the design calls declarative **fires**, on the write that
  should trigger it, with the refusal the design names.
- The equivalent operation is run against the cloud schema, so every row of the
  parity table is measured on both engines rather than reasoned about on one.
- Two controls prove the locks are locks and not walls: the split guard still
  opens (`s5-control-…`), and an ordinary edit still stamps `updated_at`
  (`x4-control-…`).
- One control proves the harness is not lying to itself: with
  `PRAGMA foreign_keys` off, `ON DELETE SET NULL` does nothing at all
  (`t8-control-…`). If that spec ever passes for the wrong reason, foreign keys
  have become default-on somewhere and the startup assertion has stopped
  earning its place.

## What this does NOT prove

- **Nothing procedural.** Balance identity (B-1), split sums (S-1), payee
  memory (I-6), the restore rules (X-*) and forty-odd others live in control
  flow that does not exist yet.
- **No arithmetic.** Postgres is the oracle for *behaviour*, never for
  *arithmetic* — CLAUDE.md BLOCKER #1 records that the cloud still carries
  float-derived money. `Decimal.js` is the arithmetic oracle, elsewhere.
- **No isolation.** There are no roles in a SQLite file, and
  `scripts/local-db/README.md` already concedes its own Postgres side: psql
  connects as superuser, so RLS is created and never exercised.
- **No collation-dependent behaviour.** The reference cluster is **SQL_ASCII**
  (`scripts/local-db/up.sh` must export `LC_ALL=C` or macOS aborts the
  postmaster), so its `upper()` folds ASCII only — exactly like SQLite's. On
  Supabase (UTF8) it does not. The harness prints this warning on every run and
  `x1-upper-matches-only-because-the-reference-pg-is-sql-ascii` carries a
  tripwire assertion so the day the cluster becomes UTF8 that spec fails and the
  real divergence has to be handled.
- **Not the shipped schema.** `schema.sql` here is a vendored copy of a design
  draft. It is applied to a throwaway file and to nothing else.

## Parity table

Measured 2026-08-08, after the C-3/C-4/C-5 schema amendment below. node:sqlite
3.50.0 (Node 22.17.0) against PostgreSQL 17.10 with the full migration history
applied.

`match` = both engines did the same thing. `divergent` = they differed, the spec
said so in advance, and the runner **requires** the difference (a divergence
that quietly stops diverging is a failing spec, not a bonus).

| Invariant | Postgres (cloud today) | SQLite (proposed local) | Parity |
| --- | --- | --- | --- |
| S-3 split line has a category | refused `transaction_splits_category_not_blank` | refused, same name | match |
| S-3 split line amount ≠ 0 | refused `transaction_splits_amount_nonzero` | refused, same name | match |
| S-4 split parent's category is blank | **accepted** | refused `transactions_split_parent_has_blank_category` | divergent |
| S-5 `is_split` flip is guarded | refused, cloud message | refused, character-identical message | match |
| S-5 parent amount locked | refused `split_amount_locked` | refused, identical | match |
| S-5 parent type locked | refused `split_type_locked` | refused, identical | match |
| S-5 parent category locked | refused `split_category_locked` | refused, identical | match |
| S-5 *control*: the guard still opens | accepted, sum intact | accepted, sum intact | match |
| S-6 / T-5 a transfer cannot be split | **accepted** | refused `transactions_transfer_not_split` | divergent |
| S-9 linked leg amount locked | **accepted** (leg and counterpart no longer opposite) | refused `split_leg_locked` | divergent |
| S-10 linked leg cannot be deleted | **accepted** (counterpart stranded) | refused `split_leg_line_removed` | divergent |
| T-2 transfer needs two accounts | **accepted** | refused `transactions_transfer_two_accounts` | divergent |
| T-8 deleting one leg strands the other | accepted, other leg survives unlinked | same | match |
| T-8 *control*: no FK pragma → nothing is nulled | not expressible | accepted, other leg left DANGLING | not-comparable |
| C-1 name unique per parent | refused `categories_user_id_name_parent_id_key` | refused (names the columns) | match |
| C-1 NULL parents are distinct | accepted, 2 roots | accepted, 2 roots | match |
| C-2 level enumerated | refused `categories_level_check` | refused (quotes the expression) | match |
| C-2 type enumerated | refused `categories_type_check` | refused (quotes the expression) | match |
| C-3 account insert mints its To/From category | 1 category, `To/From …\|Transfer\|detail\|both\|1` | identical | match *(was a finding; trigger now ported)* |
| C-3 / C-6 a name clash does not block account creation | account created, 1 category, first owner keeps it | identical | match |
| C-4 account rename follows into the category | `To/From Everyday (joint)` | identical | match *(was a finding; trigger now ported)* |
| C-4 closing an account hides its category | `is_active` 0, name unchanged | identical | match |
| C-4 / C-6 rename into a taken name keeps the old name | name held back, `is_active` still synced | identical | match |
| C-5 To/From category protected | refused `transfer_category_protected` | refused, same string | match |
| C-5 erasing the user cascades past the protection | 0/0/0/0 rows left | identical | match *(needs the users-row clause; see below)* |
| C-11 semantic flags exclusive | **accepted** | refused `categories_flags_exclusive` | divergent |
| C-11 `account_id` only on To/From rows | **accepted** | refused `categories_account_only_for_transfer` | divergent |
| C-12 category tree cascades | child gone; TEXT id left dangling | identical | match |
| I-1 feed id unique per connection | refused `idx_unique_external_transaction` | refused (names the columns) | match |
| I-3 import provenance all-or-nothing | refused `transactions_import_provenance_complete` | refused, same name | match |
| I-4 file-import id unique per user | refused `transactions_import_source_unique` | refused (names the columns) | match |
| I-4 unprovenanced rows never collide | accepted | accepted | match |
| I-6 payee normalisation | `CAFé FIXTURE`, 2 groups | `CAFé FIXTURE`, 2 groups | match **only because the reference cluster is SQL_ASCII** |
| U-2 audit action enumerated | refused `financial_audit_log_action_check` | refused (quotes the expression) | match |
| U-3 audit rows immutable | not exercisable (RLS, superuser) | refused `audit_immutable` | not-comparable |
| U-6 a create has no "before" | **accepted** | refused `audit_create_has_no_before` | divergent |
| R-1 account delete cascades | transactions and To/From category gone | identical | match |
| R-2 / R-3 category delete nulls the FK, not the TEXT | `category_id` NULL, `category` dangling | identical | match |
| R-4 transaction delete cascades its lines | 0 lines left | identical | match |
| **R-5 counterpart delete clears the leg link** | accepted, link cleared | **refused** `split_leg_locked` | divergent — **FINDING** |
| R-6 parent account delete un-nests the child | child survives, unnested | identical | match |
| R-7 account cannot parent itself | refused `accounts_parent_not_self` | refused, same name | match |
| R-8 optional links cleared, never cascaded | contribution and budget survive | identical | match |
| R-9 account delete takes its holdings | 0 holdings left | identical | match |
| R-11 deferred keys close the txn↔split cycle | **refused** `transactions_linked_transfer_split_id_fkey` | accepted, cycle closed in one transaction | divergent — local is better |
| A-3 reconcile sweep archives | archived | archived (second statement, same transaction) | match |
| X-4 restore preserves `updated_at` | 2019-01-01 | 2019-01-01 | match |
| X-4 *control*: an ordinary edit still stamps | MOVED | MOVED | match |
| MONEY-1 sub-penny amount | **accepted, silently rounded to −1235 minor** | refused: cannot store REAL in an INTEGER column | divergent |
| MONEY-2 per-row bound | **accepted** (£2bn) | refused `transactions_amount_bounded` | divergent |
| MONEY-3 money in the metadata blob | **accepted** | refused `transactions_no_money_in_metadata` | divergent |
| MONEY-4 FX triple all-or-nothing | **accepted** (blob enforces nothing) | refused `transactions_fx_complete` | divergent |
| MONEY-5 `sum()` past int64 | accepted, widens to numeric `9223372036854775808` | refused: `integer overflow` | divergent |
| MONEY-5 the declared money types | accepted, numeric has no cliff | refused: `integer overflow` | divergent |

54 specs, 54 passing, 16 declared divergences, 0 harness errors.

### Reading a divergence

Fifteen of the sixteen are the local file being **stricter**: the cloud enforces
the rule inside one RPC and nowhere else, and the local file makes it structural.
That is the whole argument of DESIGN.md §6, measured. R-11 is the sixteenth, and
there the local file is simply better: deferred foreign keys close the
`transactions ↔ transaction_splits` cycle in one transaction, which Postgres
cannot do.

### The schema amendment this harness caused

Two rows of the table used to read **divergent — FINDING**. They are matches now
because the harness found the gap and the schema was fixed in **both** copies
(the scratchpad original and the vendored copy here, diffed to prove they differ
by the provenance header alone):

- **C-3 / C-4** — DESIGN.md classifies both as ported triggers (`T`), and the
  DDL had neither. A new account got no To/From category; a renamed account kept
  the old category name. `trg_create_transfer_category_for_account` and
  `trg_sync_transfer_category_for_account` were written from
  `supabase/migrations/20260708140000_transfer_categories_lifecycle.sql`,
  collision guards and skip-without-anchor branch included. Both are AFTER
  triggers, so §2.3's "SQLite BEFORE triggers cannot assign to `NEW`" does not
  bite; verified compiling and firing under `PRAGMA trusted_schema = OFF`, with
  the category id built from `randomblob()` because this schema has no
  `gen_random_uuid()` default.
- **C-5 gained its third condition.** The port had dropped the cloud's
  users-row clause on the grounds that a local file has no GDPR cascade. It is
  load-bearing. Measured on this schema, both ways:

  | protection | `DELETE FROM users` | rows left (users/accounts/categories) |
  | --- | --- | --- |
  | two conditions | **REFUSED** `transfer_category_protected` | 1 / 1 / 2 |
  | three conditions | succeeded | 0 / 0 / 0 |
  | Postgres, same op | succeeded | 0 |

  Without it, erasing a user is refused outright and nothing at all is deleted.
  `c5-erasing-a-user-cascades-past-the-protection` is the control that keeps it
  there.

Side effect worth noting: **C-6 moved from procedural to declarative.** DESIGN.md
marks the collision guard `P`; ported into the trigger bodies it is now a
property of the file, and two specs pin it (`c3-a-name-clash-…`,
`c4-a-rename-into-a-taken-name-…`).

The one finding that is **still open**:

- **R-5** — intent holds on both engines (no cascade, ever), but SQLite applies
  `ON DELETE SET NULL` as an UPDATE of the child row, which fires
  `trg_protect_linked_leg` and aborts the whole delete. So deleting a transfer
  whose counterpart is a split leg is impossible outside `_rpc_guard('leg')` —
  including via the remedy the error message itself recommends. The command
  layer must hold the leg guard while deleting any transaction a split line
  links to. This is a command-layer obligation, not a schema bug, so it is
  recorded in the Phase 1 plan rather than fixed here.

### Reading a refusal

The engines name rules differently, and the specs record both:

| | Postgres | SQLite |
| --- | --- | --- |
| named table constraint | `violates check constraint "x"` | `CHECK constraint failed: x` |
| **unnamed inline CHECK** | still named (`categories_level_check`) | quotes the **expression**: `CHECK constraint failed: level IN ('type','sub','detail')` |
| unique index | names the index | names the **columns** |
| trigger | the `RAISE EXCEPTION` message | the `RAISE(ABORT)` message, character-identical where it was copied |

Where a rule is unnamed inline in `schema.sql`, its refusal has no name to
match on. Naming those constraints would make the local error messages as
diagnosable as the cloud's — a cheap change to the schema, not to this harness.

## Layout

```
schema.sql              vendored copy of the design's DDL, with a provenance header
fixtures/base.*.sql     the same starting state, hand-written per engine
specs/*.spec.mjs        one invariant per file, both engines, declared parity
specs/_setups.mjs       setup fragments used by more than one spec (not a spec)
lib/sqlite.mjs          node:sqlite runner
lib/postgres.mjs        psql runner against the scripts/local-db cluster
lib/specs.mjs           loader; rejects any spec shape it does not recognise
run.mjs                 the runner and the parity table
```

## A spec

```js
export default {
  invariant: 'S-4',                 // the row in DESIGN.md §1 this defends
  title: '…',                       // what a reader should take away
  design: 'DESIGN.md §1.2 S-4; …',  // where the rule is written down
  consequence: '…',                 // what goes wrong if it is lost — money terms
  parity: 'divergent',              // match | divergent | not-comparable
  reason: '…',                      // required unless parity is 'match'

  sqlite:   { setup, action, expect: { outcome: 'refused', message: '…' } },
  postgres: { setup, action, expect: { outcome: 'accepted' } },

  verify: [{ name, sqlite: 'SELECT …', postgres: 'SELECT …', expect: '1' }],
};
```

- **`action`** is the statement under test. Anything else goes in `setup`, and a
  setup that fails is reported as a HARNESS ERROR — never as a constraint firing.
- **`expect.message`** must name the refusal. "it errored" is not proof: a typo
  in the fixture errors too.
- **`verify`** entries are shared assertions: same name, one SELECT per dialect,
  compared across engines as well as against `expect`. Use
  `expect: { sqlite, postgres }` when a divergence has two right answers, and
  `only: 'postgres'` for a tripwire about the environment rather than a
  comparison (it never counts towards parity).
- **`parity`** is checked against reality. Declare `match` and diverge, or
  declare `divergent` and match, and the spec fails. Specs cannot go vacuous
  quietly.

Each spec runs inside a transaction that is rolled back, on a connection whose
`PRAGMA foreign_keys` is asserted before every spec. Two specs need
`isolation: 'fresh-db'` and say why in place: deferred foreign keys are only
checked at COMMIT, and the FK-pragma control needs a connection of its own.

## Driver choice

`node:sqlite`, the runtime's own binding, over `better-sqlite3`.

- No new dependency, and no native compile in `npm ci` — a schema harness is not
  worth a node-gyp failure mode on every install, in CI or on a new machine.
- The Phase 0 storage spike measured `node:sqlite`, so the timings in DESIGN.md
  §4 and the constraints proved here come from the same engine.
- The costs, stated rather than buried: it is flagged **experimental** in Node 22
  (the npm script passes `--disable-warning=ExperimentalWarning`, and the runner
  prints "experimental" in its banner instead), and it carries the SQLite that
  Node bundles — **3.50.0** here, where the design's own smoke test used the
  system CLI's **3.54.0**. The runner prints both versions on every run and
  asserts the minimum the schema needs (3.37, for STRICT tables).

## Proof that the specs are not vacuous

Comment out `transactions_split_parent_has_blank_category` in `schema.sql` and
`s4-split-parent-category-is-blank` fails twice over — the expected refusal does
not happen, and the declared divergence collapses into a match:

```
── s4-split-parent-category-is-blank              [S-4] FAIL
   sqlite     accepted categorised_split_parents=1
              ✗ expected refused, got accepted
   parity     DECLARED divergent, OBSERVED match
1 specs · 0 passed · 1 failed          (exit code 1)
```

Restore it and it passes. The same holds for triggers: comment out
`trg_protect_linked_leg_delete` and `s10-linked-leg-cannot-be-removed` fails the
same way.

Every trigger added by the C-3/C-4/C-5 amendment was checked the same way:

| removed from `schema.sql` | specs that fail |
| --- | --- |
| `trg_create_transfer_category_for_account` | 4 — both C-3 specs and both C-4 name specs (no category exists to sync) |
| `trg_sync_transfer_category_for_account` | 3 — rename, close, and the clash spec |
| C-5's users-row clause | 1 — `c5-erasing-a-user-cascades-past-the-protection`, refused `transfer_category_protected` |

That third table row is why `c4-a-rename-into-a-taken-name-keeps-the-old-one`
now also closes the account: its first draft asserted only that the category
**kept** its old name, which is trivially true when the trigger does not run at
all — it passed with the trigger deleted. Asserting that `is_active` synced
anyway is what makes it discriminate between "the guard held the name back" and
"nothing happened".

## Keeping it honest

- `schema.sql` is a **copy**. Change the design, re-copy, re-run. A change made
  only here is drift and the parity table stops meaning anything. When the
  harness's own findings changed the schema (C-3/C-4/C-5), both copies were
  edited in the same change and the identity re-proved:

  ```bash
  diff <(tail -n +35 scripts/local-sqlite/schema.sql) <scratchpad>/local-core/schema.sql
  # no output — the copies differ by this file's 34-line provenance header alone
  ```

  The schema is now **20 tables, 18 triggers, 56 indexes, 2 views** (it was 16
  triggers; DESIGN.md's line 7 still says 16 and belongs to the design author to
  update).
- All fixture data is invented. This repo is public: no real payee, account
  number or figure belongs in it.
- The Postgres cluster is shared with `scripts/local-db`; nothing in that
  directory was modified to make this work.
