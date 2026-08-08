//! `set_transaction_splits_with_legs` — the port of the split writer.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260806094058_split_transfer_legs.sql:121-492`. Traced
//! by grep across every migration file: this function is defined **once** and
//! has never been redefined. `20260808100000_category_provenance.sql` — the
//! provenance migration, which did widen `create_transaction_atomic` and
//! `update_transaction_atomic` — does not mention it, so a split line's category
//! carries no `category_confirmed` and the parent's is left exactly as the last
//! writer set it.
//!
//! It is **not** a port of `set_transaction_splits` (`20260713100000:170-250`),
//! which is the older, stricter writer that replaces the whole line set and
//! refuses a To/From category outright. That one is deliberately left alone in
//! the cloud (`20260806094058:71-77`) and is not ported here either: it cannot
//! express a leg, and a local edition with only the blunt writer would reproduce
//! the bug this migration exists to fix — 78 split parents that could not be
//! edited at all because one of their lines was half of a transfer.
//!
//! # Three implementations exist. This is a port of the RPC (D-4)
//!
//! `dataService.setTransactionSplitsLocally` (`dataService.ts:638-820`) mirrors
//! the RPC closely, with one divergence its own comment records: *"Unlike the
//! server, a category that is simply absent from local storage is not fatal"*.
//! The RPC raises `unknown category: <id>`. `transactionService`'s local branch
//! (`transactionService.ts:916-981`) is weaker still — no leg guard, and it
//! regenerates every line with a fresh uuid, which loses the identity this whole
//! writer is built on. PHASE1-PLAN §7 files that one as a cloud-side ticket.
//!
//! Neither divergence is reproduced. The RPC is the specification; the mirrors
//! are recorded so that nobody later reads one of them and concludes this file
//! is wrong.
//! `verb-specs/split-a-category-nobody-has-is-refused-by-name.spec.mjs` pins the
//! RPC's behaviour from the cloud side, so the day the cloud softens, the spec
//! fails rather than the two editions quietly parting company.
//!
//! # The refusal ORDER is part of the contract, and it was measured
//!
//! A payload that breaks two rules must produce the same *first* error on both
//! engines, or an application that reads `error.message` shows a different
//! sentence depending on where it is running. The order below is not read off
//! the source: every adjacent pair was executed against the reference cluster on
//! 2026-08-08 with a payload that breaks both rules, and the winner recorded.
//!
//! ```text
//!  1  p_splits must be a jsonb array
//!  2  a split needs at least 2 lines
//!  3  transaction_not_found
//!  4  transfers cannot be split
//!  5  split_line_id_repeated
//!  6  split_leg_line_removed
//!     ── then, per line, in payload order ──
//!  7  every split line needs a category
//!  8  every split line needs a non-zero amount
//!  9  account_not_found_or_not_owned      (the line's transfer target)
//! 10  a transfer needs two different accounts
//! 11  unknown category: <id>
//! 12  split_leg_not_declared
//! 13  split_leg_category_mismatch
//! 14  split_line_not_found
//! 15  split_leg_amount_locked
//! 16  split_leg_target_locked
//! 17  split_leg_category_locked
//! 18  Transfers between accounts in different currencies are not supported yet
//!     ── then, once ──
//! 19  split_total_mismatch
//! 20  split_write_inconsistent
//! 21  account_not_found_or_not_owned      (the PARENT's own account)
//! ```
//!
//! Two of those orderings are surprising enough to be worth naming, because a
//! port written from the source's *sections* rather than its *statements* gets
//! both wrong:
//!
//! * **14 is below 11, 12 and 13.** A payload that names a line id which is not
//!   part of this split *and* files it under an unknown category is told about
//!   the category. The stored-line lookup happens after every check that can be
//!   made from the payload alone.
//! * **12 beats 15, 16 and 17.** Sending a pinned leg back without its
//!   `transfer_account_id` raises `split_leg_not_declared` (it is filed under a
//!   To/From category and no longer says which account), not
//!   `split_leg_target_locked`. MEASURED — the target lock is reachable only
//!   when the leg is filed under an *ordinary* category, which is exactly the MS
//!   Money importer's shape and exactly the population this migration was
//!   written for.
//!
//! # The refusal count
//!
//! PHASE1-PLAN §6.1 sizes this function as "362 lines / 14 refusals". It has
//! **21 `RAISE EXCEPTION` sites carrying 19 distinct names**, twenty of which are
//! reachable from a payload. The plan's figure is an undercount, not a different
//! definition: the twenty-first, `split_write_inconsistent`, is a self-check that
//! no payload can reach (a repeated id is caught at 5, and SQLite has one
//! writer), and it is ported anyway — see below.
//!
//! # Which guard this verb holds, and which it does not
//!
//! `verbs/mod.rs` records the R-5 obligation and the delete verb's extension of
//! it, and the natural assumption is that the split writer needs
//! `_rpc_guard('leg')` most of all. It does not, and the reason is worth having
//! written down:
//!
//! * **`_rpc_guard('split')` — held.** The parent write sets `is_split`,
//!   `amount_minor` and `category`, and all three are protected by
//!   `trg_protect_split_*`. This is the cloud's `set_config('app.split_rpc','1')`
//!   at `20260806094058:235`, in the mechanism `schema.sql` §6 provides. It is
//!   held **unconditionally**, unlike the delete verb's conditional leg guard,
//!   because being the split writer is this verb's identity rather than an
//!   incidental effect of it.
//! * **`_rpc_guard('leg')` — not held, and proven unnecessary.**
//!   `trg_protect_linked_leg` fires only when a row that already has a
//!   `linked_transfer_id` changes its amount, target, category or link. Every
//!   write this verb makes to a *linked* line changes only `memo`, `sort_order`
//!   and `updated_at` (`:333-336`); every write that changes a protected column
//!   is on a line whose `linked_transfer_id` is NULL, where the trigger's WHEN
//!   clause is false. `trg_protect_linked_leg_delete` cannot fire either,
//!   because the leg-removal check at 6 refuses before the DELETE at
//!   `:239-241` runs, so nothing deleted here is ever a leg.
//!   `tests/set_transaction_splits_with_legs.rs` asserts this rather than
//!   assuming it: it drives the pinned-leg edit and the counterpart mint with no
//!   leg guard anywhere and shows the triggers stay silent. Holding a guard that
//!   is not needed would disarm S-9 and S-10 for the duration of the largest
//!   write in the schema, which is precisely when they are most worth having.
//!
//! # Balance effects — what the RPC actually does
//!
//! Not balance-neutral, and in two places rather than one:
//!
//! * **Each minted counterpart** moves its own account by the counterpart's
//!   amount — `balance = balance + (−line)`. Two accounts' worth of money moves
//!   and net worth does not change, which is what makes it a transfer.
//! * **The parent's account** moves by `newΣ − old amount`, and *only* if that
//!   is non-zero. A replacing set that re-files £25 as £15 + £10 moves nothing;
//!   one that re-files it as £20 + £20 moves the account by £15.
//!
//! Both are `balance = balance ± delta` in SQL (B-2), and every one of them reads
//! `changes()`, because Postgres's `IF NOT FOUND` is free and SQLite's silence is
//! not. The counterpart's account is re-read **per line**, so two legs into the
//! same account produce two audit entries that chain correctly rather than two
//! copies of one "before".
//!
//! # `split_write_inconsistent`, ported despite being unreachable
//!
//! `:431-443` re-reads storage and compares it with what the call *described*.
//! In the cloud it guards against a concurrent writer; locally there is one
//! writer and `BEGIN IMMEDIATE` holds it, so nothing can slip past. It is ported
//! because the property it asserts — *the parent's amount is a number some line
//! set actually supports* — is the one that would be silently false if any of the
//! branches above ever grew a bug, and because a self-check that costs one
//! aggregate query per split is not worth economising on in a ledger. No
//! differential spec can reach it; that is stated rather than papered over.
//!
//! # What this verb does NOT do
//!
//! * **It never un-splits.** An empty line set is refused at 2, exactly as the
//!   cloud refuses it: un-splitting deletes every line, legs included, and that
//!   belongs to the strict writer which has no legs to lose.
//! * **It does not decide a line's sign.** TS-M3 (canonical #25) says a line is
//!   signed by its own category's direction rather than its parent's, so one
//!   split may hold an expense line and an income line at once. That rule lives
//!   where the line is composed (`src/utils/transactionSplits.ts:88-108`); the
//!   RPC stores the sign it is given and so does this.
//!   `verb-specs/split-lines-are-signed-one-by-one-not-by-the-parent.spec.mjs`
//!   proves both engines carry a mixed-direction set through unaltered.
//! * **It does not pair an existing row.** That is `link_split_line_transfer`
//!   (`:509-623`), the other half of the same migration, and a separate verb.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};
// Imported as bare functions rather than through the module, because this file
// has a local `category` binding on every line of every split and
// `category::read_filing(…, &category, …)` reads like a typo even though the two
// namespaces never collide.
use crate::row::category::{read_filing, transfer_category_for};
use crate::row::split::{self, SplitRow};
use crate::row::{self, TransactionRow};
use crate::wire::{as_text, trimmed_or_none, trimmed_text};

