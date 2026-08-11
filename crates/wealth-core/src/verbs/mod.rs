//! The command surface. One verb, one SQLite transaction, one or more audit
//! rows.
//!
//! # What is deliberately absent
//!
//! * **`set_account_balance`.** DESIGN.md §6.5: *"Note what is absent:
//!   `set_account_balance`. Deliberately. B-2."* Balance moves only as
//!   `balance = balance ± delta`, in SQL, inside a verb that also writes the row
//!   that justifies the delta. There is no way to set an absolute figure because
//!   there is no function that takes one.
//! * **Anything that accepts SQL.** DESIGN.md §6.4: *"Not a policy — an absence.
//!   There is no command that accepts a SQL string. You cannot bypass what does
//!   not exist."*
//! * ~~`create_category`, `update_category`, `delete_category`~~ — **no longer
//!   absent.** This entry used to say that the cloud has no such RPC
//!   (`PlanningService` writes the table directly: `planningService.ts:489`,
//!   `:568`, `:633`) and therefore *"a verb here would be a port of nothing"*.
//!   The sentence was true about the CLOUD and wrong about a device, for the
//!   reason the section below gives about the account family: with no RPC and no
//!   SQL door, no verb means the operation is unimplementable. Slice 21 landed
//!   [`create_category`], [`create_categories`], [`update_category`],
//!   [`delete_category`] and [`seed_categories`], whose oracles are those same
//!   three TypeScript writers plus `ensureCategories`.
//! * **The transfer-category lifecycle.** `create_transfer_category_for_account`,
//!   `sync_transfer_category_for_account` and `protect_transfer_category`
//!   (`20260708140000`) all `RETURN trigger`; nothing calls them as functions.
//!   They are C-3, C-4 and C-5 in `schema.sql`.
//!
//! # A VERB WHOSE ORACLE IS A TYPESCRIPT WRITER (PHASE3-PLAN D-2)
//!
//! [`create_account`], [`update_account`] and [`close_account`] are the first
//! three verbs here that port no Postgres function, because there is none to
//! port: `accounts` is one of the tables the cloud writes DIRECTLY over
//! PostgREST (`accountService.ts:267`, `:317`, `:357`). Every verb before them
//! either ported an RPC or, in the case of [`reads`], ported a query. The
//! CATEGORY family — [`create_category`], [`create_categories`],
//! [`update_category`], [`delete_category`] and [`seed_categories`] — is the
//! second such family and everything below applies to it unchanged, with one
//! addition of its own: [`seed_categories`] ports a TypeScript writer that CALLS
//! an RPC (`ensureCategories` → `migrate_categories_atomic`), so its oracle is
//! the method's whole body and the RPC is only the third of its three steps.
//!
//! Two things follow, and both are worth stating once here rather than three
//! times below.
//!
//! **Why they exist at all.** DESIGN.md §6.4 leaves no SQL door — *"There is no
//! command that accepts a SQL string. You cannot bypass what does not exist."*
//! In the cloud, "no RPC" means the client writes the table itself; locally it
//! means the operation is UNIMPLEMENTABLE. So a table the cloud writes directly
//! is precisely a table that needs a verb, which is the opposite of the
//! conclusion the category paragraph above used to draw.
//!
//! **What they are held to.** The oracle is the TypeScript writer plus
//! `schema.sql`'s constraints, and `lib/verb-postgres.mjs` runs that writer's
//! own INSERT and UPDATE through `psql` — transcribed key for key and default
//! for default, exactly as the READS table transcribes a `.select()`. Where the
//! two engines then differ, they differ because the local edition keeps an
//! invariant the cloud's direct writes do not, and each one is a DECLARED
//! divergence with a spec:
//!
//! | | the cloud's direct write | the verb |
//! | --- | --- | --- |
//! | a create's two money figures | stores both, and B-1 is broken from birth | ONE figure: `balance = initial_balance` |
//! | `balance` in an update patch | sets it — an absolute balance setter | refused, `account_balance_is_derived` |
//! | an opening-balance edit | moves `initial_balance` only, so B-1 drifts | moves both sides by one delta, in SQL |
//! | the audit log | nothing: there is no function to write one from | one entry per write, chained |
//! | `low_balance_*` on a create | not in the client's column list | written, because the seam says a create keeps every field |
//!
//! The audit row is the one that is a difference of KIND rather than of degree.
//! `write_financial_audit` is called from inside the atomic RPCs, and there is
//! no atomic RPC here — so in the cloud, renaming an account, closing one or
//! correcting its opening balance leaves no trace at all. Locally there is one
//! door and it audits, so it does.
//!
//! The category family's own table, in the same shape:
//!
//! | | the cloud's direct write | the verb |
//! | --- | --- | --- |
//! | a create's id | the column defaults to `gen_random_uuid()` | minted here (B-5), because the column holds slugs too and must not default |
//! | a bulk create's ordering | one `.insert(rows)`; a child before its parent needs no parent link yet, since `parent_id` is nullable | two passes, because `parent_id` is an IMMEDIATE key in this file |
//! | a delete's cascade | `ON DELETE CASCADE` takes the children, unseen | the subtree is walked and deleted deepest-first, so every row that goes is counted and audited |
//! | the audit log | nothing: there is no function to write one from | one entry per create, update and delete, chained — but **none** for a seed, and [`seed_categories`] argues that |
//! | an ordinary category with an `account_id` | stored | refused by `categories_account_only_for_transfer`, a CHECK the cloud has never had |
//! | two semantic flags on one row | stored | refused by `categories_flags_exclusive`, likewise |
//! | the already-seeded case | `ensureCategories` reads first and never calls the RPC; the RPC itself raises `categories_already_migrated` | ANSWERED, not refused: one crossing, and a port may not branch on a refusal code (D-3) |
//!
//! # `migrate_categories_atomic` — HALF of it is ported, and the half is B-4
//!
//! It was recorded here as *"needs a decision about what it would even do before
//! it needs a port"*, and then as **not ported at all**. Slice 21 amends that to
//! the precise version, which the original trace had already argued its way to
//! without naming: [`seed_categories`] ports the function's INSERT PASSES (2 and
//! 3) and deliberately not its ID REMAP (1 and 4). Everything below is the
//! original trace, unchanged, because it is what establishes which half is which
//! — read it and then read the two paragraphs at the end of this section, which
//! are the amendment.
//!
//! **It is live.** `planningService.ts:446`, from `ensureCategories`, called
//! whenever a signed-in user's cloud category table is empty. Its live definition
//! is `20260724100000:48-136`, the third of three (`20260611100000:36`,
//! `20260723190000:54`), each recreating the previous one with one more column.
//!
//! **What it does** is four passes over a category tree the CLIENT is holding:
//! mint a fresh uuid for every incoming id (pass 1), insert every row under its
//! new id with `parent_id` deliberately NULL (pass 2), wire the parents through
//! the map (pass 3), and then rewrite `transactions.category` and
//! `budgets.category` through the same map (pass 4). It refuses with
//! `categories_already_migrated` if the user has any category at all.
//!
//! **Why it exists**: the localStorage era gave categories ids like `'food'` and
//! `'transfer-out'`, and the cloud's `categories.id` is a uuid. The function is
//! the one-way door between those two id spaces, and pass 4 is the whole point —
//! the references have to move in the same transaction as the rows, or a
//! half-migrated user has transactions filed under ids nothing answers to.
//!
//! **Why a local file never needs it**: there is no second id space. A local file
//! mints its own uuids at creation, and the two ways a category tree can arrive
//! in one are both already covered by verbs that exist and are proven:
//!
//! * a **restore** — [`restore_user_chunk`] inserts categories under the ids the
//!   backup carries, verbatim, and X-9 puts any remapping on the client, before a
//!   single row is sent (`crate::backup` carries that argument);
//! * a **seed** — a brand-new file's default set is inserted under the ids it
//!   arrives with, so there is nothing to remap and nothing to be atomic about
//!   beyond the insert itself.
//!
//! Porting it whole would put a **second** category-tree writer in the crate, one
//! whose only distinguishing behaviour — the id remap — is a translation between
//! two id spaces the local edition does not have. Its idempotency guard would
//! then be the only part still doing work, and that guard is
//! [`user_financial_data_is_empty`]'s question asked about one table.
//!
//! **THE AMENDMENT.** That last sentence is exactly right and it is also the
//! whole specification of [`seed_categories`]: the guard, the insert, and none of
//! the remap. What the original trace got wrong was the conclusion it drew from
//! it — that no verb was needed — because it was still reading the sentence
//! *"the table and its constraints are the authority"*, which is a statement
//! about the CLOUD. Locally there is no door to the table, so B-4's *"the local
//! core seeds its defaults into the store"* is unimplementable without a verb.
//! The tree itself stays in TypeScript and crosses in the payload, exactly as
//! `p_categories` does, so there is one default set for three engines.
//!
//! The one thing that WOULD want the other half: a cloud→local migration path,
//! where a user's cloud tree is pulled into a fresh file. That is DESIGN.md
//! §9.1's explicitly out-of-scope *"cloud↔local sync"*, and if it is ever built
//! it wants `migrate_categories_atomic`'s shape rather than its code, because the
//! direction of travel is reversed and the id space that needs remapping is the
//! destination's.
//!
//! # `import_transactions` means the RPC, not PHASE1-PLAN §3.2's planner
//!
//! There are two things in the Phase 1 documents with that name and they are not
//! the same verb. [`import_transactions`] here is the port of
//! `import_transactions_atomic` — the WRITE path that exists in the cloud today,
//! which takes rows whose fields have already been decided and stores them.
//! PHASE1-PLAN §3.2's `import_transactions` is a larger, later thing: the
//! admission-control verb over `RawRow`, which decides what a file's TEXT means
//! (§3.1: *"TypeScript finds the records and their fields as text. Rust decides
//! what the text means"*) and enforces some thirty invariants that have no SQL
//! side at all — the date-order question, the sign question, D-3's zero-amount
//! rule, TS-I9's four cleared policies.
//!
//! When that verb is built it is the layer ABOVE this one, and this one is what
//! it ends in. Naming it here rather than leaving it to be discovered, because
//! two things called `import_transactions` is exactly how the wrong one gets
//! called.
//!
//! # Deliberately not done YET, and named so nobody has to re-derive it
//!
//! Nothing in the category family is now outstanding.
//! [`delete_unused_categories`] — the Money-set "replace" import's bulk prune,
//! `planningService.ts:511` — was the last of the two named here, and it is
//! ported. What it found is worth reading before touching it: the RPC has no
//! refusal of its own, the FILE has one anyway through C-5, the "a stale client
//! can never destroy referenced data" promise has a measured hole in it that the
//! port reproduces on purpose, and the cloud's single-statement DELETE cannot be
//! spelled as a single statement locally without changing the number it returns.
//!
//! # An obligation recorded before the verb that needs it existed — now DONE
//!
//! `scripts/local-sqlite/specs/r5-split-leg-links-are-set-null-never-cascaded.spec.mjs`
//! measured this and PHASE1-PLAN's addendum §A carries it: SQLite applies
//! `ON DELETE SET NULL` as an UPDATE of the child row, and that UPDATE fires
//! `trg_protect_linked_leg`, which raises `split_leg_locked`. So **every** path
//! that deletes a transaction a split line links to — the delete verb, the
//! duplicate sweep, the wipe, the restore's pre-clear, the transfer-unlink
//! repair — must hold `_rpc_guard('leg')` for the duration of the delete:
//!
//! ```sql
//! BEGIN IMMEDIATE;
//! INSERT OR IGNORE INTO _rpc_guard VALUES ('leg');  -- iff a split leg is touched
//! DELETE FROM transactions WHERE id = ?;
//! DELETE FROM _rpc_guard WHERE flag = 'leg';
//! COMMIT;
//! ```
//!
//! The trap it closes: the error the user is shown says *"delete that transfer
//! first, then edit the split"*, and without the guard that remedy is itself
//! refused.
//!
//! [`delete_transaction`] discharges this for the delete path, and while doing
//! so found the **second** direction the addendum had not seen — a split parent
//! whose own line is a leg, where the cascade fires
//! `trg_protect_linked_leg_delete` instead. Its module documentation is the
//! record. `delete_transaction::touches_a_transfer_leg` is the condition the
//! other paths should reuse rather than re-derive — and the two paragraphs below
//! are what became of the four that were still owing when it was written.
//!
//! `create_transaction` and `update_transaction` delete no transaction, so
//! neither carries the guard — and `update_transaction` deliberately does not
//! hold `_rpc_guard('split')` either; see its module documentation.
//!
//! Of the four remaining paths, **the transfer-unlink repair is now settled**:
//! [`clear_transfer_links`] and [`repair_claimed_transfer`] between them are the
//! whole of that path, and neither deletes a transaction — the unlink is an
//! UPDATE of `linked_transfer_id` and the repair is three UPDATEs. So the
//! obligation does not apply to them, which is a better outcome than discharging
//! it.
//!
//! **The wipe and the restore's pre-clear are the same path**, and it is now
//! discharged too: [`wipe_user_financial_data`] IS the pre-clear a restore
//! demands, and it holds `_rpc_guard('leg')` conditionally, on the same condition
//! [`delete_transaction`] uses. Its module documentation carries the measurement.
//! One path is left owing the guard: the duplicate sweep.
//!
//! Discharging it also found the half of the obligation that was about the
//! SCHEMA rather than about a verb. `trg_unnest_account_references` nulls
//! `transfer_account_id` in a BEFORE DELETE trigger — a workaround for SQLite
//! having no `ON DELETE SET NULL (column)` — which leaves a linked row
//! half-cleared for one statement, and `transactions_linked_has_target` (a CHECK
//! this schema has and the cloud does not) refuses that state. No guard could
//! have helped: the refusal is a CHECK, not a trigger. So "delete everything" was
//! refused outright on any file holding one linked transfer, and the repair is in
//! `schema.sql` rather than in a verb.
//!
//! # Which guard belongs to which verb — settled by measurement
//!
//! [`set_transaction_splits_with_legs`], the verb the guard mechanism was built
//! for, turns out to need only **one** of the two:
//!
//! | verb | `split` | `leg` |
//! | --- | --- | --- |
//! | [`create_transaction`] | no | no |
//! | [`update_transaction`] | no — deliberately; holding it would make it a split writer | no |
//! | [`delete_transaction`] | no | **conditionally** — both directions, R-5 |
//! | [`set_transaction_splits_with_legs`] | **always** — it IS the split writer | no, and proven so |
//! | [`link_transfer_pair`] | no | no |
//! | [`create_transfer_counterpart`] | no | no |
//! | [`clear_transfer_links`] | no | no |
//! | [`repair_claimed_transfer`] | no | no |
//! | [`link_split_line_transfer`] | no | no, and proven so |
//! | [`merge_categories`] | no — the CASE keeps a split parent's category blank | **conditionally** — it re-files split lines |
//! | [`apply_category_to_uncategorized`] | **no, and it must not** — see below | no |
//! | [`confirm_transaction_categories`] | no, and structurally so | no |
//! | [`user_financial_data_is_empty`] | no — it opens no transaction and writes nothing | no |
//! | [`wipe_user_financial_data`] | no | **conditionally** — the pre-clear, R-5 |
//! | [`restore_user_chunk`] | no, and proven so on BOTH engines | no |
//! | [`finalize_user_restore`] | no | no |
//! | [`link_bank_account_snap`] | no, and proven so | no |
//! | [`delete_unused_categories`] | no, and proven so — it deletes a category, and the cascade's only writes are `category_id` columns nothing watches | no |
//! | [`verify_integrity`] | no — it opens no transaction and writes nothing | no |
//! | [`import_transactions`] | no, and proven so — nothing on `transactions` fires on INSERT | no |
//! | [`import_bank_transactions`] | no, same measurement | no |
//! | [`create_account`] | no, and proven so — the only trigger an account INSERT fires is C-3, which is wanted | no |
//! | [`update_account`] | no, and proven so — C-4 fires, and is wanted | no |
//! | [`close_account`] | no, same measurement — C-4 again | no |
//! | [`create_category`] / [`create_categories`] | no — nothing on `categories` fires on an INSERT | no |
//! | [`update_category`] | no — `trg_categories_updated_at` stands down of its own accord, and C-5 is `BEFORE DELETE` | no |
//! | [`delete_category`] | no, and it must not — C-5 is the answer, exactly as it is for the prune | no |
//! | [`seed_categories`] | no — an INSERT and an UPDATE of `categories`, same measurement as the two above | no |
//!
//! The restore family adds a **third** flag to the table, which the first twelve
//! verbs never needed: `_rpc_guard('restore')`, held by
//! [`finalize_user_restore`] alone. It is the twin of the cloud's
//! `app.restore_in_progress` session flag, and it is the only flag in the schema
//! that stands down a *convenience* rather than a *protection* — the `updated_at`
//! triggers exist to stamp a timestamp on a row whose writer did not, and a
//! restore is precisely the writer that did. That difference is why it is the one
//! flag held unconditionally.
//!
//! The split writer's own module documentation carries the proof: every write it
//! makes to a *linked* line changes only `memo`, `sort_order` and `updated_at`,
//! which is exactly the set `trg_protect_linked_leg` does not watch, and the
//! leg-removal refusal fires before the DELETE, so
//! `trg_protect_linked_leg_delete` has nothing to fire on. Standing S-9 and S-10
//! down for the duration of the largest write in the schema — the one moment they
//! are most worth having — would have been the easy mistake, and it is a mistake
//! only because the triggers were measured rather than assumed.
//!
//! ## The transfer family's answer, and why it is not an assumption either
//!
//! Five verbs in a row needing **no** guard looks like a table nobody checked.
//! Each has a different reason and each was checked:
//!
//! * [`link_transfer_pair`], [`create_transfer_counterpart`] and
//!   [`repair_claimed_transfer`] write `type` and `category`, which
//!   `trg_protect_split_type` and `trg_protect_split_category` watch — but only
//!   `WHEN OLD.is_split = 1`, and all three refuse a split row *before* their
//!   first write. The refusal ORDER is what makes the guard unnecessary, which
//!   is a slightly alarming dependency and is why it is written down here.
//! * [`clear_transfer_links`] writes `linked_transfer_id` and `updated_at`, and
//!   every split guard is `BEFORE UPDATE OF <column>` over a column list that
//!   contains neither. Its writes are not merely permitted — they are not
//!   *examined*.
//! * [`link_split_line_transfer`] is the interesting one, because it does write
//!   to `transaction_splits`. `trg_protect_linked_leg` fires
//!   `WHEN OLD.linked_transfer_id IS NOT NULL`, and the verb refuses
//!   `split_line_already_linked` before touching the line — so the trigger is
//!   consulted and stands down. `tests/transfer_family.rs` proves that
//!   behaviourally, with the guard table asserted empty for the whole call.
//!
//! The general lesson the splits verb wrote down holds in both directions: the
//! guard a verb needs is a fact about the triggers and the verb's own refusal
//! order, and it has to be measured for each one. Four of these five were
//! measured to need nothing; the fifth was the one that looked most likely to
//! need something and needs nothing, for a reason that only shows up when you
//! read the trigger's WHEN clause against the verb's refusal list.
//!
//! ## The category family, and the R-5 trap turning up somewhere new
//!
//! Nine verbs in and the table had exactly one "yes" outside the split writer.
//! [`merge_categories`] is the second, and it was found the same way — by running
//! the write against the file rather than reasoning about it:
//!
//! * The merge re-files `transaction_splits.category`. In the cloud the
//!   linked-leg rules are PROCEDURAL, inside `set_transaction_splits_with_legs`,
//!   so nothing watches that column. Locally `schema.sql` turned them into
//!   TRIGGERS on purpose — *"so a future code path that forgets them still cannot
//!   break the pair"* — and `category` is one of the four columns
//!   `trg_protect_linked_leg` watches. MEASURED: Postgres re-files a **linked**
//!   leg happily; SQLite raises `split_leg_locked`. Without the guard the local
//!   edition would refuse a merge the cloud performs, for the commonest split
//!   shape in the owner's own data.
//! * The same verb also writes `transactions.category` for split parents and does
//!   **not** need `split`, because its `CASE` leaves a split parent's blank
//!   category blank. That was measured both ways rather than reasoned: the
//!   trigger IS consulted, and stands down.
//!
//! [`apply_category_to_uncategorized`] is the first verb where holding a guard
//! would be actively wrong. It stamps a category onto blank rows, and a split
//! parent's category is blank BY DESIGN — so `trg_protect_split_category` raises
//! `split_category_locked` and the whole call is lost. That is what the LIVE
//! cloud function does too (its `AND NOT is_split` was dropped by a rebase; the
//! verb's own documentation carries the evidence), so the local refusal is a
//! faithful port. `_rpc_guard('split')` would make the local edition silently
//! succeed where the cloud fails, which is a divergence dressed as a fix.
//!
//! ## The restore family, and a guard the cloud appears to need and does not
//!
//! [`restore_user_chunk`] is the one that looks most like it should hold
//! something: the RPC opens with `set_config('app.split_rpc', '1', true)` and its
//! comment says *"whitelists the split guard for this transaction so restored
//! split parents can carry is_split = true"*. MEASURED on the reference cluster,
//! by listing the triggers rather than reading the comment: every split
//! protection in the cloud is `BEFORE UPDATE` —
//! `trg_protect_split_transaction_fields` and `trg_sweep_reconciled_into_archive`
//! both — and a restore only ever INSERTs. The same is true here, where all four
//! `trg_protect_split_*` triggers are `BEFORE UPDATE OF`. So the answer is
//! *none*, on both engines, and the cloud's `set_config` is belt-and-braces
//! rather than a rule this port would have missed. Copying it would have meant
//! standing S-5 down for the largest INSERT in the product on the strength of a
//! comment.
//!
//! [`wipe_user_financial_data`] is the opposite case and the reason the guard
//! question is asked per verb: it holds nothing that a reading of its SQL would
//! suggest — it issues ten DELETEs and touches no split column — and it needs
//! `leg` anyway, because the cascade from `accounts` reaches
//! `transaction_splits` and `trg_protect_linked_leg_delete` fires there.
//!
//! ## The prune, and a protection no guard may stand down
//!
//! [`delete_unused_categories`] is the third deleting verb, and the guard
//! question has a new shape here: its cascade reaches a category the schema
//! PROTECTS. Name a prunable parent and a To/From category sitting under it, and
//! `parent_id ON DELETE CASCADE` walks the protected row straight into C-5's
//! `BEFORE DELETE` trigger. MEASURED on both engines, and the local answer is
//! `transfer_category_protected` on both — including with `_rpc_guard('split')`
//! held, which changes nothing, because C-5 has no guard clause and must not
//! acquire one. That is the difference between this and the R-5 leg trap: R-5's
//! refusal blocked the remedy the error message itself recommended, so standing
//! it down was the fix; here the refusal IS the answer, the cloud gives the same
//! answer, and both engines lose the whole batch. The verb holds nothing.
//!
//! ## The ingest pair, and the first time the answer was cheap
//!
//! Both import verbs need **nothing**, and for once the reason is short enough
//! to state in a sentence: they INSERT into `transactions`, and not one of that
//! table's seven triggers fires on an INSERT. Every split protection is
//! `BEFORE UPDATE OF`, the archive sweep is `AFTER UPDATE OF is_cleared`, and the
//! dismissal prune is `AFTER DELETE`. It was still measured rather than reasoned
//! (`scratchpad/local-core/probe-ingest-sqlite.mjs` lists the triggers and counts
//! the INSERT ones), because "no trigger watches this" is exactly the claim the
//! merge verb's port disproved for a column everybody had assumed was unwatched.
//!
//! The other half of each verb — the `accounts` UPDATE — is watched by
//! `trg_sync_transfer_category_for_account` (`AFTER UPDATE OF name, is_active`,
//! neither of which either verb writes) and by `trg_accounts_updated_at`, which
//! stands down of its own accord because both verbs write `updated_at`
//! themselves. `tests/ingest.rs` asserts the guard table empty after a
//! successful import on each verb, so "no guard" is an assertion rather than a
//! paragraph.
//!
//! [`verify_integrity`] is outside the table's premise entirely — it is the
//! second read-only verb in the crate — and it is the one place where the guard
//! table itself is a subject rather than a tool: `schema.sql` records that a
//! stray `_rpc_guard` row is impossible because the flag is set and cleared
//! inside the transaction it authorises, "and verify_integrity() reports one
//! anyway". It does not yet: no check in `v_integrity_violations` looks at
//! `_rpc_guard`. Recorded here rather than fixed, because a check for a row that
//! cannot exist needs a way to be planted before it can be proved, and every
//! route to one goes through a crash mid-transaction that this harness has no
//! way to stage.

