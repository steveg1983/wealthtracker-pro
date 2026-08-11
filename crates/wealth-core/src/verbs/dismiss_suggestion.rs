//! `dismiss_suggestion` — "stop offering me this", recorded once however many
//! times it is said.
//!
//! # What it is a port OF
//!
//! `SuggestionDismissalService.dismiss` (`:88-118`), which is a PostgREST insert
//! and no RPC at all — PHASE3-PLAN D-2, so the TypeScript writer is the oracle
//! and `lib/verb-postgres.mjs` transcribes it key for key:
//!
//! ```text
//! .from('suggestion_dismissals')
//! .insert({ user_id, kind, subject_key: subjectKey, subject_ids: subjectIds })
//! .select('id, kind, subject_key, subject_ids, dismissed_at')
//! .single()
//! ```
//!
//! Four keys go in. `id` and `dismissed_at` are NOT among them: both are column
//! defaults there (`gen_random_uuid()`, `now()`), and the row comes back with
//! whatever the table decided. That is the shape this verb keeps.
//!
//! # THE IDEMPOTENCE IS "FIRST WINS", AND THAT IS NOT THE SAME AS AN UPSERT
//!
//! The cloud inserts, and on `23505` — `suggestion_dismissals_unique_subject
//! UNIQUE (user_id, kind, subject_key)` — it *finds the existing row and returns
//! it*. It does not update it. So dismissing the same subject twice with a
//! DIFFERENT list of subject ids answers with the FIRST list, and `dismissed_at`
//! goes on meaning *when you first said no* — which the migration says in as many
//! words (`20260806180000:127-128`).
//!
//! An `ON CONFLICT DO UPDATE` would have been the easy local shape and it would
//! be a different feature: the second refusal would move the date and rewrite the
//! subjects. The seam asks for the cloud's rule by name — *"refusing something
//! already refused returns the existing record"* — and `contract.ts` proves it by
//! comparing the two answers' `id`.
//!
//! **The pre-check replaces the catch, and only because the transaction makes it
//! safe.** This verb reads for the existing row BEFORE inserting rather than
//! inserting and catching the violation. In the cloud that ordering would be a
//! race (two devices, two round trips, and the loser must still not see an
//! error); here the whole verb is one `IMMEDIATE` SQLite transaction, so no other
//! writer can arrive between the read and the insert and the two orderings cannot
//! be told apart from outside. What must not drift is the OUTCOME, and that is
//! what the specs compare: same id, one row, the first subjects, the first date.
//!
//! # The subjects: an array there, a child table here
//!
//! `subject_ids` is `uuid[]` in the cloud and `suggestion_dismissal_subjects`
//! locally, and `role_order` carries what the array's positions carried — for a
//! transfer pair, which row was the out and which the in. This verb writes the
//! caller's list in the caller's order, `role_order` = position, and
//! [`crate::row::dismissal`] reads it back the same way.
//!
//! ## DIVERGENCE: here they are a foreign key, there they are a promise
//!
//! `suggestion_dismissal_subjects.transaction_id REFERENCES transactions(id)`.
//! The cloud's column comment claims every id *"can be resolved in exactly one
//! table"* and nothing enforces it; `schema.sql` turns the claim into a
//! constraint and argues that is the better shape. The consequence is a real
//! difference and it is declared rather than smoothed over: a dismissal naming a
//! transaction that does not exist is REFUSED here and accepted there.
//!
//! It costs nothing a user can reach. A sweep makes an offer about rows it has
//! just read, so the ids always exist at the moment of refusing; and the prune
//! trigger's whole job is that they cannot stop existing while the dismissal
//! stays. What it buys is that the local file cannot accumulate the junk the
//! cloud's trigger exists to clean up.
//!
//! # The three payee kinds, and the CHECK slice 23 widened
//!
//! Payee cleanup dismisses `payee-merchant`, `payee-line` and `payee-hidden`
//! through this same door, and those rows have NO subjects at all — their
//! `subject_key` is percent-encoded payee text, not ids. `schema.sql`'s CHECK
//! admitted four kinds until this slice and would have refused all three; the
//! reason it is widened here, rather than recorded for a third time, is in the
//! schema beside the constraint.
//!
//! # IT DOES NOT AUDIT, AND THAT IS THE CLOUD'S REASON RATHER THAN AN OMISSION
//!
//! Divergence 10 ([`super::create_budget`]) made this crate audit two tables the
//! cloud audits nowhere. It does not extend here, and the difference is not that
//! dismissals are less important — it is that the trail answers a question a
//! dismissal is not part of. `20260806180000:75-79`:
//!
//! > `financial_audit_log` answers "what happened to this money, and who did it".
//! > A dismissal touches no money: no amount, no sign, no account, no category,
//! > no link. Writing it into the financial audit trail would dilute the artifact
//! > that compliance actually depends on.
//!
//! Divergence 10's argument was that MONEY LIVES IN FOUR COLUMNS of `budgets`
//! and `goals` and the cloud audits neither; there is no such column here, on
//! either engine, and a table that cannot hold a figure cannot have one changed.
//! So both engines agree, and U-1 — *the write cannot succeed without its audit
//! entry* — is a rule about audited operations and simply does not apply. The
//! absence is ASSERTED rather than assumed: the specs measure the trail across a
//! dismiss and require it untouched on both engines.
//!
//! # No guard, measured
//!
//! An INSERT into `suggestion_dismissals` and one per subject into its child.
//! Neither table has a trigger that writes (`trg_dismissals_no_update` fires on
//! UPDATE, which this verb never does; `trg_prune_suggestion_dismissals` is
//! `BEFORE DELETE ON transactions`). `tests/dismissal_writes.rs` asserts the guard
//! table empty across a dismiss.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::row::dismissal::{self, DismissalRow};
use crate::wire::null_if_empty;