/// The command. The RPC's four arguments as one object, for the reason the
/// update verb gives: the differential harness sends **one** payload to both
/// engines and the Postgres driver unpacks it into the positional call.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetTransactionSplitsWithLegs {
    /// `p_transaction_id`. The split parent.
    pub id: String,
    /// `p_user_id`. Absent means "name no owner"; see the update verb's note.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `p_splits`. The WHOLE line set, in display order.
    ///
    /// Raw JSON rather than a `Vec`, because the RPC's first refusal is
    /// *"p_splits must be a jsonb array"* and a `Vec` would turn that into a
    /// deserialiser error with a different name. A caller that sends a string
    /// gets told the same thing by both engines.
    #[serde(default)]
    pub splits: Option<serde_json::Value>,
    /// `p_expected_amount`. The client's own idea of the parent's amount; the
    /// lines must sum to it. Absent means "do not check", which is the cloud's
    /// `IS NOT NULL` guard and not an oversight.
    #[serde(default)]
    pub expected_amount: Option<Money>,
}

/// What the verb hands back.
///
/// `transaction` is the split PARENT. The RPC returns
/// `{is_split, split_count, amount, counterparts}` and no parent row, but the
/// harness compares the stored row field by field on both engines, so the
/// Postgres side projects the parent after the call and this side returns it.
/// The RPC's own four fields are here too, spelled the same way.
#[derive(Debug, Serialize)]
pub struct SetTransactionSplitsWithLegsResult {
    /// The split parent as stored after the write.
    pub transaction: TransactionRow,
    /// Always true: this writer never un-splits.
    pub is_split: bool,
    /// How many lines the split now holds.
    pub split_count: i64,
    /// Their sum, which is now the parent's amount.
    pub amount: Money,
    /// The line set as stored, in display order.
    pub splits: Vec<SplitRow>,
    /// The transactions minted for lines that became legs, in the order they
    /// were made — so the client updates its state, and those accounts'
    /// balances, from what the database wrote rather than what it hoped for.
    pub counterparts: Vec<TransactionRow>,
    /// Dense sequence number of the audit row written for the PARENT.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// The five keys a split line may carry. Anything else is a refusal.
///
/// The same DECLARED divergence the create and update verbs carry (D-7): the
/// cloud reads these five and silently discards the rest, and MEASURED, a line
/// with `memmo` instead of `memo` is accepted by the RPC with the memo dropped.
/// A misspelled `transfer_account_id` is worse than a lost memo — it stores an
/// ordinary line where the caller meant one half of a transfer, and says the
/// write succeeded.
const LINE_KEYS: [&str; 5] = ["id", "category", "amount", "memo", "transfer_account_id"];

/// Write a split whose lines may include transfer legs, mint the counterpart for
/// each line that becomes one, move every balance that implies, and audit all of
/// it — in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for any of the twenty named refusals or a constraint
/// the file enforced; [`CoreError::Storage`] for a fault.
// Consumed rather than borrowed, for the reason the other three verbs give: this
// mints rows, moves balances and writes audit entries, and `&command` is an
// invitation to do all of it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn set_transaction_splits_with_legs(
    connection: &mut Connection,
    command: SetTransactionSplitsWithLegs,
) -> CoreResult<SetTransactionSplitsWithLegsResult> {
    // ── 1, 2. Everything that can refuse without opening the file. ──────────
    let Some(serde_json::Value::Array(elements)) = command.splits.as_ref() else {
        return Err(CoreError::refuse(
            "splits_not_an_array",
            "p_splits must be a jsonb array",
        ));
    };
    if elements.len() < 2 {
        return Err(CoreError::refuse(
            "split_needs_two_lines",
            "a split needs at least 2 lines",
        ));
    }
    let described_count = i64::try_from(elements.len()).map_err(|_| {
        CoreError::refuse(
            "split_needs_two_lines",
            "that is more split lines than this ledger can count",
        )
    })?;

    let transaction = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // ── 3, 4. The parent, and the two things that disqualify it. ────────────
    let before = open_parent(&transaction, &command)?;

    // ── 5, 6. S-11 and S-10, both before a single byte is written. ──────────
    let incoming = incoming_ids(elements);
    let stored = split::read_lines(&transaction, &command.id)?;
    refuse_id_repeats(&incoming)?;
    refuse_removed_legs(&transaction, &incoming, &stored)?;

    // The cloud locks every account this write can move, in id order, so that
    // two concurrent split saves cannot deadlock (`:222-232`). SQLite has ONE
    // writer and `BEGIN IMMEDIATE` has already taken it, so the deadlock the
    // lock prevents cannot occur; there is nothing to port. Recorded rather than
    // silently dropped, because "the local port left out the locking" reads like
    // an omission until you know why it is not one.

    // Let this verb's own writes through the split guard. Released after the
    // parent write; a refusal anywhere in between rolls it back with everything
    // else, so a stray flag is impossible rather than merely unlikely.
    transaction.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('split')", [])?;

    // The lines this edit drops. Every leg was protected above.
    drop_unnamed_lines(&transaction, &command.id, &incoming, &stored)?;

    // ── 7-18. The line loop, in payload order. ──────────────────────────────
    let context = Context {
        parent: &before,
        stored: &stored,
        now: &now,
    };
    let mut written = Written::default();
    for (index, element) in elements.iter().enumerate() {
        let sort_order = i64::try_from(index.saturating_add(1)).map_err(|_| {
            CoreError::refuse(
                "split_needs_two_lines",
                "that is more split lines than this ledger can count",
            )
        })?;
        apply_line(&transaction, &context, element, sort_order, &mut written)?;
    }

    // ── 19, 20. S-1 as the caller stated it, then S-12 against storage. ─────
    verify_totals(
        &transaction,
        &command.id,
        command.expected_amount,
        described_count,
        written.sum,
    )?;

    // ── S-1 / S-4, then 21. ─────────────────────────────────────────────────
    let after = write_parent(&transaction, &before, written.sum, &now)?;
    let new_lines = split::read_lines(&transaction, &command.id)?;

    // U-4: a split is audited at its PARENT, with the whole line set embedded in
    // before and after — the house pattern set_transaction_splits established
    // and this writer keeps (`:477-483`).
    let before_json = with_lines(&before, &stored)?;
    let after_json = with_lines(&after, &new_lines)?;
    let entry = audit::write(
        &transaction,
        &after.user_id,
        "transaction",
        &command.id,
        Action::Update,
        Some(&before_json),
        Some(&after_json),
        &now,
    )?;

    transaction.commit()?;

    Ok(SetTransactionSplitsWithLegsResult {
        transaction: after,
        is_split: true,
        split_count: described_count,
        amount: Money::from_minor(written.sum),
        splits: new_lines,
        counterparts: written.counterparts,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// What the loop accumulates.
#[derive(Debug, Default)]
struct Written {
    /// Σ of the lines, in minor units.
    sum: i64,
    /// The rows minted for lines that became legs.
    counterparts: Vec<TransactionRow>,
}

/// What the loop needs to know that does not change between lines.
struct Context<'a> {
    parent: &'a TransactionRow,
    stored: &'a [SplitRow],
    now: &'a str,
}

/// The parent, past the ownership gate and past S-6.
///
/// The cloud does this as one `SELECT … FOR UPDATE` followed by `IF NOT FOUND`.
/// Locally it is a gate query and then a read, which is equivalent under
/// `BEGIN IMMEDIATE` — one writer, nothing can interleave — and necessary
/// anyway, because the audit's `before` has to be what storage held.
fn open_parent(
    transaction: &Transaction<'_>,
    command: &SetTransactionSplitsWithLegs,
) -> CoreResult<TransactionRow> {
    let owned: Option<i64> = transaction
        .query_row(
            "SELECT 1 FROM transactions
              WHERE id = ?1
                AND (?2 IS NULL OR user_id = ?2)",
            params![command.id, command.user_id],
            |record| record.get(0),
        )
        .optional()?;
    if owned.is_none() {
        // Deliberately the same refusal for "no such row" and "somebody else's
        // row": telling them apart confirms an id exists to a caller who may not
        // see it.
        return Err(CoreError::Refused(
            Refusal::named("transaction_not_found", "transaction_not_found")
                .with_hint("The transaction does not exist or does not belong to this user."),
        ));
    }

    let parent = row::read_transaction(transaction, &command.id)?;
    if parent.kind == "transfer" {
        return Err(CoreError::refuse(
            "transfer_cannot_be_split",
            "transfers cannot be split",
        ));
    }
    Ok(parent)
}

/// S-11, first half: two lines may not claim to be the same stored line.
///
/// If they could, the sum check would verify nothing — one stored line would be
/// written twice and counted twice, and the parent's amount would be a number no
/// line set supports.
fn refuse_id_repeats(incoming: &[String]) -> CoreResult<()> {
    let mut seen = std::collections::BTreeSet::new();
    for id in incoming {
        if !seen.insert(id.as_str()) {
            return Err(CoreError::refuse(
                "split_line_id_repeated",
                "split_line_id_repeated: two of these lines claim to be the same stored line — reload and look again",
            ));
        }
    }
    Ok(())
}

/// S-10: a stored leg that this edit does not name would be deleted, and its
/// counterpart left pointing at a line that no longer exists.
///
/// Named before anything is written, so the refusal costs nothing — and so that
/// the DELETE below can never reach a leg, which is what makes
/// `trg_protect_linked_leg_delete` unreachable and the `leg` guard unnecessary.
fn refuse_removed_legs(
    transaction: &Transaction<'_>,
    incoming: &[String],
    stored: &[SplitRow],
) -> CoreResult<()> {
    for line in stored {
        if line.linked_transfer_id.is_some() && !incoming.iter().any(|id| id == &line.id) {
            let name = account::name_or_another(transaction, line.transfer_account_id.as_deref())?;
            return Err(CoreError::refuse(
                "split_leg_line_removed",
                &format!(
                    "split_leg_line_removed: the line transferring to \"{name}\" is one half of a transfer — the transaction on the other side would be left pointing at a line that no longer exists. Delete that transfer first, then edit the split."
                ),
            ));
        }
    }
    Ok(())
}

/// The stored lines this edit does not name.
///
/// One statement per line rather than a `NOT IN (…)` list, because a list is the
/// one shape this crate does not build: an `IN` clause assembled from a `Vec` is
/// SQL by concatenation, and DESIGN.md §6.4 says there is none of that here. The
/// cost is one prepared statement executed at most once per stored line, on a
/// table indexed by its primary key.
fn drop_unnamed_lines(
    transaction: &Transaction<'_>,
    parent_id: &str,
    incoming: &[String],
    stored: &[SplitRow],
) -> CoreResult<()> {
    let mut delete = transaction.prepare(
        "DELETE FROM transaction_splits
          WHERE transaction_id = ?1
            AND id = ?2",
    )?;
    for line in stored {
        if !incoming.iter().any(|id| id == &line.id) {
            delete.execute(params![parent_id, line.id])?;
        }
    }
    Ok(())
}

/// The parent write, the guard release, and the balance move that may follow.
///
/// The three are one function because they are one decision: the parent's amount
/// becomes the sum of its lines (S-1), its own categorisation is blanked because
/// its lines carry it now (S-4), and if that changed the total then its account
/// moves by exactly the difference (B-2). Splitting them would let a future edit
/// do the first two and forget the third, which is a silent B-1 violation.
fn write_parent(
    transaction: &Transaction<'_>,
    before: &TransactionRow,
    sum: i64,
    now: &str,
) -> CoreResult<TransactionRow> {
    let changed = transaction.execute(
        "UPDATE transactions
            SET is_split = 1,
                category = '',
                amount_minor = ?1,
                updated_at = ?2
          WHERE id = ?3",
        params![sum, now, before.id],
    )?;
    if changed != 1 {
        return Err(CoreError::refuse(
            "transaction_not_found",
            "the split parent disappeared between finding it and writing it",
        ));
    }
    transaction.execute("DELETE FROM _rpc_guard WHERE flag = 'split'", [])?;

    let after = row::read_transaction(transaction, &before.id)?;
    if after.amount != before.amount {
        move_parent_balance(transaction, before, &after, now)?;
    }
    Ok(after)
}

/// S-1 against the caller's figure, then S-12 against storage.
///
/// The order is the RPC's and it matters: a caller whose arithmetic is wrong is
/// told so, and only a call that agrees with itself gets as far as asking
/// whether storage agrees too.
fn verify_totals(
    transaction: &Transaction<'_>,
    parent_id: &str,
    expected: Option<Money>,
    described_count: i64,
    sum: i64,
) -> CoreResult<()> {
    if let Some(expected) = expected {
        if sum != expected.minor() {
            return Err(CoreError::Refused(
                Refusal::named(
                    "split_total_mismatch",
                    &format!(
                        "split_total_mismatch: split lines sum to {} but the transaction amount is {expected}",
                        Money::from_minor(sum)
                    ),
                )
                .with_hint(
                    "A transfer line's amount is pinned by the transaction on its other side, so the remaining lines have to absorb the difference.",
                ),
            ));
        }
    }

    let (stored_count, stored_sum) = transaction.query_row(
        "SELECT COUNT(*), COALESCE(SUM(amount_minor), 0)
           FROM transaction_splits
          WHERE transaction_id = ?1",
        params![parent_id],
        |record| Ok((record.get::<_, i64>(0)?, record.get::<_, i64>(1)?)),
    )?;
    if stored_count != described_count || stored_sum != sum {
        return Err(CoreError::refuse(
            "split_write_inconsistent",
            &format!(
                "split_write_inconsistent: the split now holds {stored_count} line(s) totalling {}, but this edit described {described_count} line(s) totalling {} — nothing has been saved",
                Money::from_minor(stored_sum),
                Money::from_minor(sum)
            ),
        ));
    }
    Ok(())
}

/// `NULLIF(btrim(COALESCE(e.value->>'id','')),'')` for every element.
///
/// Ids are compared AS TEXT throughout, which is the cloud's own decision
/// (`:181-184`): a malformed id from a confused caller resolves to no row and
/// earns a sentence rather than a raw cast error. Locally the column is TEXT
/// anyway, so the two engines agree by construction rather than by effort.
fn incoming_ids(elements: &[serde_json::Value]) -> Vec<String> {
    elements
        .iter()
        .filter_map(|element| trimmed_or_none(field(element, "id")))
        .collect()
}

/// `e.value->>'k'` — a key of one line, or JSON null when the element is not an
/// object at all.
///
/// MEASURED: `('1'::jsonb)->>'id'` is NULL rather than an error, so the cloud
/// treats `[1, 2]` as two lines with no fields and refuses with *"every split
/// line needs a category"*. Reproduced exactly; inventing a "that is not an
/// object" refusal here would be a divergence for no gain.
fn field<'a>(element: &'a serde_json::Value, key: &str) -> &'a serde_json::Value {
    element.get(key).unwrap_or(&serde_json::Value::Null)
}