//! # And then the reads, which are verbs too
//!
//! [`reads`] holds the first six: the accounts, the closed accounts, the
//! categories, the budgets, the goals and the suggestion dismissals. None of
//! them is a port of a Postgres FUNCTION — the cloud reads these tables over
//! PostgREST — so what each one ports is a *query*, `.eq()` for `.eq()` and
//! `.order()` for `.order()`, and its oracle in the differential harness is
//! that query written out.
//!
//! They are in this crate rather than beside it because of what leaves with
//! them: money, as the decimal string [`crate::money`] renders once. The whole
//! argument is PHASE3-PLAN D-4 and it is restated at the head of [`reads`],
//! along with the ordering contracts, the tie-break this crate states for
//! itself, and the EXPLAIN QUERY PLAN line each read was measured against.
//!
//! That module is `pub` where every other verb module here is private, and the
//! reason is those docs: a private module's documentation is not rendered, and
//! the plan requires the plans to be readable — *"a plan saying SCAN is a bug
//! report, not a merge"* is not a rule anybody can apply to a table they cannot
//! see.
//!
//! # And then the composite, which is the reads asked once
//!
//! [`load_boot`] is the first verb in the crate that is a port of no SQL at all:
//! the thing it ports is a TypeScript method (`DataServiceImpl.loadBoot`) whose
//! whole body is six of the reads above in the order the boot depended on. It
//! composes the same `crate::row` functions those reads call — no query of its
//! own, so no plan of its own — inside ONE deferred read transaction, which is
//! what makes the contract suite's `BOOT_COMPOSITION` row for this engine (*"one
//! crossing, one transaction, one snapshot"*) true rather than aspirational.
//!
//! It lives in its own module rather than beside them in [`reads`] because it
//! disagrees with that module's opening claim in one respect that matters: the
//! reads *"open no transaction, for the reason
//! [`user_financial_data_is_empty`] gives: there is nothing to be atomic
//! about"*. A composite has something to be atomic about — six statements are
//! six snapshots unless something makes them one — and a verb whose behaviour
//! contradicts its module's header is a verb somebody will read wrongly.