/// The command: the four keys the cloud's `.insert({…})` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DismissSuggestion {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// Which sort of offer is being refused — one of the seven
    /// `suggestion_dismissals_kind_known` admits. Enumerated by CHECK in both
    /// engines, so the FILE judges it and this verb does not hold a second copy
    /// of the list.
    pub kind: String,
    /// The canonical identity of the refused suggestion: sorted ids joined with
    /// `|` for the sweep's four kinds, role-tagged percent-encoded payee text for
    /// Payee cleanup's three. Blank is refused by CHECK on both engines.
    pub subject_key: String,
    /// The transactions the offer was about, IN ROLE ORDER. Empty for the payee
    /// kinds, and empty is a legitimate answer rather than a missing one.
    #[serde(default)]
    pub subject_ids: Vec<String>,
    /// Client-minted, or minted here when absent — B-5. The column is
    /// `uuid DEFAULT gen_random_uuid()` in the cloud and TEXT with no default
    /// here, so the mint has to happen somewhere; the differential harness also
    /// needs to name the same row on both engines.
    #[serde(default)]
    pub id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DismissSuggestionResult {
    /// The dismissal as stored — the same five-key projection `list_suggestion_
    /// dismissals` answers with, because the cloud's `.select()` here names the
    /// same five and its caller puts the answer straight into state.
    pub answer: DismissalRow,
    /// Whether this call is what created it. `false` says the refusal was already
    /// on record and the answer is the EXISTING one.
    ///
    /// OUTSIDE `answer`, deliberately, and that is what makes it safe to have:
    /// the differential harness compares `answer` field by field, so a key the
    /// cloud's `.select()` has no counterpart for would be reported as a
    /// divergence in every spec that used it. The cloud's caller cannot tell the
    /// two cases apart and does not need to; the seam does not carry it either.
    ///
    /// It is here for `tests/dismissal_writes.rs`, which is where "answered with
    /// the existing row" and "wrote a second row and got lucky" have to be told
    /// apart directly rather than inferred. The DIFFERENTIAL proof of the same
    /// rule needs no extra field: a second dismiss sends a DIFFERENT id in its
    /// payload and both engines must still answer with the FIRST one.
    pub recorded: bool,
}

/// Record a refusal, once.
///
/// # Errors
/// [`CoreError::Refused`] when a subject id names no transaction, when `kind` is
/// not one the CHECK admits, when `subject_key` is blank, or when the owner does
/// not exist; [`CoreError::Storage`] for a fault.
// Consumed rather than borrowed: it writes, and `&command` is an invitation to
// do it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn dismiss_suggestion(
    connection: &mut Connection,
    command: DismissSuggestion,
) -> CoreResult<DismissSuggestionResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;

    // FIRST WINS. The existing row is answered with whole — its own id, its own
    // date, its own subjects — and nothing is written. See the module docs for
    // why this is a read rather than the cloud's caught violation.
    if let Some(existing) =
        dismissal::find_by_subject(&write, Some(&command.user_id), &command.kind, &command.subject_key)?
    {
        write.commit()?;
        return Ok(DismissSuggestionResult {
            answer: existing,
            recorded: false,
        });
    }

    // `dismissed_at` is NOT named: the column's default is the instant on both
    // engines, and a literal written here would be one edit away from being
    // written over a figure the table had already decided.
    let id = super::minted_uuid(command.id.as_deref());
    write.execute(
        "INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key)
              VALUES (?1, ?2, ?3, ?4)",
        params![id, command.user_id, command.kind, command.subject_key],
    )?;

    // Position IS the role, so the index is `role_order` and the list is stored
    // in the order it arrived — never sorted, never de-duplicated.
    let mut subject = write.prepare(
        "INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order)
              VALUES (?1, ?2, ?3)",
    )?;
    for (position, transaction_id) in command.subject_ids.iter().enumerate() {
        let named = null_if_empty(Some(transaction_id.as_str())).ok_or_else(|| {
            CoreError::refuse(
                "transaction_not_found",
                "a refusal cannot be about a row with no id",
            )
        })?;
        subject.execute(params![id, named, super::count(position)?])?;
    }
    drop(subject);

    // Read back rather than assembled: the row the caller receives is the row the
    // FILE holds, including the `dismissed_at` only the column knows.
    let stored =
        dismissal::find_by_subject(&write, Some(&command.user_id), &command.kind, &command.subject_key)?
            .ok_or_else(|| {
                // The cloud's own sentence for this case, verbatim
                // (`suggestionDismissalService.ts:115`) — seam rule 4 makes a
                // refusal's message the words on the screen, and this is one of
                // the few the cloud already has prose for. Unreachable inside a
                // transaction that just inserted the row; named rather than
                // unwrapped, because this crate does not panic on data.
                CoreError::refuse(
                    "dismissal_not_found",
                    "This refusal was saved but could not be read back — reload and check.",
                )
            })?;

    write.commit()?;

    Ok(DismissSuggestionResult {
        answer: stored,
        recorded: true,
    })
}
