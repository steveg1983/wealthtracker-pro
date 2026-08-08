# Differential constraint harness

Applies the proposed local-edition SQLite schema and the cloud's Postgres schema
side by side, runs the same operation against both, and records what each one
does with it. Sixty-six specs, one declarative invariant each.

**Three lanes live in this directory now**, and they ask three different
questions. `run.mjs` asks whether a SCHEMA refuses a write; `verbs.mjs` asks
whether two implementations of one OPERATION agree; `admission.mjs` asks whether
two implementations of one DECISION agree, where the second implementation is
the TypeScript that ships today. The third has its own section at the bottom of
this file, and it is the one that closes Phase 1.

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
| R-12 a row filed against a stranger's account | refused `transactions_account_id_user_fkey` | refused `FOREIGN KEY constraint failed` | match |
| R-12 a row MOVED onto a stranger's account | refused `transactions_account_id_user_fkey` | refused, same key | match |
| R-12 re-owning a row without its account | refused `transactions_account_id_user_fkey` | refused, same key | match |
| R-12 a transfer's far side is a stranger's account | refused `transactions_transfer_account_id_user_fkey` | refused, same key | match |
| R-12 a split leg's target is a stranger's account | refused `transaction_splits_transfer_account_id_user_fkey` | refused, same key | match |
| R-12 an account nested under a stranger's | refused `accounts_parent_account_id_user_fkey` | refused, same key | match |
| R-12 a category scoped to a stranger's account | refused `categories_account_id_user_fkey` | refused, same key | match |
| R-12 a goal tied to a stranger's account | refused `goals_account_id_user_fkey` | refused, same key | match |
| R-12 a holding in a stranger's account | refused `investments_account_id_user_fkey` | refused, same key | match |
| R-12 deleting an account clears the reference, keeps the owner | accepted, four references cleared, `user_id` intact | identical — by a trigger, not by the key | match |

64 specs, 64 passing, 16 declared divergences, 0 harness errors.

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

### R-12, the ownership pairing — an amendment the CLOUD caused

The third amendment to `schema.sql` (2026-08-08) went the other way: the cloud
changed first and this file owed it a match.
`supabase/migrations/20260808170000_rows_cannot_name_a_foreign_account.sql`
widened **seven** foreign keys from `(account)` to `(account, owner)` and added
the anchor they point at, `UNIQUE (accounts.id, accounts.user_id)`, so that
"this row's account belongs to this row's user" is the only shape the table will
accept rather than a `WHERE` clause every writer must remember. Its header
RECORDED the parity obligation and deliberately did not act on it; the ten
`specs/r12-*` files are that obligation discharged.

R-12 is **new**. It is not one of DESIGN.md §1.8's eleven referential rules, and
the number is the next one after R-11.

**The one place the engines reach the same behaviour by different mechanisms.**
Four of the seven were `ON DELETE SET NULL`, and on a two-column key that has to
mean "null ONE column" — the other is `user_id`, `NOT NULL` on all four tables.
Postgres says so in the key (`ON DELETE SET NULL (transfer_account_id)`, v15+).
SQLite cannot. MEASURED (`probe-composite-fk.mjs`, SQLite 3.50.0):

| written | SQLite does |
| --- | --- |
| `ON DELETE SET NULL (pid)` | `near "(": syntax error` — no such syntax |
| bare `SET NULL`, child `uid` NULLABLE | nulls **both** columns |
| bare `SET NULL`, child `uid` `NOT NULL` | **refuses the parent DELETE**: `NOT NULL constraint failed` |

So the four keys carry SQLite's default action and `trg_unnest_account_
references` — a `BEFORE DELETE` trigger on `accounts` — clears the account
column and leaves the owner alone. Behaviour is identical including the part
nobody would think to check: a native SQLite `SET NULL` fires the child's own
triggers, so the `updated_at` bump the FK action used to cause still happens,
from the trigger's `UPDATE` instead (`probe-fk-triggers.mjs`, cases A and C:
`updated_at = BUMPED` either way). And the arrangement fails **loud**: strip one
arm of the trigger and the account DELETE is refused by the key rather than
silently orphaning the row — measured, and it is how
`r12-deleting-an-account-clears-the-reference-and-keeps-the-owner` proves it is
not vacuous.

**A second reason SQLite needs the anchor.** Postgres wants the parent pair to
be unique; SQLite wants it to be covered by a UNIQUE **index** specifically, and
without one every child insert fails with `foreign key mismatch - "transactions"
referencing "accounts"` — a message about the schema that says nothing about the
row. Verified.

**What the pair of "not yours" / "no such account" specs does now.** Both cases
are refused by the same key with the same wording, so the two specs that exist
to keep them apart can no longer do it by reading the error. They do it by
reading the database: `r12-a-row-cannot-be-filed-against-a-strangers-account`
asserts the named account **is present** (only the ownership half can refuse
that one), and its create-verb sibling asserts the opposite. The migration
refused to give the widened keys their old names back for exactly this reason —
a green spec that has quietly stopped distinguishing its two cases is worse than
a red one that says so.

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

---

# The VERB harness (`verbs.mjs`) — a sibling, not an extension

```bash
bash scripts/local-db/up.sh                                            # once
~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli
npm run test:local-verbs
npm run test:local-verbs -- --filter=b2      # one family
npm run test:local-verbs -- --list           # what is in here
```

`npm run test:local-sqlite` and this are separate suites with separate runners.
The constraint suite is **64/64** — it was 54 until the R-12 work above added
ten, which is where a rule about what a table will HOLD belongs.

## The different question it asks

The 64 constraint specs prove that **a schema refuses a write**. A verb spec
proves that **two implementations of one operation agree** — on what they
return, on what they refuse, *and* on the rows they leave behind.

That difference shows in the spec shape and is the reason for a second runner.
A constraint spec carries SQL per engine, because the two schemas are different
shapes. A verb spec carries **one payload**, sent to both:
`create_transaction_atomic(p jsonb)` and `wealth-core-cli`'s `create_transaction`
take the same key names, because the Rust command struct was written from the
RPC's column list. If a spec ever needed to send two different payloads, the two
things would not be implementations of one verb and there would be nothing to
compare.

Two of the three RPCs take their arguments **positionally** —
`update_transaction_atomic(p_id, p, p_user_id)` and
`delete_transaction_atomic(p_id, p_user_id)` — so the one-payload rule is kept by
having `lib/verb-postgres.mjs` unpack the same object into the call:

```sql
public.update_transaction_atomic(
  (payload->>'id')::uuid,
  COALESCE(payload->'patch', '{}'::jsonb),
  NULLIF(payload->>'user_id','')::uuid)