mod apply_category_to_uncategorized;
mod clear_transfer_links;
mod close_account;
mod confirm_transaction_categories;
mod create_account;
mod create_category;
mod create_transaction;
mod create_transfer_counterpart;
mod delete_category;
mod delete_transaction;
mod delete_unused_categories;
mod finalize_user_restore;
mod import_bank_transactions;
mod import_transactions;
mod link_bank_account_snap;
mod link_split_line_transfer;
mod link_transfer_pair;
mod load_boot;
mod merge_categories;
pub mod reads;
mod repair_claimed_transfer;
mod restore_user_chunk;
mod seed_categories;
mod set_transaction_splits_with_legs;
mod transfer;
mod update_account;
mod update_category;
mod update_transaction;
mod user_financial_data_is_empty;
mod verify_integrity;
mod wipe_user_financial_data;

pub use apply_category_to_uncategorized::{
    apply_category_to_uncategorized, ApplyCategoryToUncategorized,
    ApplyCategoryToUncategorizedResult,
};
pub use clear_transfer_links::{
    clear_transfer_links, ClearTransferLinks, ClearTransferLinksResult,
};
// The account family — three verbs, no RPC between them. See "A VERB WHOSE
// ORACLE IS A TYPESCRIPT WRITER" above.
pub use close_account::{close_account, CloseAccount, CloseAccountResult};
pub use confirm_transaction_categories::{
    confirm_transaction_categories, ConfirmTransactionCategories,
    ConfirmTransactionCategoriesResult,
};
pub use create_account::{create_account, CreateAccount, CreateAccountResult};
// The category family — five verbs, no RPC between them either, and the same
// "A VERB WHOSE ORACLE IS A TYPESCRIPT WRITER" argument above.
pub use create_category::{
    create_categories, create_category, CategoryDraft, CreateCategories, CreateCategoriesResult,
    CreateCategory, CreateCategoryResult, CreatedCategories,
};
pub use create_transaction::{create_transaction, CreateTransaction, CreateTransactionResult};
pub use delete_category::{delete_category, DeleteAnswer, DeleteCategory, DeleteCategoryResult};
pub use create_transfer_counterpart::{
    create_transfer_counterpart, CreateTransferCounterpart, CreateTransferCounterpartResult,
};
pub use delete_transaction::{
    delete_transaction, DeleteTransaction, DeleteTransactionResult,
};
pub use delete_unused_categories::{
    delete_unused_categories, DeleteUnusedCategories, DeleteUnusedCategoriesResult, PruneAnswer,
};
pub use finalize_user_restore::{
    finalize_user_restore, AccountParent, FinalizeAnswer, FinalizeUserRestore,
    FinalizeUserRestoreResult, RestoreLinks, TransactionLink,
};
pub use import_bank_transactions::{
    import_bank_transactions, BankRow, FeedAnswer, ImportBankTransactions,
    ImportBankTransactionsResult,
};
pub use import_transactions::{
    import_transactions, ImportAnswer, ImportRow, ImportTransactions, ImportTransactionsResult,
};
pub use link_bank_account_snap::{
    link_bank_account_snap, LinkBankAccountSnap, LinkBankAccountSnapResult,
};
pub use link_split_line_transfer::{
    link_split_line_transfer, LinkSplitLineTransfer, LinkSplitLineTransferResult,
};
pub use link_transfer_pair::{link_transfer_pair, LinkTransferPair, LinkTransferPairResult};
// The composite. Its payload is the reads' own `OwnedRead` — one owner and
// nothing else — because that is exactly what it takes; a struct of its own
// would be a second place for somebody to add a filter to.
pub use load_boot::{load_boot, Boot};
pub use merge_categories::{merge_categories, MergeCategories, MergeCategoriesResult};
// The read family. Re-exported like every other verb so a call site reads the
// same whether it is asking or writing; the module stays `pub` as well, because
// its documentation is where the ordering and the query plans live.
pub use reads::{
    account_balances, list_accounts, list_budgets, list_categories, list_closed_accounts,
    list_goals, list_suggestion_dismissals, list_transaction_splits, list_transactions, splits_for,
    AccountBalances, Accounts, Answered, Budgets, Categories, ClosedAccounts, Goals, OwnedRead,
    Splits, SplitsFor, SuggestionDismissals, TransactionSplits, Transactions,
};
pub use repair_claimed_transfer::{
    repair_claimed_transfer, RepairClaimedTransfer, RepairClaimedTransferResult,
};
pub use restore_user_chunk::{
    restore_user_chunk, Chunk, RestoreAnswer, RestoreUserChunk, RestoreUserChunkResult,
};
pub use seed_categories::{
    seed_categories, SeedCategories, SeedCategoriesResult, SeededCategories,
};
pub use set_transaction_splits_with_legs::{
    set_transaction_splits_with_legs, SetTransactionSplitsWithLegs,
    SetTransactionSplitsWithLegsResult,
};
pub use update_account::{update_account, AccountPatch, UpdateAccount, UpdateAccountResult};
pub use update_category::{
    update_category, CategoryPatch, UpdateCategory, UpdateCategoryResult,
};
pub use update_transaction::{
    update_transaction, TransactionPatch, UpdateTransaction, UpdateTransactionResult,
};
pub use user_financial_data_is_empty::{
    user_financial_data_is_empty, IsEmptyAnswer, UserFinancialDataIsEmpty,
    UserFinancialDataIsEmptyResult,
};
pub use verify_integrity::{
    verify_integrity, Finding, IntegrityReport, VerifyIntegrity, VerifyIntegrityResult,
};
pub use wipe_user_financial_data::{
    wipe_user_financial_data, WipeCounts, WipeUserFinancialData, WipeUserFinancialDataResult,
    CONFIRMATION,
};