/// One line, once its every refusal has been considered.
///
/// Held apart from the writing half on purpose: [`resolve_line`] is the RPC's
/// twelve per-line refusals in the RPC's order and touches nothing, and
/// [`store_line`] is the three statements that follow. A reader checking the
/// order against the migration only has to read the first.
struct Resolved<'a> {
    category: String,
    amount: Money,
    memo: Option<String>,
    /// The account on the other side, already proved to exist, to be this user's
    /// and not to be the account the parent already sits in.
    target: Option<AccountRow>,
    /// The stored line this replaces, when the caller named one.
    previous: Option<&'a SplitRow>,
}

/// One line: validated in the RPC's order, then stored, then paired if it has
/// become a leg.
fn apply_line(
    transaction: &Transaction<'_>,
    context: &Context<'_>,
    element: &serde_json::Value,
    sort_order: i64,
    written: &mut Written,
) -> CoreResult<()> {
    let line = resolve_line(transaction, context, element)?;
    let id = store_line(transaction, context, &line, sort_order)?;

    // ── 18. A line that BECOMES a leg gets its other side made, here and now.
    // Only when it did not already point at that account: a re-save can never
    // mint a second counterpart for money that already has one, and an unlinked
    // line that still carries a target is a leg whose counterpart was deleted —
    // the matching sweep re-pairs those, and inventing a row here would
    // duplicate the movement.
    let already_linked = line
        .previous
        .is_some_and(|previous| previous.linked_transfer_id.is_some());
    let previous_target = line
        .previous
        .and_then(|previous| previous.transfer_account_id.as_deref());
    if let Some(target) = line.target.as_ref() {
        if !already_linked && previous_target != Some(target.id.as_str()) {
            let counterpart = mint_counterpart(
                transaction,
                context,
                target,
                &id,
                line.amount,
                line.memo.as_deref(),
            )?;
            written.counterparts.push(counterpart);
        }
    }

    written.sum = written.sum.checked_add(line.amount.minor()).ok_or_else(|| {
        CoreError::refuse(
            "amount_out_of_range",
            "these lines sum to more than this ledger can count in minor units",
        )
    })?;
    Ok(())
}