```

The Rust command struct has exactly those three fields for the same reason.
Neither engine is handed a shape the other never saw, and the alternative —
letting each side have its own payload — is precisely how two implementations
stop being comparable.

### The verbs, and what each one is for

Twenty-one, and the list is the order they were ported in. The first twelve are
the ledger and its families; the restore family, the prune and the checker close
the ledger core; the ingest pair opens the surface through which every
transaction that nobody typed arrives.

| verb | ported from | why it is in Phase 1 |
| --- | --- | --- |
| `create_transaction` | `20260808150000:168-226` (was `20260808100000:119`) | the smallest verb that touches all four things the port is most likely to get wrong: relative balance arithmetic in SQL, a refusal SQLite will not raise for you, an audit row in the same transaction, and money crossing a boundary |
| `update_transaction` | `20260808100000:282-375` | the one that cannot be guessed: fifteen settable fields with **four** behaviours between them for the same `""`, and two shapes of balance movement |
| `delete_transaction` | `20260610150000:207-243` | the smallest body and the largest trap — the R-5 leg guard, without which the local file refuses a delete the cloud performs |
| `set_transaction_splits_with_legs` | `20260806094058:121-492` | the largest function in the schema and the one PHASE1-PLAN §6.3 says to sequence early *because* it is: balance, splits, transfers and audit in one call, twenty reachable refusals whose **order** is part of the contract, and three audited entities |
| `link_transfer_pair` | `20260716100000:65-147` | the Money model's "both sides already exist, join them" — balance-neutral **by construction**, and the source of the guard block three other functions copy |
| `create_transfer_counterpart` | `20260721090000:17-112` (redefines `20260716100000:151`) | the only verb in the transfer family that moves money: it mints the other side and moves that account. Ported from the LIVE definition, because the original predates T-9's currency guard |
| `clear_transfer_links` | `20260805145035:101-155` | the audited unlink. Establishing that this *is* the unlink path — the client stopped doing a table UPDATE in the same migration — was half the work |
| `repair_claimed_transfer` | `20260805145035:260-450` | twelve refusals, three rows written exactly once each, and the only place in the whole schema that checks mutual linkage (T-7) |
| `link_split_line_transfer` | `20260806094058:509-623` | pairs an existing split LINE with an existing row. Carries T-10 — amounts compared against the **line**, never the parent — which DESIGN.md calls the single most-likely-to-be-mis-ported rule in the schema |
| `merge_categories` | `20260805214322:82-396` | the largest refusal list in the schema — **seventeen** sites, sixteen codes, all reachable (the commissioning brief said twelve). Four reference surfaces moved in one transaction, three new audited entities, and the second verb in the crate to need an `_rpc_guard` |
| `apply_category_to_uncategorized` | `20260808180000:230-262` (which restored the guard `20260808100000:387` dropped from `20260713100000:275`, itself a redefinition of `20260708100000:200`) | payee memory across the blanks. Ported from the LIVE definition — and tracing all four is how the port found the regression below |
| `confirm_transaction_categories` | `20260808100000:440-478` | the smallest verb in the crate, and the only one whose safety comes from an argument that is **not there**: it takes no category, so it cannot change one |
| `import_transactions` | `20260808140000:234-402` (four definitions deep: `20260709120000:20` → `20260808090000:162` → `20260808100000:183`) | every file import in the app, and the one verb whose headline is a thing that must not happen **twice**. Five refusals whose ORDER is measured — including a genuine surprise, a malformed request being named before the caller is told the account is not theirs — and an `idempotent` flag that describes THE REQUEST rather than the function |
| `import_bank_transactions` | `20260808100000:552-724` (over `20260807180000` over `20260722140000:53` over `20260708100000` over `20260613090000`) | the bank feed's whole write path, ported for a local edition that will probably never have a feed — because a restored cloud backup carries feed-written rows, and because **B-4's first-import rebase lives here and nowhere else**: the only place in the schema where an import moves `initial_balance` instead of `balance` |

**Not ported, and neither is an omission.** The transfer-category lifecycle
(`create_transfer_category_for_account`, `sync_transfer_category_for_account`,
`protect_transfer_category`, all `20260708140000`) all `RETURN trigger`, nothing
in `src/` or `api/` calls them, and `schema.sql` already carries them as C-3, C-4
and C-5. And there is **no create/update/delete-category verb because the cloud
has no such RPC** — `PlanningService` writes the table directly
(`planningService.ts:479`, `:567`, `:638`), so the authority for those operations
is the table plus its constraints, which the 64 constraint specs already cover.
One category RPC that DOES exist is deliberately not ported and the decision is
written down in `verbs/mod.rs`: `migrate_categories_atomic`, the one-way door
between the localStorage id space and the cloud's uuids, which has no meaning in
a file that was never on the cloud. `delete_unused_categories` was the other name
on that list and it is ported.

**`import_transactions` here means the RPC, not PHASE1-PLAN §3.2's planner.**
There are two things in the Phase 1 documents with that name. The verb in this
table is the port of `import_transactions_atomic` — the write path that exists
today, which stores rows whose fields have already been decided. §3.2's
`import_transactions` is the later, larger admission-control verb over `RawRow`,
which decides what a file's TEXT means and enforces some thirty invariants with
no SQL side at all. When it is built it is the layer above this one; naming both
here is cheaper than discovering the ambiguity from a bug.

The split writer is the only one whose RPC does not return a transaction row —
it returns `{is_split, split_count, amount, counterparts}` — so
`lib/verb-postgres.mjs` PERFORMs it and then projects the split PARENT through
the same `ROW_JSON` every other verb uses. Everything the RPC's own return value
carries is asserted through `state` SELECTs instead, which is where cross-engine
comparisons of rows belong. Its `p_splits` argument is passed with `->` and
deliberately **not** coalesced, so that an absent key arrives as SQL NULL and the
RPC's first refusal — *"p_splits must be a jsonb array"* — stays reachable from a
payload.

The five transfer verbs are projected the same way, and **which row** each one
projects is part of the contract — it is the row the Rust side returns under its
own `transaction` key, so the two engines are compared on the same row rather
than on whichever each found convenient:

| verb | projected row |
| --- | --- |
| `link_transfer_pair` | `id_a` (the RPC's `a`) |
| `create_transfer_counterpart` | `id` (the RPC's `source`) |
| `clear_transfer_links` | `ids[0]` — the first row NAMED, and **absent** when the list is empty, which is a real outcome both engines report |
| `repair_claimed_transfer` | `stranded_id` |
| `link_split_line_transfer` | `transaction_id` |

`clear_transfer_links` takes a `uuid[]`, so `lib/verb-postgres.mjs` rebuilds one
from the payload's JSON array rather than passing jsonb: its two headline
guarantees — all-or-nothing, and `count(DISTINCT)` — are array-shaped. The two
provenance verbs take the same shape and are handled the same way.

The category family projects one row each, and `merge_categories` is the awkward
one because its payload contains no transaction id at all:

| verb | projected row |
| --- | --- |
| `merge_categories` | the FIRST whole transaction the merge moves, in id order — captured **before** the call, because afterwards those rows point at the target and are indistinguishable from rows that always did |
| `apply_category_to_uncategorized` | `ids[0]` — the first row NAMED, and absent when the list is empty |
| `confirm_transaction_categories` | `ids[0]` |

Computing "the first row the merge will move" in the harness means repeating the
RPC's own first `WHERE` clause, which is exactly the sort of thing that can
silently agree with a wrong implementation. It is safe here for a specific
reason: if the two sides pick different rows, `row.id` differs and the runner
reports a divergence. A mismatch is loud, not absorbed. Everything the projection
cannot carry — the five counts, the split lines, the budgets, the recurring
templates, the audit shape, and the fact the source category is gone — is
asserted through `state` SELECTs.

### A state assertion's NAME is load-bearing

Results are collected into a `Map` keyed by `name`, so two `state` entries
sharing one silently discard the first. `lib/verb-specs.mjs` now refuses a
duplicate outright, and adding that check found **two specs that had been
asserting less than they said** for as long as they had existed:

* `repair-the-whole-re-pair-happens-in-one-transaction` asserted
  `auditRowsForUpdate` on all three rows the repair writes — the whole of T-14 —
  and all three were called `audit_rows_for_this_update`, so only the last was
  ever checked;
* `split-a-parent-whose-account-is-not-yours-…` asserted `splitLines` on two
  different parents under one name, and the first was dropped.

Every per-row helper in `_shared.mjs` now carries the row's last four characters
in its name. Both specs still pass with their assertions actually running, which
is the good outcome — but neither was proving what it claimed, and nothing would
have said so.

### Layout

```
verb-specs/*.spec.mjs   one invariant per file, ONE payload, declared parity
verb-specs/_shared.mjs  ids, setup fragments and the assertions every spec repeats
lib/verb-specs.mjs      loader; rejects any spec shape it does not recognise
lib/verb-sqlite.mjs     spawns wealth-core-cli against a fresh temp database
lib/verb-postgres.mjs   psql, and the one place each verb is mapped onto its RPC
verbs.mjs               the runner and the verb parity table
```

`_shared.mjs` is where a setup fragment belongs the moment a second spec wants
it. Two things in there are worth knowing before writing a spec:

* every fragment keeps **B-1 true before the verb runs**, moving the balances its
  inserts imply. `specs/_setups.mjs`'s version of the same split-leg shape does
  not, because the constraint harness does not assert the identity and this one
  asserts it on every spec including the refusals;
* `storedText` normalises three states the engines spell differently and that
  otherwise all render as a blank line — `ABSENT` (no such row), `NULL`, and
  `EMPTY` (the empty string). The whole update-verb sentinel table turns on
  telling the last two apart, so reading them by eye is not an option.
* the split helpers (`splitLines`, `rowsIn`, `legPairsAreMutual`,
  `splitSumHolds`, `auditShape`) render a whole **set** of rows as one canonical
  string, because a split is never one row. Three rules make that comparable
  across engines: money goes through `money-sql.mjs` (integer division on one
  side, `::text` on the other, and no float anywhere); a category is rendered by
  **name**, because a To/From category is minted by a trigger and its id is
  unknowable on both sides; and a link is rendered as the *fact* `linked`, never
  as an id, because a counterpart minted during the call gets a different uuid on
  each engine and always will.
* `namedTransferCategories` does the one thing the base fixture's own comment
  forbids assuming — it gives the two To/From categories ids a payload can name.
  Renaming them in a setup is not the same as assuming the generated ones, and it
  is the only way to write a payload that files a line under a To/From category,
  which is what `split_leg_not_declared` and `split_leg_category_mismatch` need.

## What is compared

1. **The outcome** — accepted or refused — against what the spec declared, per
   engine.
2. **The refusal, by name.** Same rule as the constraint harness: "it errored" is
   not a proof.
3. **The returned row, field by field, across engines.** Not just the fields a
   spec thought to assert: *every* field of the canonical projection, minus any
   the spec declares in `rowDivergence` **with a stated reason**, minus `id` when
   the payload did not supply one. Money is a decimal string on both sides, so
   nothing goes through a float to be compared.
4. **The database afterwards** — `state` assertions, one SELECT per engine, run
   on a **fresh** connection after the command committed. Every spec asserts B-1
   (`balance = initial_balance + Σ amount`), including the refusals: a verb that
   refuses must leave the identity holding just as much as one that accepts.
5. **Observed parity**, computed from 1/3/4 with the label ignored. A divergence
   that quietly stops diverging is a FAILURE.

### One engine, when there is only one to run

`parity: 'not-comparable'` plus `skip: { postgres: '<why>' }` says the other
engine has no counterpart to compare against. It is the same declaration
`lib/specs.mjs` has always carried for a constraint only one schema has, and it
arrived in the VERB harness on 2026-08-08 for `verify_integrity`, which is **not
a port of anything**: the cloud has no such function, no such view and no
equivalent (traced in `crates/wealth-core/src/verbs/verify_integrity.rs`; the
only Postgres relatives are two throwaway verification SELECTs inside
migrations).

Three things stop it becoming a way to duck a comparison:

* the loader refuses `skip` without `not-comparable` and refuses
  `not-comparable` without exactly one skip, so the two declarations cannot
  disagree;
* a skipped engine must state WHY, in prose, in the spec file;
* the runner reports it in the parity table as `not-comparable` and counts it
  separately in the summary line, so a family of single-engine specs cannot be
  read as a family of passes.

A verb that HAS a cloud counterpart cannot use it, because the Postgres driver
maps verbs by name and a spec that skipped Postgres for a mapped verb would be
declaring a comparison it could have made.

## The bridge

`crates/wealth-core` exposes `wealth-core-cli` behind `--features cli`: JSON
command on stdin, JSON result on stdout, one process per spec.

Chosen over a napi-rs / node-gyp addon for the reason `lib/sqlite.mjs` already
gives about native devDependencies in this repo — "a prebuild/rebuild failure
mode on every `npm ci`". A spawned binary has zero npm surface: `npm ci`,
`npm run build` and `npm test` never learn Rust exists. It also matches the
Postgres driver, which spawns `psql` per spec, so neither engine gets a
structural advantage. Measured cost: **2.50 ms** median per spawn (40 runs,
3 warm-ups); the 16-spec suite was **0.66 s** wall clock including Postgres, and
67 specs run in about 3.4 s.

Node owns the file. It creates the temp database, applies `schema.sql` and the
shared fixture through `node:sqlite` — the same code path the 64 constraint
specs use — hands the *path* to Rust, and re-opens the file afterwards for the
assertions. So the verb runs against the **vendored** schema, and the crate
`include_str!`s that same file, so there is only ever one.

## Three SQLite versions are now in play, and the runner prints two of them

| where | version | what it does |
| --- | --- | --- |
| DESIGN.md's smoke tests | 3.54.0 (system CLI) | where the schema's behaviours were first verified |
| `node:sqlite` | 3.50.0 | applies the schema and the fixtures, and runs the assertions |
| `rusqlite` `bundled` | 3.46.0 | **runs the verb** |

All three are above the 3.37 floor `STRICT` needs and the file format is
compatible, so this is not a defect — but the engine that *enforces* a constraint
during a verb spec is not the engine that applied the schema, and that is worth
knowing before debugging a surprising refusal. Both are printed on every run.

## The proof that the specs are not vacuous

Each of these was executed, then reverted.

**From the create verb (2026-08-08, 16 specs):**

| break | result |
| --- | --- |
| drop the delta: `SET balance_minor = balance_minor + ?1` → `= balance_minor` | **10 of 16 specs fail**, on `balance_of_*` and on B-1 (`expected 0.00, got 12.34`), and 10 flip to `MISDECLARED (divergent)`. The *returned row* is still correct — only the state assertions catch it, which is the whole argument for asserting state |
| disable the `changes()` assert (`if false && moved != 1`) | `b2-an-account-owned-by-somebody-else-is-refused-by-name` fails four ways: SQLite **accepts**, a row lands against another login's account, B-1 breaks by 10.00, and an audit row is written for a transaction that should not exist. Postgres still refuses, so parity goes `MISDECLARED` |
| make `Money::parse` truncate instead of refusing a sub-penny amount | `money1-…` fails five ways (`expected refused, got ok`; `stored_amount ABSENT` vs `-12.34`; the balance moved; a row and an audit row appeared). Note it still *reports* `divergent`, because truncating and rounding disagree too — the label alone would not have caught it and the **named** expectations did |

**From the update and delete verbs (2026-08-08, 38 specs):**

| break | result |
| --- | --- |
| flip the delete's reversal: `balance_minor - ?1` → `+ ?1` | both R-5 specs fail on `balance_of_*` and B-1 (`expected 0.00, got -50.00` / `30.00`), and **5 of the 12** delete integration tests fail — including `the_delete_verb_moves_no_balance_by_assignment`, the structural one |
| remove the leg guard: `let guarded = false;` | both R-5 specs fail with `expected ok, got refused: constraint_violated` and six state assertions each; 4 of 12 crate tests fail. This is the divergence the guard exists to close, reproduced on demand |
| narrow the guard to the addendum's own wording (`WHERE linked_transfer_id = ?1` only) | the inbound spec **passes** and `r5-a-split-parent-whose-own-line-is-a-leg-can-still-be-deleted` **fails**. This is the measurement behind the finding that the recorded obligation covered one of two directions |
| implement TS-T3 uniformly: treat `account_id: ''` as a clear | `update-transaction-an-empty-account-id-keeps-the-old-account` fails with `expected ok, got refused: constraint_violated` — the NOT NULL violation the verb's module docs predict for exactly this mistake |
| `NULLIF` the verbatim-text fields: `patch.notes.value()` → `non_empty(&patch.notes)` | `update-transaction-an-empty-string-is-stored-verbatim-in-the-text-fields` fails twice — `result.notes: expected "", got null` and `stored_notes: expected EMPTY, got NULL`. Without the `EMPTY` sentinel in `_shared.mjs` these two are the same blank line and the break would pass |
| drop the `is_cleared` passthrough again (the original rebase, re-created) | `create-transaction-honours-is-cleared-on-both-engines` fails three ways against the **repaired** reference cluster, which is the tripwire working in the direction it was flipped to face |

**From the split writer (2026-08-08, 67 specs):**

| break | result |
| --- | --- |
| disable the sum check (`if false && sum != expected.minor()`) | `split-the-lines-must-sum-to-the-amount-the-client-saw` fails five ways: SQLite **accepts**, the parent becomes `-30.00`, Everyday moves to `-30.00`, a third line lands, and an `account/update` audit row appears for a move the user never agreed to. Postgres still refuses, so parity goes `MISDECLARED (divergent)` |
| drop the pinned-leg **amount** check | `split-a-linked-legs-amount-is-pinned-by-its-counterpart` fails on the name: SQLite refuses `split_write_inconsistent` where Postgres refuses `split_leg_amount_locked`. Worth reading twice — the refusal that caught it is the "unreachable" self-check at `:431-443`, doing exactly the job its own comment claims. Both engines refuse, so the parity label alone would have passed it; the **named** expectation is what failed |
| hoist the stored-line lookup above the category lookup (the order a section-wise reading suggests) | `split-an-unknown-category-is-named-before-an-unknown-line` fails: SQLite says `split_line_not_found`, Postgres says `unknown category`. This is the ordering measurement made executable |
| drop the verb's own leg-removal refusal | **the spec passed** — and that is a finding, not a pass. `trg_protect_linked_leg_delete` in `schema.sql` raises a message containing `split_leg_line_removed` too, so matching on the code could not tell the verb from the file. The spec now expects `transferring to "Rainy day"`, which only the verb's message carries, and with that change the same break fails. Recorded because it is the one case where a name was not specific enough to be a proof |

**From the transfer family (2026-08-08, 124 specs):**

| break | result |
| --- | --- |
| drop the zero disjunct from T-1's predicate (`v_x.amount = 0 OR …`) | `transfer-pair-two-zero-rows-are-not-a-transfer` fails four ways: SQLite **accepts**, both rows become linked transfers filed under each other's To/From categories, and two audit rows appear for a transfer that moves nothing. Postgres still refuses. The crate unit test `opposite_means_exactly_opposite_and_non_zero` fails too — `0 <> -0` is false, which is exactly why the disjunct is not redundant |
| check T-15 in one direction only (drop `partner.linked = counterpart.id`) | the first direction's spec **passes** and `repair-the-pairing-is-checked-in-the-other-direction-too` fails six ways: SQLite accepts, all three rows are rewritten, `transfer_links_are_mutual` flips from the expected `BROKEN` to `MUTUAL` (a half-undone pairing "repaired" into two one-sided links), and three audit rows appear. `tests/transfer_family.rs::a_repair_refuses_a_pair_that_is_no_longer_mutual_in_either_direction` fails on the same direction. Two specs, because one would have passed |
| swap two refusals: `is_split` above the zero-amount check in `create_transfer_counterpart` | `counterpart-a-zero-split-parent-is-told-it-is-zero-not-that-it-is-split` fails on the NAME — SQLite says `split_cannot_become_transfer`, Postgres says `a zero-amount transaction cannot become a transfer`. **Both engines still refuse**, so the parity label alone passes it; only the named expectation catches it. That is the measurement of §"the refusal order is part of the contract" made executable |

**From the category family (2026-08-08, 172 specs):**

| break | result |
| --- | --- |
| remove the merge's leg guard: `let guarded = false && …` | `merge-a-linked-transfer-leg-is-re-filed-and-stays-paired` fails with **Postgres `ok` and SQLite `refused: constraint_violated`** — the R-5-class divergence in its purest form, plus four state assertions and `MISDECLARED (divergent)`. Two crate tests fail with it. This is the finding the guard exists for, reproduced on demand: the cloud performs this merge, and an unguarded local edition refuses it |
| disable the direction guard: `if false && target.kind != source.kind` | `merge-income-and-expense-do-not-mix` fails five ways — SQLite **accepts**, the source is GONE, the transaction is re-filed across the income/expense boundary, and two audit rows appear. Postgres still refuses, so parity goes `MISDECLARED (divergent)` |
| swap the source and target guard blocks | **every one of the twenty-eight merge specs passed**, and only `tests/category_family.rs::the_source_guards_run_in_the_order_the_cloud_checks_them` failed. That is a finding, not a pass: no spec made a source guard and a target guard true at the same time. `merge-the-source-is-judged-before-the-target` was written for it, and with that spec present the same break fails differentially — SQLite says `merge_target_is_group`, Postgres says `merge_source_has_children`, both engines refuse, and only the **named** expectation catches it |
| disable the confirm verb's blank-category guard | three specs fail and all three go `MISDECLARED (divergent)`: blank, NULL and whitespace rows are all marked vouched-for, `audit_shape` goes from `NONE` to three `transaction/update` rows, and the split-parent spec's flag flips. One crate test fails with them. The three-shapes-of-blank fixture is what makes this catch a port that only checked `IS NULL` |

**From the ledger-core close — the prune and the checker (2026-08-08, 259 specs):**

| break | result |
| --- | --- |
| neuter one integrity check (`WHERE 1 = 0 AND …` on `dangling_category_ref`) | `integrity-r3-a-transaction-filed-under-a-category-nothing-answers-to` fails three ways: `ok` flips to true, `violations` to 0, and `findings` to `[]`. The spec asserts the whole finding — check, entity, id, severity and the sentence a person is shown — so a check that stops firing cannot be mistaken for a file that got better |
| break C-5 (`WHEN 0 AND OLD.is_transfer_category = 1`) | `prune-a-to-from-category-reached-by-cascade-refuses-the-whole-batch` fails four ways — SQLite **accepts** where Postgres refuses, the parent AND the protected To/From category are both GONE, and the transfer-category count drops to 1 — with `MISDECLARED (divergent)`. Two crate tests fail with it. This is the C-5 interplay reproduced on demand: without the trigger the cascade quietly deletes an account's transfer bookkeeping through a category the caller never named |
| remove the deepest-first ordering (sort by id alone) | `prune-three-generations-named-together-are-counted-as-three` fails: `deleted` is 2, not 3, and parity goes `MISDECLARED (divergent)`. **The two-row spec beside it still passed** — the child's id happens to sort before the parent's, so id order IS deepest-first for that pair, by luck. Recorded because a family that only tested the pair would have been asserting an accident; the three-generation spec is the one that bites |

**From the ingest pair (2026-08-08, 308 specs):**

| break | result |
| --- | --- |
| remove the conflict target: drop `ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING` from the file importer's INSERT | **3 verb specs fail and all three go `MISDECLARED (divergent)`** — SQLite raises `constraint_violated` where Postgres skips the row, the overlapping-chunk spec loses its new row (`rows_in_account` 2 not 3, balance `-29.25` not `-31.75`, `audit_trail` NONE), and 2 of the 18 crate tests fail with them. This is the double-post protection reproduced in the negative: with the clause gone, a re-posted chunk no longer inserts twice — it fails the import outright, which is the *other* half of what the migration bought |
| put back the rule `20260722140000` replaced: `ORDER BY MAX(date) DESC` alone, without `COUNT(*) DESC` | 2 verb specs fail, both `MISDECLARED (divergent)`: `fed_row_n_1` comes back `Fuel` where both engines say `Groceries`. **`cargo test` still passes**, and that is the finding rather than a gap — the crate tests cover the tie the CLOUD has no rule for, which is unaffected by dropping the count. The habit rule has no local-only half, so the differential harness is the only thing that can catch it, and it does |
| disable B-4's first-import branch (`backfill: false && …`) | **6 verb specs fail**, all `MISDECLARED (divergent)`, and every one of them on `stored_balances`: `100.00/112.00` becomes `88.00/100.00`, `100.00/120.00` becomes `80.00/100.00`, and the two-account sync moves both accounts' `balance` instead of both accounts' opening figures. 3 of the 18 crate tests fail with them. Note which specs failed: four of the six are not B-4 specs at all — they are dedupe and provenance specs that happen to assert the balances afterwards, which is what asserting state on every spec buys |

`cargo test` fails alongside every one of these; the counts are in the table.

### Current run

**308 verb specs · 308 pass · 9 declared divergences · 24 single-engine**,
2026-08-08, against a reference cluster rebuilt from the full migration history.
`npm run test:local-sqlite` is 66/66, `npm run test:local-admission` is 109/109
and `cargo test` is **270** (it was 237 before the admission surface).

The count in this section has been behind twice, and the drift is worth one
line rather than a quiet edit: it read **172** while the suite had already grown
to 217 with the restore family, then 259 with the prune and the checker. The
ingest pair adds 49 — 22 for `import_transactions` and 27 for
`import_bank_transactions`, all of them two-engine — so 284 of the 308 actually
COMPARE two engines and 24 (`verify_integrity`, which is not a port of anything)
run on one.

### What became of five failures, 2026-08-08

**172 verb specs · 172 pass · 3 declared divergences** was the state at the time
this was written, against a reference cluster rebuilt from the full migration
history.

It was 167/5 for most of that day. All five were specs of the "a row filed
against an account it does not own" family, and all five failed because
`20260808170000_rows_cannot_name_a_foreign_account.sql` had landed in the
reference cluster and added `transactions_account_id_user_fkey` — a composite
key on `(account_id, user_id)` — which forbids the exact pairing those fixtures
were built on. A schema change arriving, not a regression in the verbs. Each was
resolved on its own merits:

| spec | what happened to it |
| --- | --- |
| `b1-a-delete-that-cannot-reach-its-account-…` | **retired.** Its subject — the `changes() != 1` assert after a balance write — was reachable only through the now-impossible pairing. Successor: `specs/r12-a-row-cannot-be-filed-against-a-strangers-account`, with the lineage in its header. The assert itself stays in the verb, unweakened and second. |
| `split-a-parent-whose-account-is-not-yours-…` | **retired.** Refusal 21 of 21, same story. Successor: `specs/r12-a-row-cannot-be-moved-onto-a-strangers-account`, which takes the UPDATE direction because a split writer edits a row that already exists. |
| `counterpart-a-row-against-a-foreign-account-skips-the-currency-guard` | **retired, and its reason-for-being is closed structurally.** It pinned a hole: `create_transfer_counterpart`'s `IF FOUND` skips the currency check when the source row's account is not this user's. Nobody rewrote the guard — the guard's PREMISE is now enforced, so a lookup scoped by `(id, user_id)` cannot fail to find the account of a row that exists. Successor: `specs/r12-a-transfer-cannot-point-at-a-strangers-account`. |
| `b2-an-account-owned-by-somebody-else-is-refused-by-name` | **kept, expectations updated.** Both engines now refuse at the key, and the filename is deliberately unchanged so the migration's own re-check list stays resolvable. What keeps it apart from its sibling is now `accountExists` — the account it names is REAL, so only the ownership half of the key can refuse it. |
| `b2-an-account-that-does-not-exist-is-stopped-by-the-foreign-key` | **kept, constraint name updated** to `transactions_account_id_user_fkey`. The rename is the pin working. The migration explicitly refused to restore the old name to keep this green (`:231-234`), because a composite key wearing the old name would leave the spec passing while it silently stopped distinguishing its two cases. |

Three verb specs replaced them, and they are not padding — each drives a path
the migration closed that was reachable **through an RPC** rather than only
through a raw insert:
`create-transaction-a-far-side-that-is-not-yours-is-refused`,
`update-transaction-a-far-side-that-is-not-yours-is-refused` and
`update-transaction-moving-a-row-onto-a-foreign-account-is-refused`. Both RPCs
pass `transfer_account_id` straight out of the caller's payload with no
ownership check anywhere in the function
(`20260808150000:196`, `20260808100000:325-327`), which is why the migration
calls that column the weakest of the seven.

**One correction to the migration's own header, found by measuring.**
`20260808170000:225-227` says the RPCs' named refusals "still guard update,
delete and split, where the row's account can change without the foreign key
having anything new to check". On update the key HAS something to check — the
statement that writes `account_id` is a write of the key's own columns — and it
checks it first (`probe-fk-verbs.sql`, P3 and P5). So on create, update and
delete alike the named refusals are now second, and on the paths whose only
route to them was the my-row-your-account pairing they are unreachable. That is
not a reason to remove them; it is a reason to stop describing them as first.

## The verb parity table

Measured 2026-08-08. `wealth-core` 0.1.0 / rusqlite (SQLite 3.46.0) against
PostgreSQL 17.10 with the full migration history applied — **including**
`20260808150000_create_honours_is_cleared.sql`, which `scripts/local-db/up.sh`
picks up on its next run because that script replays the whole history from the
baseline rather than tracking what it applied last time.

**67 specs · 67 pass · 3 declared divergences.**

### create (16 specs)

| Invariant | Spec | Postgres (live RPC) | SQLite (Rust verb) | Parity |
| --- | --- | --- | --- | --- |
| B-2 | expense moves the balance by its own amount | ok, `-12.34`, B-1 holds | identical | match |
| B-2 | income moves it the other way | ok, `1200.50` | identical | match |
| T-6 | a transfer-typed row moves only its own account | ok; no counterpart, no link, no To/From category | identical | match |
| B-2 | a zero-amount row is accepted and moves nothing | ok, balance unchanged, 1 audit row | identical | match |
| B-2 | an account owned by somebody else | refused `account_not_found_or_not_owned` | refused, same name | match |
| R-1 | an account that does not exist at all | refused `transactions_account_id_fkey` | refused `FOREIGN KEY constraint failed` | match |
| U-1 | one audit row, same transaction, describing storage | ok; `after.amount = -42.00` | identical | match |
| TS-I4 | the statement ordinal round-trips | ok, `statement_sequence = 2` | identical | match |
| TS-I4 | an empty-string ordinal is NULL | ok, NULL | identical | match |
| TS-M3 | a guessed category arrives unconfirmed | ok, `category_confirmed = false` | identical | match |
| TS-M3 | a caller that says nothing gets a vouched row | ok, `true` | identical | match |
| I-9 | `is_cleared` sent to the create verb | ok, `true` **(was `f` — see the findings)** | ok, `true` | match |
| B-2 | an empty id means "generate one" | ok, audit names the generated id | identical | match |
| TS-I3 | 29 February 2023 | refused `date/time field value out of range` | refused `date_invalid` | match |
| R-4 | tags round-trip | ok, membership preserved | identical | match *(order is not — see below)* |
| MONEY-1 | three decimal places | **ok, silently stored `-12.35`** | refused `amount_not_representable` | **divergent** |

### update (16 specs) — the sentinel table, executed

| Invariant | Spec | Postgres (live RPC) | SQLite (Rust verb) | Parity |
| --- | --- | --- | --- | --- |
| TS-T3 | a field nobody sent is left alone (all fifteen) | ok, fourteen fields unchanged | identical | match |
| TS-T3 | `transfer_account_id: ''` and `category_id: ''` | ok, **both NULL** | identical | match |
| TS-T3 | `account_id: ''` | ok, **keeps the old account** | identical | match |
| TS-T3 | `category`/`notes`/`merchant_name` `: ''` | ok, stored as the empty string | identical | match |
| TS-T3 | a JSON null: clears where present-key clears, ignored where COALESCE guards | ok | identical | match |
| MONEY-1 | `amount: ''` | refused `invalid input syntax for type numeric` | refused `amount_malformed` | match |
| TS-T3 | `is_cleared: ''` | refused `invalid input syntax for type boolean` | refused `boolean_invalid` | match |
| R-4 | `tags: ["one","three"]` replaces the set | ok | identical | match |
| R-4 | `tags: ''` is ignored, not refused | ok, tags survive | identical | match |
| TS-M3 | changing the category confirms it | ok, `category_confirmed = true` | identical | match |
| TS-M3 | re-sending the same category confirms nothing | ok, stays `false` | identical | match |
| B-2 | changing an amount moves the balance by the difference | ok, `-40.00`, B-1 holds | identical | match |
| B-2 | moving between accounts reverses one and applies the other | ok, `0.00` / `-40.00` | identical | match |
| U-1 | one audit row carrying both sides | ok, `before.amount = -25.00`, `after = -30.00` | identical | match |
| X-6 | somebody else's row | refused `transaction_not_found` | refused, same name | match |
| D-7 | a key outside the fifteen (`archived`) | **ok — the key is discarded in silence** | refused `unknown_field` | **divergent** |

### delete (6 specs)

| Invariant | Spec | Postgres (live RPC) | SQLite (Rust verb) | Parity |
| --- | --- | --- | --- | --- |
| B-2 | the amount goes back to the account, and one audit row records it | ok, `0.00`, `before.amount = -25.00`, no `after` | identical | match |
| T-8 | half a linked transfer | ok, survivor unlinked and untouched | identical | match |
| R-5 | a transaction a split line links to | ok, line survives, link CLEARED | identical **(the leg guard)** | match |
| R-5 | a split parent whose own line is a leg | ok, lines cascade, counterpart stranded | identical **(the leg guard)** | match |
| X-6 | somebody else's row | refused `transaction_not_found` | refused, same name | match |
| B-1 | a delete whose balance write reaches no account | refused `account_not_found_or_not_owned` | refused, same name **(via `changes()`)** | match |

### set_transaction_splits_with_legs (29 specs)

Twenty of them are the refusal matrix — one spec per named refusal, each proving
the **same name** on both engines. The other nine are the writes.

| Invariant | Spec | Postgres (live RPC) | SQLite (Rust verb) | Parity |
| --- | --- | --- | --- | --- |
| S-1 | a replacing set files the parent at its lines | ok, `-25.00`, `category = ''`, sort 1..n | identical | match |
| TS-M3 | lines are signed one by one, not by the parent | ok, `-30.00` and `+5.00` in one split | identical | match |
| T-10 | a line that becomes a leg gets its other side made | ok; `+15.00` in Rainy day, To/From Everyday, mutual link, balance moved | identical | match |
| T-3 | a re-save mints nothing and moves nothing | ok, one row in Rainy day, one audit entry | identical | match |
| T-10 | re-pointing an unmatched leg mints at the NEW target | ok; Holiday fund `+15.00`, Rainy day untouched | identical | match |
| B-2 | a total that changes moves the account by the difference | ok, `-40.00`, `account/update` audited | identical | match |
| S-11 | `p_splits` is not an array | refused `p_splits must be a jsonb array` | refused, same message | match |
| S-2 | fewer than two lines | refused `a split needs at least 2 lines` | refused, same message | match |
| X-6 | somebody else's split | refused `transaction_not_found` | refused, same name | match |
| S-6 | a transfer cannot be split | refused `transfers cannot be split` | refused, same message | match |
| S-11 | two lines claiming one stored line | refused `split_line_id_repeated` | refused, same name | match |
| S-10 | a linked leg dropped from the set | refused, naming **"Rainy day"** | refused, same sentence | match |
| S-3 | a line with no category | refused `every split line needs a category` | refused, same message | match |
| S-3 | a line with a zero amount | refused `every split line needs a non-zero amount` | refused, same message | match |
| X-6 | a leg into somebody else's account | refused `account_not_found_or_not_owned` | refused, same name | match |
| T-2 | a leg pointing back at its own account | refused `a transfer needs two different accounts` | refused, same message | match |
| S-7 | a category nobody has | refused `unknown category: …` | refused, same message **(D-4: the TS mirror does not)** | match |
| S-8 | a To/From line that does not say which account | refused `split_leg_not_declared` | refused, same name | match |
| S-8 | a To/From line naming a different account | refused `split_leg_category_mismatch` | refused, same name | match |
| S-11 | a line id from outside this split | refused `split_line_not_found` | refused, same name | match |
| S-9 | a linked leg's amount | refused `split_leg_amount_locked`, naming `-15.00` | refused, same sentence | match |
| S-9 | a linked leg's target | refused `split_leg_target_locked` | refused, same name | match |
| S-9 | a linked leg's category | refused `split_leg_category_locked` | refused, same name | match |
| T-9 | a leg into a USD account | refused, naming `(GBP and USD)` | refused, same message | match |
| S-1 | lines that do not sum to what the client sent | refused `split_total_mismatch`, both figures named | refused, same sentence | match |
| B-1 | a parent whose own account is not the caller's | refused `account_not_found_or_not_owned` | refused, same name **(via `changes()`)** | match |
| S-7 | ORDER: unknown category beats unknown line | refused `unknown category` | refused, same | match |
| S-8 | ORDER: a pinned leg without its target names the filing | refused `split_leg_not_declared` | refused, same | match |
| D-7 | a sixth key on a split line (`memmo`) | **ok — the key is discarded in silence** | refused `unknown_field` | **divergent** |

`split_write_inconsistent` is the twenty-first `RAISE` site and has **no spec**:
no payload can reach it (a repeated id is caught six refusals earlier, and SQLite
has one writer), so there is nothing to send. It is ported anyway, and the
mutation table above is where it earned its keep.

## Findings this harness produced

- **A refusal order nobody would have chosen, and the port keeps it.**
  `import_transactions_atomic` runs its four provenance checks BEFORE it reads
  the account, so a request aimed at an account the caller does not own is told
  that its own keys are malformed first. MEASURED with both faults true at once
  (`probe-ingest1.sh` §3). It leaks nothing — every one of those checks reads the
  payload alone — but a port that tidied the order would answer *"not your
  account"* to a client bug, and the client would retry for ever against the
  right account. `import-a-repeated-key-is-named-before-the-account-is-looked-at`
  is the spec, and it needs both faults in one payload to say anything at all.
- **Payee memory has a tie-break that does not exist.**
  `payee_memory_category` orders on `COUNT(*) DESC, MAX(date) DESC,
  MAX(created_at) DESC`, and two rows written by one import share all three.
  MEASURED (`probe-ingest4.sh`, repeated three times): for `{Aaa, Zzz}` the answer
  is `Zzz` whichever was inserted first, and for `{Groceries, Fuel}` it is
  whichever was inserted *second*. Those two observations contradict each other,
  so it is not a rule — it is the plan's grouping order surfacing. The port
  therefore states a fourth key of its own (`category ASC`), documents it as a
  **strengthening where the cloud has no rule**, and deliberately writes NO
  differential spec for a total tie: a spec that constructed one would be
  asserting the artefact. The three ties the cloud *does* specify each have a
  spec; the fourth is a crate test.
- **The bank importer's ownership check has a hole, and it is measured rather
  than closed.** The account is verified in the SECOND loop, which visits only
  accounts that received a row — so a sync whose rows are ALL skipped by the
  dedupe never checks the account at all, and answers `{inserted 0, skipped 1}`
  for an account belonging to somebody else. MEASURED on both engines.
  `feed-an-account-whose-rows-were-all-skipped-is-never-checked` reproduces it on
  purpose, because a local port that closed it would stop being a port; in the
  cloud the exposure is bounded by the function being service-role only with
  exactly one caller.
- **B-4's rebase is arithmetically right and starts from a figure that is not.**
  The first feed import moves `initial_balance` by the batch's sum, and B-1
  survives it exactly — which is what makes the shortfall invisible.
  `api/banking/sync-accounts.ts:255-273` seeds a feed-created account with
  `initial_balance` set to TODAY's snapshot, so what the rebase leaves behind is
  "the balance ninety days ago" rather than an opening balance, and every
  transaction older than the provider's window is missing from both sides of the
  identity. That is TS-F7. It is recorded in the verb rather than fixed, because
  the fix is to the cloud's account seeding and a local edition that quietly
  disagreed would no longer be a port.

- **`create_transaction_atomic` silently stopped honouring `is_cleared` — found,
  and now repaired.** `20260707120000:117` added it; `20260808090000:96-98` says
  it is *"identical to the definition in 20260610150000 except for the
  statement_sequence column"* — but 20260610150000 was no longer the live
  definition, and the rebase dropped `is_cleared` with no error, because the
  column defaults to `FALSE`. Confirmed on the reference cluster:
  `"is_cleared": true` in, `f` out. Latent rather than live (the file-import path
  uses `import_transactions_atomic`, which still carries it).
  `20260808150000_create_honours_is_cleared.sql` restores the passthrough with
  fingerprint guards that refuse a wrong-base rebase, and the spec that pinned
  the bug now pins the fix.
- **`apply_category_to_uncategorized` silently stopped skipping split parents —
  found the same way, three days later, and now repaired.** The SAME sentence in
  a different function: `20260808100000:378-379` says it is *"identical to
  20260708100000 … except that the rows it fills are marked CONFIRMED"*, which
  is true and is the defect — `20260708100000` had not been live for nearly a
  month, `20260713100000` had, and its `AND NOT is_split` went with the
  bathwater. `20260713100000:269-273` had predicted the failure exactly: *"the
  trigger above would reject the write mid-loop and fail the whole
  propagation."*

  MEASURED on the reference cluster, both ways
  (`scratchpad/probe-apply-category.sql`):

  | call | before | after |
  | --- | --- | --- |
  | `[blank, A SPLIT PARENT, blank]` | ERROR `split_category_locked`, **neither** blank row filed, audit log EMPTY | **2** filed, 2 audit rows, parent untouched |
  | `[a split parent]` alone | the same error | `0`, no error |
  | `[blank, blank]` (control) | 2 filed | 2 filed |

  Not one row skipped — a bulk action that did nothing and showed the user a raw
  internal code. Latent on the happy path: every client caller already filters
  split parents out (`payeeGroups.ts:96`, `AppContextSupabase.tsx:836`, and the
  drill's split-EXPANDED bucket). What was gone is the defence in depth for the
  case the ORIGINAL function's own header names — *"the client computes its
  target list from a snapshot that can be stale (backgrounded tab, second
  device)"*. `20260808180000_apply_category_skips_split_parents.sql` restores it
  with the same fingerprint guards, and
  `apply-a-split-parent-costs-the-whole-call` — name kept for the lineage — now
  asserts the repair on both engines.

  **Two of these in three days, in two functions, is the finding.** Both were a
  full `CREATE OR REPLACE` rebased onto a superseded definition; neither failed
  when applied, because dropping a line from a function body is not an error;
  and neither was caught by a test, because there was no test for behaviour that
  had quietly stopped happening. Both were found by porting the function to
  another engine and having to trace which definition was live rather than
  reading the newest file. That is what this harness is for, and it is the
  argument for the fingerprint-guard pattern being the default rather than a
  precaution.
- **The `''` sentinel is not a protocol — it is four behaviours across fifteen
  fields, and one of them is the opposite of the documented one.** AUDIT3 §1 read
  this off the SQL and asked for it to be executed; the update specs execute it.
  `account_id: ''` **keeps** the old account (`COALESCE(NULLIF(...), account_id)`),
  where the documented contract says present-and-empty clears. A port that
  implemented the contract uniformly would try to null a `NOT NULL` column.
  Executing the table also corrected it in three places: `type: ''` raises
  (`transactions_type_check`) rather than storing an empty string, `metadata` was
  missing from it entirely, and `category_confirmed` — listed as not settable —
  became settable at `20260808100000`, so the allow-list is fifteen, not fourteen.
- **The update RPC's allow-list is enforced by silence (D-7).** Fifteen columns
  are set and every other key is discarded without a word — measured for
  `archived`, `is_split`, `linked_transfer_id`, `statement_sequence`, `user_id`
  and a plain typo. That silence caused the 2026-07 reconciliation incident
  (`20260707120000:5-11`) and hid the `is_cleared` regression above. The local
  edition refuses instead; the divergence is declared and pinned from both sides,
  which is what turns AUDIT3's proposed D-7 from a note into a test.
- **The R-5 leg guard is needed in two directions, not one.**
  PHASE1-PLAN's addendum §A says the delete verb must hold `_rpc_guard('leg')`
  *"iff a split line links to it"*. Measured: that covers deleting the transfer a
  line points AT, and not deleting the split PARENT whose own line is a leg,
  where the cascade fires `trg_protect_linked_leg_delete` instead. Postgres
  accepts both, so a guard covering one direction leaves "delete a split
  transaction that has a transfer line" refused locally and working in the cloud.
  Both directions are guarded and both have specs.
- **Postgres rounds sub-penny amounts away in silence.** `numeric(20,2)` turns
  `-12.345` into `-12.35` and moves the balance by the rounded figure. The local
  edition refuses (DESIGN.md §3.1's stated principle). Declared divergence.
- **`tags` changes shape from a sequence to a set.** `text[]` is ordered and can
  hold duplicates; `transaction_tags (transaction_id, tag) PRIMARY KEY` can do
  neither. Neither DESIGN.md nor PHASE1-PLAN mentions the conversion, and a
  restore has to decide what to do with a row that has duplicate tags.
- **The split writer's refusal ORDER is not what reading its sections
  suggests, in two places.** `split_line_not_found` sits *below* `unknown
  category`, `split_leg_not_declared` and `split_leg_category_mismatch`: every
  check that can be made from the payload alone runs before any stored line is
  read. And `split_leg_not_declared` beats all three pinned-leg locks, which has
  a consequence nobody had written down — **`split_leg_target_locked` is
  unreachable for a leg filed under a To/From category**. Every payload that
  would trigger it trips S-8 first. The only population that can reach it is a
  leg filed under an *ordinary* category, which is exactly the MS Money import
  the migration was written for. Both orderings were measured pair by pair, both
  have specs, and both were re-broken to prove the specs catch them.
- **The guard the split writer needs is `split`, not `leg`.**
  `verbs/mod.rs` records the R-5 leg obligation and the natural assumption is
  that the split writer needs it most. Measured: it needs none of it. Every write
  this verb makes to a *linked* line changes only `memo`, `sort_order` and
  `updated_at` — precisely the columns `trg_protect_linked_leg` does not watch —
  and the leg-removal refusal fires before the DELETE, so
  `trg_protect_linked_leg_delete` has nothing to fire on. Holding a leg guard
  here would have stood S-9 and S-10 down for the duration of the largest write
  in the schema, which is the one moment they are worth having.
- **PHASE1-PLAN §6.1 sizes this function at "362 lines / 14 refusals". It has
  twenty-one `RAISE` sites carrying nineteen distinct names**, twenty of them
  reachable from a payload. The undercount matters because the estimate for the
  remaining ledger verbs was built on it.
- **Every boolean in these RPCs arrives at a Postgres text cast**, so the cloud
  accepts `"is_cleared": "t"`, `"yes"`, `"off"` and `"0"` as well as JSON
  booleans, and refuses `""` and the ambiguous `"o"`. The first port typed them
  as `Option<bool>`, which would have refused inputs the cloud accepts. The
  accepted set is now enumerated in `wire::Flag`, measured one `psql` cast per
  value, and it is also what makes `is_cleared: ''` refuse **by name** instead of
  as a deserialiser error.
- **`delete_unused_categories` promises something it does not deliver, on BOTH
  engines.** `20260708160000`'s header says the RPC re-checks everything
  server-side so *"a stale client can never destroy referenced data"*. Measured
  (`scratchpad/local-core/probe-prune1.sh` `p-cascade-eats-a-referenced-child`,
  `probe-prune2.sh` `p2-grandchild-referenced-parents-named`): name a parent and
  a child together, with the CHILD referenced by a transaction, and the child's
  own check skips it — while the parent's "child outside the batch" check passes
  *because the child is in the batch*. The parent is deleted and
  `parent_id ON DELETE CASCADE` takes the referenced child with it, leaving the
  transaction filed under an id nothing answers to. The same route eats a
  budget's `category_id` (nulled by the key) and a budget's `category` text
  (left dangling). It is REPRODUCED in the local port rather than fixed — a port
  that tidied it would refuse a prune the cloud performs — and the local edition
  reports the wreckage instead, through `verify_integrity`'s
  `dangling_category_ref`.
- **The same function has a second, smaller hole one clause wide.** Its
  transaction check reads `t.category = c.id::text` and nothing else, while its
  budget check two clauses later reads `b.category` **and** `b.category_id`. So a
  transaction filed only through the uuid column does not save its category:
  measured, the category is deleted and the column is nulled by the foreign key,
  leaving nothing behind — the one case in this family where even
  `verify_integrity` has nothing to report, because a NULL is not a dangler.
- **A function with no `RAISE` in it can still refuse, and this one does.**
  Twenty measured cases produced no exception from `delete_unused_categories`
  itself; every protection in it is a `WHERE` clause. But name a prunable
  category together with a To/From category sitting under it and the cascade
  walks the protected row into C-5's `BEFORE DELETE` trigger:
  `transfer_category_protected`, whole batch lost, on both engines. Worth
  recording because "this RPC never refuses" is exactly the kind of summary that
  gets written into a client's error handling.
- **The cloud's single-statement `DELETE` cannot be a single statement locally
  without changing the number it returns.** Postgres decides which rows to delete
  from one snapshot and counts each; SQLite scans, deletes the parent, the
  cascade removes the child, and by the time the scan reaches the child there is
  nothing left to count. Measured: parent + child answers **2** in the cloud and
  **1** in SQLite, and three generations answers **3** against **1** — with the
  same six categories left in the file either way. A disagreement about the
  answer, not about the ledger, and the answer is what the import summary shows.
  The port qualifies the rows first and deletes them deepest-first, which makes
  all twenty cases match.
- **`verify_integrity` has no cloud counterpart at all**, and `schema.sql` said
  it did. The section header claimed *"each of these has a Postgres twin …  so
  the differential harness can compare violation NAMES across engines"*. Traced
  three ways — `grep -rn verify_integrity` over `supabase/`, `api/` and `src/`;
  no `CREATE VIEW` anywhere in `supabase/migrations/`; the only relatives are two
  throwaway verification SELECTs inside migrations, both of B-1 alone — and
  corrected in place. The consequence is structural rather than cosmetic: the
  checker is the local edition's only defence against a rule silently ceasing to
  hold, its specs are the first in this harness that cannot be differential, and
  `parity: 'not-comparable'` exists in the verb harness because of it.
- **Fifteen checks caught none of the two commonest ingest disasters.** Planted a
  card statement with inverted signs and an `<AVAILBAL>` stored where a
  `<LEDGERBAL>` belongs (`probe-integrity1.mjs`, cases 16 and 17): the view
  reported **nothing** for either, because both produce data that is internally
  consistent and entirely wrong. PHASE1-PLAN §2.5's two addendum checks are now
  in the view as `warning`s, with `v_integrity_ok` counting only violations so a
  heuristic can never condemn a file.
- **One integrity check cannot be reached backwards.** The obvious way to plant
  `account_missing_transfer_category` is to delete a To/From category — and C-5
  refuses, so deleting the Transfer anchor to force it aborts the whole statement
  with `transfer_category_protected`. It is reachable only forwards, by creating
  an account whose owner has no Transfer anchor for C-3's trigger to hang a
  category from. Which means the fixture every ownership spec in this harness has
  used since the transfer family — a second login with one account — has been
  carrying an integrity violation all along, and nothing until now could report
  it.

---

# The ADMISSION harness (`admission.mjs`) — a third lane, and the one with no SQL in it

```bash
~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli   # once
npm run test:local-admission
npm run test:local-admission -- --filter=cleared    # one family
npm run test:local-admission -- --list              # what is in here
```

No Postgres cluster. No SQLite file either. That is not a shortcut — it is the
subject.

## The different question, again

| lane | question | oracle |
| --- | --- | --- |
| `run.mjs` | does this SCHEMA refuse this write? | the cloud's Postgres schema |
| `verbs.mjs` | do two implementations of one OPERATION agree, on the answer AND on the rows left behind? | the live Postgres RPC |
| `admission.mjs` | do two implementations of one DECISION agree? | **the TypeScript module that ships today** |

The twenty-one verbs are ports of Postgres functions, so Postgres can be asked.
These rules have no Postgres side at all: they decide what a parsed row MEANS
*before* any write verb sees it. PHASE1-PLAN §5 counts **48 invariants of that
class — 35 % of the whole inventory** — and TS-INVARIANTS §7 names the four the
audit was most sure about: *"`findStatementDuplicates`, `planStatementBankBalance`,
`feedOverlap`, `deleteRefusalFor` are admission control, not parsing."* Three of
those four are in this lane. (The fourth is not; see "Deliberately not done".)

There are no rows to compare afterwards, because nothing is written. What is
compared is the ANSWER, field by field, to the bottom of every nested structure.

## The oracle is executed, not transcribed

PHASE1-PLAN §5.2 sets out a method for these 48: *"Extract each Vitest case's
fixture and expectation into the same scenario format… run the Rust
implementation against those cases."* That is transliteration, and its weakness
is that a transliterated expectation is a **copy of the oracle taken on one
day**. The module can change underneath it and the copy will not notice — it
will keep passing, describing behaviour that no longer exists.

So this lane runs the module. `lib/ts-oracle.mjs` imports `src/` directly;
esbuild bundles it once per run into one ESM file; Node imports that natively;
each spec's payload goes through the real function and through
`wealth-core-cli`, and the two answers are compared.

The coupling is deliberate and worth stating plainly: **a change in `src/` can
change this lane's answers, and that is the point.** If somebody edits
`statementDuplicates.ts` tomorrow, this lane fails tomorrow.

### Why esbuild and not tsx

Both are in `node_modules` and both arrive through `vite`, a direct
devDependency; neither is a new dependency, and this harness must not add one
(`lib/sqlite.mjs` states the rule). esbuild wins on the thing that matters:
it produces a plain file that `import()` loads with **no loader hook in the
process**, so the oracle's module graph and the runner's cannot interact.
Measured cost: **15–20 ms**, once per run, and the runner prints the figure it
actually got in its engines block rather than this one.

No type checking, deliberately. `tsc -b` covers `src`, `vite.config.ts` and
`api`, and nothing under `scripts/`; esbuild ERASES types rather than checking
them. That is the right division — the shipped module is typechecked by the
repo's own gate, and a second, weaker check here could only disagree with it.

### In-process on one side, a process per spec on the other

The verb harness went out of its way to spawn on both sides so that neither
engine got a structural advantage. That argument does not apply here, and the
reason is worth writing down: there is no database, no connection and no
transaction on either side, so there is no state a spec could leave behind for
the next one. Every function in the oracle is pure.

The one exception is real, and it is why the arrangement is sound rather than
merely convenient: `src/utils/decimal.ts` calls `Decimal.config()` at import
time — precision 20, ROUND_HALF_UP, globally. That is module state, it is shared
by every spec, and it is exactly the state the money comparison depends on. So
sharing it is the point.

## What an adapter may do, and what it may not

The two sides of this comparison do not take the same KINDS of value. The
TypeScript takes JavaScript numbers and `Date`s because it runs after a parser
has converted them; the Rust takes decimal strings because `Money` is an integer
type at the boundary. So `lib/ts-oracle.mjs` adapts, and the rule is:

* it may **rename** (`fit_id` → `fitId`), **re-render** (a money string into the
  number the module's own callers hand it; a `Date` back into a calendar day; a
  `Set` into an array) and **build a fixture** (see the cleared family below);
* it may **not decide anything**. No branch in it may depend on something the
  TypeScript function has not already answered. Where the port carries a field
  the TypeScript has no counterpart for, the spec declares it `rustOnly` **with a
  reason** — it is never computed in the adapter.

One place that rule is load-bearing: `money()` in the adapter **refuses** to
render a value that is not exact to the penny. Rounding it quietly is precisely
how an adapter would hide the divergence this lane exists to measure, so it
raises a HARNESS ERROR and the spec has to declare what it found.

And one guarantee that had to be made rather than assumed: the runner
round-trips every payload through `JSON.parse(JSON.stringify(...))` before
dispatch. The Rust side receives a string because it is a separate process;
handing the TypeScript side the spec's live object would let the two see
different things, because a `Date`, an `undefined`, a `NaN` and a bigint all
survive in memory and none of them survive JSON.

## "A planner cannot write" is a property of the binary, not a habit

Not one function in `crates/wealth-core/src/admission/` takes a
`rusqlite::Connection`, and the only occurrences of the word under that
directory are in the module documentation that makes this claim:

```bash
grep -rn rusqlite crates/wealth-core/src/admission/ | grep -v '//!'    # no output
```

The bridge goes further and **refuses to be handed a database**. A `plan_*`
command sent with `--db` exits non-zero:

```
wealth-core-cli: a plan_* command decides what a row means and writes nothing,
so it is never handed a database; drop --db
```

`admission.mjs` asserts that on **every run**, before any spec, and prints it in
the engines block. A bridge that started accepting the argument would fail the
run rather than quietly removing the guarantee. It is the sibling of the
FK-pragma assertion `lib/sqlite.mjs` makes before every constraint spec.

## The lane has no single-engine specs, and cannot

`lib/admission-specs.mjs` **refuses** `parity: 'not-comparable'` outright, with
the reason in the error message. In the verb harness it is legitimate: the cloud
genuinely has no `verify_integrity`, so a spec for it can only run one engine.
Here the TypeScript module IS the thing being ported — it is present by
definition — and a spec that could not run it would be a spec for a rule that is
not a port of anything.

## What is in it

**109 specs · 109 pass · 4 declared divergences**, 2026-08-08.

| family | specs | rule | ported from |
| --- | --- | --- | --- |
| `dedupe-*` | 21 | TS-I6, TS-I7 | `src/utils/statementDuplicates.ts` |
| `bankbal-*` | 18 | TS-B1, TS-B2, TS-B3, TS-I2 | `src/utils/statementBankBalance.ts` |
| `overlap-*` | 25 | TS-I12, TS-I13 | `src/services/import/msMoney/feedOverlap.ts` |
| `cleared-*` | 13 | TS-I9 | four sites, four importers |
| `identifiers-*` | 19 | TS-A1, TS-A2, TS-A3 | `src/utils/ofxAccountIdentifiers.ts` |
| `match-*` | 7 | TS-A3 | `findAccountByOfxIdentifiers` in the same file |
| `category-*` | 6 | TS-I8 | `src/utils/transferMatch.ts:85-94` |

### The four declared divergences, and why three of them are one divergence

| spec | TypeScript | Rust |
| --- | --- | --- |
| `dedupe-a-sub-penny-amount-…` | rounds `-12.345` to `-1235` minor and deduplicates | refuses `amount_not_representable` |
| `bankbal-a-sub-penny-closing-balance-…` | rounds `900.005` to `900.01` and writes it | refuses `amount_not_representable` |
| `overlap-a-float-drifted-amount-…` | absorbs `0.30000000000000004` into 30p | refuses `amount_not_representable` |
| `dedupe-a-date-only-the-browser-can-read-…` | reads `2027-2-7` through V8's fallback parser and pairs the row | cannot read it, and pairs nothing |

The first three are the **same divergence at three sites**, and it is the one
`crates/wealth-core/src/money.rs` already declares against Postgres's silent
`numeric(20,2)` rounding and against `parseMoneyInput`. Each is pinned from
*both* sides, so the day the TypeScript stops rounding, the spec fails and the
divergence retires deliberately instead of quietly.

The fourth is a date question. `Date.parse("2027-2-7")` succeeds in node and is
**implementation-defined**: ECMA-262 lets an engine accept whatever it likes once
the standard format does not match, and V8's fallback also reads `"Feb 7 2027"`
and `"2/7/2027"`, whose meaning depends on the reader's nationality. Porting it
would mean porting V8. The direction of the consequence is why the port is
allowed to be stricter: a date it cannot read drops the row out of MATCHING, so
the row imports and is visible in the register. It fails towards "an extra row
the user can see", never towards "a payment that vanished".

### What the port DOES read, exactly, including the part nobody expects

`admission::day` is not `wire::is_calendar_date`, and the difference is
deliberate. `wire::is_calendar_date` answers Postgres's question — *is this a
real day?* — and refuses 31 February, because a ledger that files a transaction
on a day that does not exist is broken. These modules ask a different question:
*what does `Date.parse` do with this text?* MEASURED (node 22.17.0):

| text | `Date.parse` | `admission::day` |
| --- | --- | --- |
| `2027-02-30` | **2027-03-02** — the day ROLLS OVER | identical |
| `2027-04-31` | **2027-05-01** | identical |
| `1900-02-29` | **1900-03-01** (1900 is not a leap year) | identical |
| `2027-02-00` | NaN | unreadable |
| `2027-13-01` | NaN | unreadable |
| `2027-12-32` | NaN | unreadable |
| `2027-2-7` | 2027-02-07 (V8 fallback) | unreadable — **declared divergence** |

The syntax bounds the month at 12 and the day at 31, and `MakeDay` carries the
excess into the next month. `dedupe-a-day-past-the-end-of-its-month-rolls-over-on-both-sides`
pins it, in the rendered output as well as in the gap.

### TS-I9 — the family where the VALUE cannot tell a right port from a wrong one

PHASE1-PLAN §4.2 found the trap and stated it exactly: *"five sources, four
policies, but only **three distinct values**. Feed, OFX and CSV all produce
`false`. So a test that asserts *the value* cannot tell a correct four-policy
port from a wrong one-policy port — it passes either way for three of the five
sources."*

Two things answer that here, and neither is a test:

1. **The policy is data, one arm per source, and the match is exhaustive.**
   Adding a source without deciding its policy is a compile error.
2. **The answer names the policy that produced it.** CSV answers
   `no_cleared_column` and OFX answers `never_pre_cleared`, though both answer
   `false`. A one-policy port has one name to give.

The distinguishing *tests* are still the two the plan names — a QIF row with
`C*` and a Money row with `clearedStatus = 2`, each asserted `true`, and each
asserted `false` when the same logical row arrives as CSV — and they are here,
driven end to end through **all four real importers**. Every one of
`ofxImportService`, `qifImportService`, `enhancedCsvImportService` and
`transformMsMoneyExport` turned out to be drivable with pure inputs — no
database, no network, no browser — so this is a real differential and not a
constant typed into the harness. Where the flag goes per format, and where it
deliberately does not:

| source | the flag lives in | policy |
| --- | --- | --- |
| `qif` | a `C` line carrying it | `file_flag` |
| `ms_money` | `clearedStatus`, Money's own 0/1/2 | `reconciled_status` |
| `ofx` | **nowhere** — OFX has no such tag | `never_pre_cleared` |
| `csv` | **nowhere** — a CSV has no cleared column, which IS the policy | `no_cleared_column` |

`bank_feed` is the fifth source and has **no TypeScript oracle**: its policy is
enforced in SQL, and it already has a differential proof against Postgres in the
verb lane (`feed-a-feed-row-arrives-unreconciled`). It is in the policy table and
asserted by `crates/wealth-core/tests/admission.rs`, not by a spec here.

### One thing measured and deliberately left untested

`findFeedOverlap` sorts its feed rows with `dayOf(a.date) - dayOf(b.date)`, which
is **NaN** when either date is unreadable — and a NaN comparator has no defined
answer. MEASURED (node 22.17.0): one bad date among five leaves the array
**completely unsorted**; a different arrangement of three comes back partially
sorted. Those two observations contradict each other, so it is an artefact of
V8's sort and not a behaviour to port.

So the port sorts unreadable days first, **says that it is a choice**, and this
lane carries no spec with an unreadable feed date — a spec that constructed one
would be asserting the artefact. The property that matters (such a row matches
nothing) is a crate test, with one feed row, where there is no order to disagree
about. This is the same call the ingest port made about `payee_memory_category`'s
fourth tie-break, for the same reason.

## Proof that the specs are not vacuous

Each of these was executed against the full lane, then reverted. Every one names
a rule from a different module.

| break | result |
| --- | --- |
| **the 1:1 greedy claim** — drop `claimed.insert(...)` from the dedupe's second pass | `dedupe-only-as-many-rows-as-the-register-could-account-for` fails: BOTH £20 file rows are flagged against the ONE held row that could account for one of them, and parity goes `MISDECLARED (divergent)`. This is the "two cash withdrawals on one day" case losing real spending, reproduced on demand |
| **the staleness comparison** — `recorded_date > statement` → `>=` | `bankbal-equal-days-write-so-a-re-import-settles-on-the-same-figure` fails four ways (`kind` `set` → `stale`, and all three of `updates`, `amount`, `date_as_of` absent), `MISDECLARED (divergent)`. Re-importing one statement twice would then depend on which copy was opened first |
| **one cleared policy** — `Csv => FileFlag` | **two specs fail, and they fail differently, which is the finding.** `cleared-the-qif-flag-through-csv-changes-nothing` fails on the VALUE (`false` → `true`) and goes `MISDECLARED`. `cleared-a-csv-row-is-never-pre-cleared` fails **only on the policy NAME** — the value is `false` either way, so parity still reads `match` and the label alone would have passed it. That is PHASE1-PLAN §4.2's trap, caught by the field that exists for it. Two crate tests fail with them |
| **the handover refusal** — `if false && (feed.is_split \|\| feed.linked_transfer_id.is_some())` | both `overlap-a-split-feed-row-…` and `overlap-a-feed-row-already-half-of-a-pair-…` fail on five assertions each: the leg is suppressed, a handover is planned for a feed row the database would refuse to re-type, and `kept_despite_overlap.transfers` drops from 1 to 0 — the residual going *invisible* at the same moment it becomes wrong |
| **the date rollover** — bound the day at 28 instead of 31 (i.e. validate the calendar) | `dedupe-a-day-past-the-end-of-its-month-rolls-over-on-both-sides` fails, `MISDECLARED (divergent)`. Note what a "safer" port costs: the row stops matching at all |
| **description becomes a gate** — `if similarity == 0.0 { continue; }` in the dedupe's ranking loop | `dedupe-truncated-and-renamed-descriptions-are-still-the-same-payment` fails — the **Nadia** pair is gone, which is the exact row the whole two-tier rule was written for — and `dedupe-a-fitid-is-read-off-a-whole-line-…` fails with it |
| **the blank-only backfill** — drop `is_blank(account.sort_code)` | `identifiers-an-account-that-already-has-both-is-left-alone` fails (a backfill appears where there should be none) and `identifiers-only-the-blank-half-is-filled-…` fails on the summary as well as the updates |
| **the self-transfer refusal** — `if true \|\| category_id.is_empty()` | `category-the-account-own-to-from-category-is-refused` fails on both fields: `admitted` `false` → `true` and `refusal` `"self_transfer"` → null. Ordinary direct debits filed as transfers to the account they sit in, which is the incident TS-I8 exists for |

## Findings this lane produced

- **The two modules that were written to mirror each other read a date two
  different ways, and only one of them is exposed to V8's fallback parser.**
  `statementDuplicates.ts:52` says it mirrors `findFeedOverlap` deliberately —
  *"same shape, same reasoning, one fewer thing to learn"* — and their date
  readers are not the same function. `feedOverlap.ts:163-166` takes
  `iso.slice(0, 10)` and appends `T00:00:00.000Z`, which FORCES the standard
  format: `"2026-5-10"` becomes `"2026-5-10T00:00:00.000Z"`, which is not a date
  at all. `statementDuplicates.ts` goes through `toDateMs`, which is
  `Date.parse` unguarded. So a statement quoting `2026-5-10` is deduplicated by
  one module and would not be by the other, and nothing anywhere says so. It is
  why the port has one declared date divergence and not two.
- **`Date.parse` is not a validator, and using the ledger's own date check here
  would have been wrong.** `wire::is_calendar_date` exists for
  `transactions.date` and refuses 31 February, because a ledger that files a
  transaction on a day that does not exist is broken. Reaching for it in the
  admission modules would have DROPPED rows out of duplicate matching that the
  TypeScript matches — `2027-02-30` is a date to `Date.parse`, and it is 2 March.
  Measured, ported, and pinned by a spec on the rendered output as well as on
  the gap. Two functions that look interchangeable and answer differently is
  exactly the shape of the mistake this port is most likely to make.
- **All four file importers turned out to be drivable with pure inputs**, which
  is what turned TS-I9 from a pinned constant into a real differential.
  `ofxImportService.importTransactions` and
  `enhancedCsvImportService.importTransactions` are `async` and take arrays of
  accounts and transactions, which reads like a database dependency and is not
  one; `qifImportService` and `transformMsMoneyExport` are plain functions. So
  every one of the four policies is measured against the importer that carries
  it, end to end, rather than against a line somebody transcribed.
- **The parity label alone cannot catch a merged `cleared` policy.** Measured:
  point CSV at the QIF rule and `cleared-a-csv-row-is-never-pre-cleared` fails
  ONLY on the policy name, while parity still reports `match` — because the
  value is `false` either way. That is PHASE1-PLAN §4.2's trap arriving in
  practice, and the reason the result carries a name the TypeScript has no
  counterpart for.
- **`exactPence` does not survive the port, and that is the interesting part.**
  Three modules each carry their own Decimal round-trip whose only job is to turn
  a double back into an exact quantity of pence. `Money` is an `i64`, so all
  three disappear — a defence replaced by a type. What that exposes is the money
  divergence at three NEW sites: the helpers ROUND a sub-penny amount and
  `Money::parse` REFUSES it, and until this lane existed that difference had been
  declared once, against Postgres, in one file.

## Layout

```
admission-specs/*.spec.mjs   one decision per file, ONE payload, declared parity
admission-specs/_shared.mjs  the fixtures more than one spec wants (not a spec)
lib/admission-specs.mjs      loader; refuses "not-comparable", and any shape it does not know
lib/ts-oracle.mjs            the ADAPTER: imports src/ and maps shapes. Decides nothing
lib/admission-typescript.mjs bundles the oracle with esbuild and runs it in-process
lib/admission-rust.mjs       spawns wealth-core-cli with NO --db, and asserts it refuses one
admission.mjs                the runner and the admission parity table
```

## A spec

```js
export default {
  invariant: 'TS-I9',
  title: '…',
  design: '…',                 // where the rule is written down
  consequence: '…',            // what goes wrong if it is lost — money terms
  parity: 'match',             // match | divergent. There is no third value here
  reason: '…',                 // required for a divergence, forbidden for a match

  command: { verb: 'plan_cleared_flag', payload: { … } },   // ONE document, both sides

  expect: { outcome: 'ok' },   // or { typescript: {…}, rust: {…} } for a divergence
  result: { cleared: false },  // asserted on BOTH sides, and cross-compared
  divergentResult: { … },      // two answers, only for parity: 'divergent'
  rustOnly: { policy: '<why the oracle has no counterpart>' },
  rustResult: { policy: 'no_cleared_column' },              // the Rust side alone
};
```

`rustOnly` is the one place a field can leave the cross-comparison, and the
loader makes it expensive: it must state WHY in prose, a key in `result` may not
also be `rustOnly`, and a key in `rustResult` must be. Two fields use it today —
`policy` in the cleared family, and `candidates` in the account-match family —
and both are places the port says MORE than its oracle.

---

# Phase 1 status — what "closed" does and does not mean

**Phase 1 of the local edition is closed.** The ledger core, the ingest write
path and the admission surface all exist, all have executable proofs, and the
proofs run in three lanes in this directory:

| | count | oracle |
| --- | --- | --- |
| constraint specs (`run.mjs`) | 66 | the cloud's Postgres schema |
| verb specs (`verbs.mjs`) | 308 | the live Postgres RPCs |
| admission specs (`admission.mjs`) | 109 | the TypeScript modules that ship today |
| crate tests (`cargo test`) | 270 | — |

**483 specs and 29 declared divergences, every divergence pinned from both
sides.** Of the 483, **459 actually compare two implementations**: the other 24
are `verify_integrity`'s, which run on one engine because the cloud has no such
function, and they are counted separately by their own runner for exactly that
reason.

That is what closed means. Here is what it does not.

### Still open by design

* **The R-5 leg guard has one path left owing it.** `verbs/mod.rs` records five
  paths that must hold `_rpc_guard('leg')` while deleting a transaction a split
  line links to. Four are discharged — the delete verb (both directions), the
  merge, the wipe, and the transfer-unlink repair, which turned out not to
  delete anything. **The duplicate sweep is the fifth and it does not exist
  yet**, so the obligation is recorded and not discharged. When
  `delete_transactions_swept` is built it must hold the guard on
  `delete_transaction::touches_a_transfer_leg`'s condition, and it must not
  re-derive that condition.
* **`plan_import` itself is not built.** PHASE1-PLAN §3.2 describes a verb over
  `Vec<RawRow>` that enforces thirteen canonical invariants at once. What exists
  is its admission *decisions*, each addressable on its own. The verb that
  SEQUENCES them — TS-I10's date-order inference, TS-I5's sign rule, D-3's
  zero-amount policy, TS-I4's statement ordinal — is not written, and the write
  path it would end in (`verbs::import_transactions`) is.
* **`plan_duplicate_sweep` / `delete_transactions_swept` (TS-D1…TS-D4).** The
  sweep DELETES, so its gate is a refusal in a write verb rather than a plan, and
  PHASE1-PLAN §4.3 settles its shape as a `strand_ack` token on
  `delete_transaction`. That is a change to an existing verb's contract and to a
  declared divergence (#126), not an addition beside it, and it is the reason the
  fourth module TS-INVARIANTS §7 names — `deleteRefusalFor` — is not in the
  admission lane.

### Two functions deliberately not ported, and the decisions are written down

* **`migrate_categories_atomic`** (`verbs/mod.rs`): the one-way door between the
  localStorage id space and the cloud's uuids. A local file has no second id
  space, and the two ways a category tree can arrive in one are already covered
  by verbs that exist.
* **`formatStatementDay` and `todayIsoDay`**
  (`admission/statement_bank_balance.rs`): they decide what is SHOWN, which is
  the other side of the dividing line, and both carry a timezone argument that
  belongs in the TypeScript's own tests.

And two half-ports, both recorded in `scripts/port-coverage/manifest.json` as
`pending` **with a note** rather than flipped: `transferMatch.ts` (TS-I8 is
ported, the transfer-sweep ranking is not) and `accountNumberInput.ts` (the
reading rules are ported, the storage boundary belongs with account write verbs
that do not exist yet).

### What none of the three lanes proves

Everything `run.mjs`'s own "What this does NOT prove" section already says —
no isolation, no collation-dependent behaviour, and Postgres is the oracle for
*behaviour* and never for *arithmetic* — plus one more that belongs to the third
lane specifically:

**A live oracle proves agreement, not correctness.** If
`statementDuplicates.ts` is wrong, the port is wrong in the same way and this
lane says `match`. That is the correct outcome for a PORT — a port that quietly
disagreed with the thing it ports would be a different program — but it is not
a proof that the rule is right. The Vitest suites remain the argument that these
rules are the right rules; this lane is the argument that there is now exactly
one of each.