// ── Three things the category family needed three copies of ─────────────────
//
// The nine transfer/transaction verbs each carry their own `json_of`, and they
// are deliberately left alone: churning nine green files to share four lines is
// a bad trade against the risk. The category family is three new verbs written
// at once, so they share from the start.

use serde::Serialize;
use std::collections::BTreeSet;

use crate::error::{CoreError, CoreResult, Refusal};

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

/// A row count, as the `i64` every result in this crate reports.
///
/// The conversion cannot fail on any file a person owns; it is a refusal rather
/// than a panic because this crate does not panic on data.
fn count(value: usize) -> CoreResult<i64> {
    i64::try_from(value).map_err(|_| {
        CoreError::refuse(
            "amount_out_of_range",
            "that is more rows than this ledger can count",
        )
    })
}

/// The ids a `p_ids uuid[]` argument really names, once each, in the order the
/// cloud's cursor walks them.
///
/// `id = ANY(p_ids)` matches each row once however many times its id appears in
/// the array, and the RPCs then walk the matching rows in whatever order the
/// executor picks — which for these two functions is unobservable, because every
/// row gets the same treatment. A `BTreeSet` gives the DISTINCT and a stable
/// order in one step: for canonical lowercase uuid text, byte order and
/// Postgres's uuid order are the same order.
///
/// [`clear_transfer_links`] builds the same set inline because it needs it twice
/// and for a different purpose (its `count(DISTINCT …)` guarantee); this is the
/// plain version the two provenance verbs share.
fn distinct_ids(named: &[String]) -> BTreeSet<&str> {
    named.iter().map(String::as_str).collect()
}