/// Refusals 7 to 17, in the order the reference cluster produces them.
fn resolve_line<'a>(
    transaction: &Transaction<'_>,
    context: &Context<'a>,
    element: &serde_json::Value,
) -> CoreResult<Resolved<'a>> {
    if let serde_json::Value::Object(object) = element {
        for key in object.keys() {
            if !LINE_KEYS.contains(&key.as_str()) {
                return Err(CoreError::Refused(Refusal::named(
                    "unknown_field",
                    &format!(
                        "unknown field `{key}` on a split line, expected one of `id`, `category`, `amount`, `memo`, `transfer_account_id`"
                    ),
                )));
            }
        }
    }

    // ── 7. ──────────────────────────────────────────────────────────────────
    let category = trimmed_text(field(element, "category"));
    if category.is_empty() {
        return Err(CoreError::refuse(
            "split_line_needs_a_category",
            "every split line needs a category",
        ));
    }

    // ── 8. `(v_split->>'amount')::numeric(20,2)`, and its two failures. ─────
    let amount = line_amount(field(element, "amount"))?;
    let Some(amount) = amount.filter(|money| *money != Money::ZERO) else {
        return Err(CoreError::refuse(
            "split_line_needs_an_amount",
            "every split line needs a non-zero amount",
        ));
    };

    let memo = trimmed_or_none(field(element, "memo"));

    // ── 9, 10. The account on the other side, when this line is a leg. ──────
    let target_text = trimmed_or_none(field(element, "transfer_account_id"));
    let mut target: Option<AccountRow> = None;
    if let Some(target_text) = target_text.as_deref() {
        let Some(found) = account::read_owned(transaction, target_text, &context.parent.user_id)?
        else {
            return Err(CoreError::Refused(
                Refusal::named(
                    Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                    Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                )
                .with_hint("A transfer line names an account that is not yours, or no longer exists."),
            ));
        };
        if found.id == context.parent.account_id {
            return Err(CoreError::Refused(
                Refusal::named(
                    "transfer_needs_two_accounts",
                    "a transfer needs two different accounts",
                )
                .with_hint("That line points back at the account this transaction is already in."),
            ));
        }
        target = Some(found);
    }
    let target_id = target.as_ref().map(|found| found.id.as_str());

    // ── 11, 12, 13. S-7 and S-8. ────────────────────────────────────────────
    let filing = read_filing(transaction, &category, &context.parent.user_id)?;
    let Some(filing) = filing else {
        return Err(CoreError::refuse(
            "unknown_category",
            &format!("unknown category: {category}"),
        ));
    };
    if filing.is_transfer_category {
        if target_id.is_none() {
            return Err(CoreError::refuse(
                "split_leg_not_declared",
                "split_leg_not_declared: that line is filed under a To/From account category but does not say which account is on the other side",
            ));
        }
        if filing.account_id.as_deref() != target_id {
            return Err(CoreError::refuse(
                "split_leg_category_mismatch",
                "split_leg_category_mismatch: that line is filed under one account's To/From category but transfers to a different account",
            ));
        }
    }
    // The converse is NOT required, and the RPC says why (`:297-301`): the MS
    // Money importer filed legs under the Unassigned bucket where the To/From
    // category was missing. Demanding one here would make exactly the splits
    // this writer exists to unblock uneditable again.

    // ── 14. S-11, second half: a named id must be a line of THIS split. ─────
    let incoming_id = trimmed_or_none(field(element, "id"));
    let previous = match incoming_id.as_deref() {
        None => None,
        Some(id) => {
            let Some(found) = context.stored.iter().find(|line| line.id == id) else {
                return Err(CoreError::refuse(
                    "split_line_not_found",
                    "split_line_not_found: one of these lines is not part of this split any more — reload and look again",
                ));
            };
            Some(found)
        }
    };

    // ── 15, 16, 17. S-9: pinned by the row on the other side. ───────────────
    if let Some(pinned) = previous.filter(|line| line.linked_transfer_id.is_some()) {
        refuse_a_pinned_leg_edit(transaction, pinned, amount, target_id, &category)?;
    }

    Ok(Resolved {
        category,
        amount,
        memo,
        target,
        previous,
    })
}

