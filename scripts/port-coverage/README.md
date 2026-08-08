# port-coverage — the gate that replaced the invariant count

```bash
npm run port:coverage                  # the gate
npm run port:coverage -- --pending     # the work queue, in full
npm run port:coverage -- --why=<path>  # why one file was discovered
npm run port:coverage -- --heuristics  # what each heuristic caught, and why it exists
npm run port:coverage -- --json        # machine-readable
```

Exit 1 if discovery and `manifest.json` disagree. Node built-ins only, ~0.1 s.
Nothing here touches `src/`, `api/`, `supabase/` or the database.

---

## What this replaces, and why

Phase 1 tried three times to inventory the money invariants by auditing, and got
**9 → 87 → 137 → ≈206**. Each sweep found the previous one badly short. The third
audit stopped counting and measured why:

- **52 % of money-handling code is cited in no audit document.** By line:
  21 % of `supabase/migrations/`, 71 % of `src/utils/`, 54 % of `src/services/`
  (AUDIT3 §0.1). **31 of 61 migrations were cited nowhere**, including the
  current definitions of `create_transaction_atomic`, `update_transaction_atomic`
  and `import_transactions_atomic` — after audit 1 had claimed to read every
  migration.
- **The unit is elastic.** `merge_categories`' twelve distinct refusals count as
  one invariant (#54); TS-F1…TS-F12 count as twelve. A 12× difference in how a
  comparable body of logic scores, in the same table. "Any number produced this
  way is a function of who wrote the row, not of the system" (AUDIT3 §0.2).
- The count could therefore be raised or lowered by merging or splitting table
  rows, and it was never possible to say whether it was finished.

AUDIT3 §9(b) proposed the swap this directory implements: stop reporting a
count, report **coverage** — every money-handling file is either dispositioned
or it is a visible piece of outstanding work. That is monotone, mechanical, and
"the only mechanism proposed anywhere that would have caught `incomeExpense.ts`,
`duplicateScan.ts`, `calculations-decimal.ts` and
`20260806180000_suggestion_dismissals.sql` without a human deciding to go and
look."

The gate does not replace the audits. It replaces the *claim that an audit
finished*.

---

## How discovery works

`lib/discovery.mjs` sweeps four trees: `supabase/migrations/`, `src/services/`,
`src/utils/`, `api/`. Anything outside them is not looked at.

**The money vocabulary is derived from the migrations, not typed in.** Discovery
parses every `CREATE TABLE` body to find the money tables, then every
`CREATE FUNCTION` body to find the functions that touch one. A schema change
moves the vocabulary automatically. Today: 15 money tables, 40 money functions,
from 62 migrations (`--heuristics` prints them; `--json` lists them by name).

- **money tables** = the nine named in the brief (`transactions`, `accounts`,
  `transaction_splits`, `budgets`, `goals`, `investments`, `categories`,
  `suggestion_dismissals`, `financial_audit_log`) — treated as a floor that
  derivation may extend and never shrink — **plus** any table declaring a
  `numeric`/`decimal` column named for money (`amount`, `balance`, `price`,
  `cost`, `value`, `total`, `target`), **plus** any table with a foreign key one
  hop into either set. That last clause is why `linked_accounts` counts, and so
  a handler that only ever names `linked_accounts` is still money-handling code.

A file is discovered if **any** of these match:

| Heuristic | A file qualifies when | Why it exists |
| --- | --- | --- |
| `migration` | it is a `.sql` under `supabase/migrations/` | It is the money schema. No further test is meaningful. |
| `api-handler` | it is a `.ts` under `api/` | The whole server surface of a financial product is in scope by default. Cheaper to disposition 38 handlers in the manifest than to argue about which ones touch money — and `api/banking/disconnect.ts` (cascade behaviour, AUDIT3 §7.1) is exactly the file a content heuristic misses. |
| `money-table` | it names a derived money table | Direct evidence it reads or writes the ledger. |
| `money-rpc` | it names a derived money function | The RPC names are the command surface; a TS file that names one is calling it. |
| `decimal` | it uses `Decimal` / `decimal.js` / `decimal-converters` | The codebase only reaches for Decimal when the value is money. |
| `amount-or-balance` | it references `amount` or `balance`, any casing | The two columns every money rule is ultimately about. |
| `currency` | it mentions currency | Cross-currency handling is itself a money rule (#33/T-9). |
| `money-domain` | it uses the domain vocabulary: transfer, payee, budget, reconcile, archive, ledger, statement, split, net worth, price, cost, pence, IBAN, sort code, account number | Catches the rule-holders whose money is implicit — `storageAdapter.ts` (FINANCIAL_KEYS never expire) matches on nothing else. |
| `imported-by-money-file` | it is imported directly by a file another heuristic matched | One hop only. `userIdService.ts` holds the Clerk-id-never-reaches-a-`user_id`-column rule and mentions no money at all. Depth is capped at one because deeper closure degenerates into "the whole app" and stops being a signal. |

**Exclusions**, applied before any heuristic runs, each one deliberate:

| Exclusion | Why |
| --- | --- |
| `*.test.ts`, `*.spec.ts`, `__tests__/`, `__mocks__/`, `test/` | Tests are the differential oracle (PHASE1 §5.2), not rule holders. A `ported` file is proved *by* its tests; the tests are not themselves a porting work item. 140 files. |
| `*.d.ts` | Ambient declarations carry no behaviour. |
| anything not `.ts` / `.tsx` / `.sql` | Docs, fixtures, editor droppings. |

Every heuristic is generous on purpose. **A false positive costs one manifest
line marked `out-of-scope`; a false negative is a money rule nobody ever notices
is unported** — which is the exact failure the three sweeps kept making. So the
heuristics are not where judgement lives. The manifest is.

Today discovery finds **243 of 261** in-scope files. `--why=<path>` answers "why
is this in the list", including for files it did *not* find.

---

## The manifest

`manifest.json`, one line per file, paths sorted — a `git diff` on it should
read as a list of dispositions changing, never as a reflow.

| Status | Means | Required fields |
| --- | --- | --- |
| `ported` | Its rules exist in the local edition, with differential or unit tests | `evidence` — the specs or tests that prove it |
| `mirror-of` | A TypeScript mirror of rules owned elsewhere | `of` — the audit ids it mirrors |
| `out-of-scope` | Deliberately not part of the port | `reason` |
| `pending` | Not yet dispositioned. The work queue | — |

Two derived fields, rewritten by `seed.mjs --refresh-citations` and never by
hand: `cited_by` (which audit documents name the file) and `ids` (the invariant
ids that appear in the same table row, list item or paragraph as the citation).
They are informational. **A citation is not a disposition** — AUDIT3 is explicit
that "a citation is not proof of a careful read" — so a cited file is still
`pending` until somebody does the work.

One optional field: `"discovery": "manual"`. It means "this entry was added by
human judgement and discovery is not expected to find it", and it exempts the
entry from the not-discovered alarm. It is the escape hatch for a money file the
heuristics genuinely miss — use it rather than loosening a heuristic until it
catches everything.

### Seed state, and what it is honest about

At seeding (2026-08-08): **243 discovered, 0 ported, 0 mirror-of, 13
out-of-scope, 230 pending** — of which **119 are cited by at least one audit and
111 by none**. That second number is AUDIT3 §0.1's 52 %, turned from a
measurement into a queue.

Nothing is `ported`, because nothing is: Phase 1 has not started. Nothing is
`mirror-of` either, and that is a real finding rather than an omission — the
obvious candidate, `src/services/api/dataService.ts`, mirrors #2/#73 and #60 but
AUDIT3 §6.1 also found eleven rules that live *only* there, so calling it a
mirror would lose them.

The 13 `out-of-scope` entries are only the ones a Phase 1 document already
decided, each carrying its citation:

- Stripe and billing (9 files) — PHASE1 §7: *"Stays cloud-only, permanently"*;
  `invoices.amount` is not ported (DESIGN §3.1 row 24).
- `api/account/delete.ts` — PHASE1 §7: GDPR erasure is deliberately not the wipe
  RPC, and locally "erase everything" is `rm wealth.db`.
- `src/services/supabaseService.ts` — PHASE1 §7 / TS-INVARIANTS §5: zero
  importers, and its `updateAccount` would write a nonexistent camelCase column.
  A port *hazard*, not a port target.
- `src/services/offlineDataService.ts` — AUDIT3 §7.2 verified: its only importer
  has zero importers, and it POSTs to endpoints that do not exist.
- `src/services/conflictResolutionService.ts` — PHASE1 §7: dormant, and Phase 1
  has no sync. Preserve the file; do not port it.

Three files carry a `note` instead of a status, because their disposition is
genuinely split and pretending otherwise would repeat the audits' mistake:
`calculations-decimal.ts` (24 of 34 exports dead and contradictory per AUDIT3
§4.1, seven live budget rules per §4.2), `offlineService.ts` (dead sync queue,
live UI components), `api/transactionService.ts` (holds D-4's out-of-scope third
split writer, everything else in scope).

### The rule the manifest may not break

**The manifest may only shrink through an `out-of-scope` reason. Never through
deletion.**

If a file is deleted or renamed, do not delete its entry: keep it and set
`status: "out-of-scope"` with a reason starting `deleted:`, `moved-to:` or
`superseded-by:` (those prefixes are what tell the checker the absence is
intentional), or re-point the entry at the new path. Deleting the line makes a
money file disappear from the record silently, which is the failure this whole
directory exists to prevent. The checker enforces this: a manifest entry whose
path is gone fails the run.

---

## What the checker actually checks

1. **Undispositioned** — a discovered file with no manifest entry. Fails.
2. **Vanished** — a manifest entry whose path no longer exists on disk, without
   one of the absence-permitting reasons. Fails. This is the monotonicity guard:
   renamed and deleted files must be dispositioned, not silently dropped.
3. **No longer discovered** — a manifest entry whose file still exists but now
   matches no heuristic, and is not marked `"discovery": "manual"`. Fails, because
   the likely cause is a heuristic regression, not a file that stopped handling
   money.
4. **Structural** — unknown status, `mirror-of` with no `of`, `out-of-scope` with
   no `reason`, `ported` with no `evidence`.

## What this does **not** prove

- **A `ported` mark is a human claim.** The checker verifies the entry names its
  evidence; it does not run it, parse it, or check that it covers anything. The
  differential harness (`scripts/local-sqlite/`, `npm run test:local-sqlite`) is
  what proves behaviour. This gate proves only that somebody looked at the file
  and wrote down a decision.
- **A file being discovered says nothing about how many rules it holds.** That is
  the point — the elastic-unit problem does not go away, it is routed around.
- **A citation is not a read.** `cited_by` records that a document names the
  file, nothing more.
- **Coverage is per file, not per line.** A partially ported file marked `ported`
  will pass. The three split-disposition notes above are the current workaround;
  if that becomes common, split the entry by symbol rather than weakening the
  status.

---

## How a Phase 1 work item flips a file

1. Pick a `pending` file — `npm run port:coverage -- --pending` prints the queue
   with each file's audit ids.
2. Read it, and write the rules into the local edition (Rust verb, SQLite
   constraint, or a spec in `scripts/local-sqlite/specs/`).
3. Add tests: a differential spec if both engines can be asked the same question,
   a unit test if the rule is admission logic with no SQL side.
4. Flip the entry to `"status": "ported"` with `"evidence"` naming those specs or
   tests.
5. `npm run port:coverage` — the pending count goes down by one, and can never
   go back up without someone editing the manifest.

If reading the file shows it holds nothing portable, mark it `out-of-scope` with
the reason. That is a completed work item too, and it is the honest way for the
queue to shrink.

New files land in the queue automatically:

```bash
node scripts/port-coverage/seed.mjs --audit-dir=<dir> --write
```

`seed.mjs` only ever *adds* entries. It never touches a status, a reason or a
note. `--refresh-citations` re-derives `ids` / `cited_by` from the audit
documents; `--audit-dir` points at the four Phase 1 documents (`DESIGN.md`,
`TS-INVARIANTS.md`, `PHASE1-PLAN.md`, `AUDIT3.md`). Those documents are not in
this repository yet — they should land in `docs/` when Phase 1 does, and until
then the manifest's `ids` / `cited_by` fields are the only durable record of
what the three sweeps found.

---

## CI

**Deliberately not wired into CI or any existing test gate.** The cloud repo's
checks must stay green; this is a Phase 1 instrument, run on demand.

When Phase 1 gets its own pipeline, it slots in beside the differential harness
— after lint and types, before the SQLite suite:

```yaml
- run: npm run port:coverage         # every money file is dispositioned
- run: npm run test:local-sqlite     # the ported constraints actually fire
- run: npm run test:local-verbs      # the ported verbs agree with the cloud
- run: npm run test:local-admission  # the ported DECISIONS agree with the TypeScript
```

That ordering is the point: the first job says nothing was forgotten, the rest
say what was remembered is correct. Neither claim is worth much alone.

The third lane is the one that matters most to this gate, and it is worth a
sentence. A `ported` mark on a `.sql` file names specs that compare the port
against Postgres, so the claim is checkable by a machine that has never read the
migration. A `ported` mark on a `.ts` file used to be a claim about a
transliteration — somebody copied the Vitest cases across, and if the module
changed afterwards nothing would say so. `npm run test:local-admission` runs the
TypeScript module itself, so the four `.ts` files flipped in the 2026-08-08
admission work are held to the shipped code rather than to a copy of it. The
`note` fields on the seven files beside them record exactly which part of each
is ported and which part is not, because a per-file status cannot say that and
pretending otherwise is the mistake the audits kept making.

Two conditions to meet before it becomes blocking, since it fails on day one by
construction: a `pending` count that is a deliberate backlog rather than a
surprise, and agreement that a heuristic change is a reviewable event (widening
one adds work to the queue, which is the intended direction — narrowing one must
be argued for in the PR that does it).

---

## Files

| Path | Role |
| --- | --- |
| `run.mjs` | The gate. `npm run port:coverage`. |
| `manifest.json` | Every discovered file → its disposition. The only place judgement lives. |
| `seed.mjs` | Adds entries for newly discovered files; re-derives citations. Never overwrites a disposition. |
| `lib/discovery.mjs` | The heuristics, and the schema vocabulary derived from the migrations. |
| `lib/manifest.mjs` | Manifest load, validation, and the one-line-per-file serialiser. |
| `lib/audit-citations.mjs` | Extracts file → invariant-id citations from the Phase 1 documents. Used only by `seed.mjs`. |