/// The port of `category IS NULL OR btrim(category) = ''`.
///
/// One predicate, used in **opposite** directions by the two provenance verbs,
/// which is why it is here rather than duplicated in each with one of them
/// negated: [`apply_category_to_uncategorized`] fills the rows this is true of,
/// and [`confirm_transaction_categories`] skips them. A split parent's category
/// is blank by design, so this one function is what selects it into the first
/// verb's loop and out of the second's.
///
/// `str::trim` for `btrim`: both strip leading and trailing whitespace, and the
/// only spelling difference is which characters count as whitespace — Postgres's
/// `btrim` defaults to the space character alone, Rust's `trim` to Unicode
/// whitespace. A category id containing a tab is not a shape either engine
/// produces, and the wider test is the safer one.
fn is_blank_category(category: Option<&str>) -> bool {
    category.is_none_or(|value| value.trim().is_empty())
}

/// A row inside a batch that serde could not read, as a refusal with a NAME.
///
/// The two ingest verbs deserialise their rows one at a time inside the loop, so
/// the row's own errors never pass through [`crate::command`]'s `boundary_code`
/// and would otherwise all arrive as `invalid_command`. That matters for exactly
/// one of them: `deny_unknown_fields` is this crate's DECLARED divergence from
/// both import RPCs — the cloud discards a key it does not know, the local
/// edition refuses it — and a divergence reported under the same code as a
/// malformed request is indistinguishable from one. The caller is meant to be
/// able to tell a typo from a rejection; `unknown_field` is how.
///
/// Matched on serde's prefix rather than reconstructed, because the rest of the
/// message names the offending key and lists the ones that were expected, and
/// that is the half a person needs.
fn row_error(error: &serde_json::Error) -> CoreError {
    let message = error.to_string();
    if message.starts_with("unknown field") {
        return CoreError::Refused(Refusal::named("unknown_field", &message).with_hint(
            "The cloud RPC discards a key it does not recognise; the local edition refuses it, so \
             a misspelled field cannot be silently dropped.",
        ));
    }
    CoreError::InvalidCommand(message)
}