/// The three statements that follow, one per shape of line.
///
/// Returns the id of the line as stored — which is the caller's id when there
/// was one, and the whole point of this writer: *"Once a line has an id,
/// 'changed', 'added' and 'removed' are three different things"*
/// (`20260806094058:45-47`).
fn store_line(
    transaction: &Transaction<'_>,
    context: &Context<'_>,
    line: &Resolved<'_>,
    sort_order: i64,
) -> CoreResult<String> {
    let Resolved {
        category,
        amount,
        memo,
        target,
        previous,
    } = line;
    let target = target.as_ref().map(|account| account.id.as_str());

    let previous = *previous;
    Ok(if let Some(pinned) = previous.filter(|line| line.linked_transfer_id.is_some()) {
        // Position and memo are not structural, so they may move. Note what is
        // NOT in this SET list: every column trg_protect_linked_leg watches.
        let changed = transaction.execute(
            "UPDATE transaction_splits
                SET memo = ?1,
                    sort_order = ?2,
                    updated_at = ?3
              WHERE id = ?4",
            params![memo, sort_order, context.now, pinned.id],
        )?;
        assert_one_line(changed)?;
        pinned.id.clone()
    } else if let Some(ordinary) = previous {
        // ── An ordinary stored line: free to change. ────────────────────────
        let changed = transaction.execute(
            "UPDATE transaction_splits
                SET category = ?1,
                    amount_minor = ?2,
                    memo = ?3,
                    sort_order = ?4,
                    transfer_account_id = ?5,
                    updated_at = ?6
              WHERE id = ?7",
            params![
                category,
                amount.minor(),
                memo,
                sort_order,
                target,
                context.now,
                ordinary.id
            ],
        )?;
        assert_one_line(changed)?;
        ordinary.id.clone()
    } else {
        // ── A new line. ─────────────────────────────────────────────────────
        let id = uuid::Uuid::new_v4().to_string();
        transaction.execute(
            "INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, memo, sort_order,
                transfer_account_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![
                id,
                context.parent.id,
                context.parent.user_id,
                category,
                amount.minor(),
                memo,
                sort_order,
                target,
                context.now
            ],
        )?;
        id
    })
}

/// S-9's three refusals, in the RPC's order: amount, then target, then category.
fn refuse_a_pinned_leg_edit(
    transaction: &Transaction<'_>,
    pinned: &SplitRow,
    amount: Money,
    target: Option<&str>,
    category: &str,
) -> CoreResult<()> {
    if amount != pinned.amount {
        let name = account::name_or_another(transaction, pinned.transfer_account_id.as_deref())?;
        return Err(CoreError::refuse(
            "split_leg_amount_locked",
            &format!(
                "split_leg_amount_locked: the line transferring to \"{name}\" has to stay {}, because the transaction on the other side is for exactly that much — change the other lines, or delete that transfer first.",
                pinned.amount
            ),
        ));
    }
    if target != pinned.transfer_account_id.as_deref() {
        let name = account::name_or_another(transaction, pinned.transfer_account_id.as_deref())?;
        return Err(CoreError::refuse(
            "split_leg_target_locked",
            &format!(
                "split_leg_target_locked: that line is already linked to a transaction in \"{name}\" — moving it would strand that row. Delete that transfer first, then edit the split."
            ),
        ));
    }
    if category != pinned.category {
        return Err(CoreError::refuse(
            "split_leg_category_locked",
            "split_leg_category_locked: that line is one half of a transfer — its category names the account on the other side. Delete that transfer first, then re-file it.",
        ));
    }
    Ok(())
}

/// The other side of a leg: a real row in another account's register, the exact
/// opposite of the LINE, and the balance move that follows from it.
fn mint_counterpart(
    transaction: &Transaction<'_>,
    context: &Context<'_>,
    target: &AccountRow,
    line_id: &str,
    line_amount: Money,
    memo: Option<&str>,
) -> CoreResult<TransactionRow> {
    // T-9. The counterpart is −amount with no conversion, so both accounts must
    // share a currency. The source account is looked up rather than assumed:
    // when it is not this user's the cloud SKIPS the check rather than refusing
    // (`IF FOUND AND …`), and a split parent filed against somebody else's
    // account is a pairing neither schema forbids.
    let source = account::read_owned(transaction, &context.parent.account_id, &context.parent.user_id)?;
    if let Some(source) = source {
        // Locally `accounts.currency` is NOT NULL, so the cloud's "a NULL
        // currency is unspecified and never blocks" branch is unreachable here.
        // The empty-string test keeps the shape rather than the accident.
        if !source.currency.is_empty()
            && !target.currency.is_empty()
            && source.currency != target.currency
        {
            return Err(CoreError::refuse(
                "transfer_currency_mismatch",
                &format!(
                    "Transfers between accounts in different currencies are not supported yet ({} and {})",
                    source.currency, target.currency
                ),
            ));
        }
    }

    let amount = line_amount.minor().checked_neg().map(Money::from_minor).ok_or_else(|| {
        CoreError::refuse(
            "amount_out_of_range",
            "that line has no negation in minor units",
        )
    })?;

    // T-6. Each side files under the OTHER account's To/From category, so the
    // counterpart — which sits in the target account — is filed under the
    // parent's account's one.
    let category = transfer_category_for(
        transaction,
        &context.parent.user_id,
        &context.parent.account_id,
        amount,
    )?;

    let id = uuid::Uuid::new_v4().to_string();
    transaction.execute(
        "INSERT INTO transactions
           (id, user_id, account_id, description, amount_minor, type, date, category,
            notes, transfer_account_id, linked_transfer_id, linked_transfer_split_id,
            is_cleared, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'transfer', ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?12)",
        params![
            id,
            context.parent.user_id,
            target.id,
            context.parent.description,
            amount.minor(),
            context.parent.date,
            category,
            memo.map_or_else(|| context.parent.notes.clone(), |memo| Some(memo.to_owned())),
            context.parent.account_id,
            context.parent.id,
            line_id,
            context.now
        ],
    )?;

    // The pair is navigable from either end: the row names the exact line, and
    // the line names the row (T-11).
    let linked = transaction.execute(
        "UPDATE transaction_splits
            SET linked_transfer_id = ?1,
                updated_at = ?2
          WHERE id = ?3",
        params![id, context.now, line_id],
    )?;
    assert_one_line(linked)?;

    // B-2. The new row moves the target account's ledger balance.
    let moved = transaction.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![amount.minor(), context.now, target.id, context.parent.user_id],
    )?;
    if moved != 1 {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    }
    let target_after = account::read_owned(transaction, &target.id, &context.parent.user_id)?;

    let counterpart = row::read_transaction(transaction, &id)?;
    audit::write(
        transaction,
        &context.parent.user_id,
        "transaction",
        &id,
        Action::Create,
        None,
        Some(&json_of(&counterpart)?),
        context.now,
    )?;
    if let Some(target_after) = target_after {
        audit::write(
            transaction,
            &context.parent.user_id,
            "account",
            &target.id,
            Action::Update,
            Some(&json_of(target)?),
            Some(&json_of(&target_after)?),
            context.now,
        )?;
    }

    Ok(counterpart)
}

/// B-2 for the parent's own account: `balance = balance + (new − old)`.
fn move_parent_balance(
    transaction: &Transaction<'_>,
    before: &TransactionRow,
    after: &TransactionRow,
    now: &str,
) -> CoreResult<()> {
    let not_ours = || {
        CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        )
    };

    let account_before = account::read_owned(transaction, &after.account_id, &after.user_id)?
        .ok_or_else(not_ours)?;

    // Arithmetic on the transaction's own two amounts — never on a balance.
    let delta = after
        .amount
        .minor()
        .checked_sub(before.amount.minor())
        .ok_or_else(|| {
            CoreError::refuse(
                "amount_out_of_range",
                "the difference between the old and new totals does not fit in minor units",
            )
        })?;

    let moved = transaction.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![delta, now, after.account_id, after.user_id],
    )?;
    if moved != 1 {
        return Err(not_ours());
    }

    let account_after = account::read_owned(transaction, &after.account_id, &after.user_id)?
        .ok_or_else(not_ours)?;
    audit::write(
        transaction,
        &after.user_id,
        "account",
        &after.account_id,
        Action::Update,
        Some(&json_of(&account_before)?),
        Some(&json_of(&account_after)?),
        now,
    )?;
    Ok(())
}

/// `(v_split->>'amount')::numeric(20,2)`, with this edition's one money rule on
/// top of it.
///
/// The cast is reproduced rather than the type: `->>` hands Postgres text, so
/// `"amount": ""` reaches the cast and fails there, which is why an empty string
/// is a refusal on both engines rather than a missing key on one.
///
/// The DECLARED divergence is the JSON number. Postgres accepts `-15` and
/// `-12.345` (rounding the second to `-12.35` and saying nothing); this refuses
/// both, under `amount_must_be_a_string` and `amount_not_representable`. That is
/// [`Money`]'s crate-wide rule and the whole reason the type exists — see its
/// module documentation, and
/// `verb-specs/money1-a-sub-penny-amount-is-rounded-by-postgres-and-refused-locally.spec.mjs`,
/// which pins the same disagreement on the create verb.
fn line_amount(value: &serde_json::Value) -> CoreResult<Option<Money>> {
    match value {
        serde_json::Value::Null => Ok(None),
        serde_json::Value::Number(_) => Err(CoreError::refuse(
            "amount_must_be_a_string",
            "money may not be a JSON number — a JSON number is a binary float and cannot hold a decimal amount exactly. Send \"-12.34\".",
        )),
        other => {
            let text = as_text(other).unwrap_or_default();
            Money::parse(&text)
                .map(Some)
                .map_err(|error| CoreError::refuse(error.code(), &format!("{error}: {text:?}")))
        }
    }
}

/// Every UPDATE of a stored line touches exactly one row. Zero would mean the
/// line went between finding it and writing it, which SQLite reports by saying
/// nothing at all.
fn assert_one_line(changed: usize) -> CoreResult<()> {
    if changed == 1 {
        return Ok(());
    }
    Err(CoreError::refuse(
        "split_line_not_found",
        "a split line disappeared between finding it and writing it",
    ))
}

/// A transaction row with its line set embedded, which is what the cloud's
/// `to_jsonb(v_old) || jsonb_build_object('splits', …)` produces.
fn with_lines(transaction: &TransactionRow, lines: &[SplitRow]) -> CoreResult<String> {
    let mut value = serde_json::to_value(transaction)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;
    let lines = serde_json::to_value(lines)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;
    if let serde_json::Value::Object(object) = &mut value {
        object.insert("splits".to_owned(), lines);
    }
    Ok(value.to_string())
}

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{incoming_ids, line_amount, SetTransactionSplitsWithLegs};
    use crate::money::Money;

    #[test]
    fn incoming_ids_are_trimmed_and_blank_ones_are_not_ids() {
        let elements = vec![
            serde_json::json!({ "id": " a " }),
            serde_json::json!({ "id": "   " }),
            serde_json::json!({ "id": null }),
            serde_json::json!({}),
            serde_json::json!({ "id": "b" }),
            serde_json::json!(7),
        ];
        assert_eq!(incoming_ids(&elements), vec!["a".to_owned(), "b".to_owned()]);
    }

    #[test]
    fn an_amount_is_text_or_nothing_and_never_a_json_number() {
        assert_eq!(
            line_amount(&serde_json::json!("-15.00")).unwrap(),
            Some(Money::from_minor(-1500))
        );
        assert_eq!(line_amount(&serde_json::json!(null)).unwrap(), None);

        let error = line_amount(&serde_json::json!(-15)).unwrap_err();
        assert_eq!(error.code(), "amount_must_be_a_string");

        // Postgres rounds this to -12.35 and says nothing. See the module docs.
        let error = line_amount(&serde_json::json!("-12.345")).unwrap_err();
        assert_eq!(error.code(), "amount_not_representable");

        // The empty string reaches Postgres's numeric cast and fails there too.
        let error = line_amount(&serde_json::json!("")).unwrap_err();
        assert_eq!(error.code(), "amount_malformed");
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<SetTransactionSplitsWithLegs>(
            r#"{"id":"x","splits":[],"expcted_amount":"1.00"}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("expcted_amount"), "{error}");
    }

    #[test]
    fn splits_may_be_anything_at_all_so_the_verb_can_name_the_refusal() {
        // A `Vec` here would make "p_splits must be a jsonb array" a
        // deserialiser error with a different name on each engine.
        let command: SetTransactionSplitsWithLegs =
            serde_json::from_str(r#"{"id":"x","splits":"nope"}"#).expect("a string is accepted");
        assert!(command.splits.is_some());
    }
}
