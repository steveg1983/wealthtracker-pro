//! `archive_transactions_before` — hide an account's settled history, by date.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260810200000_marking_is_not_reconciling.sql:290-329`,
//! which is the LIVE definition and is byte-for-byte
//! `20260721130000_soft_archive.sql:47-86` except for ONE predicate: the rows it
//! flags are the RECONCILED ones, and "reconciled" now means committed. The
//! client calls it at one place (`transactionService.archiveTransactionsBefore`),
//! from the Archive manager.
//!
//! # `COALESCE(is_reconciled, is_cleared) = true`, AND WHY THE COALESCE STAYS
//!
//! The predicate reads the committed state with the pre-split fallback, which is
//! `src/utils/transactionReconciliation.ts`'s `isReconciled` written in SQL. The
//! migration's own sentence: *"what this archives today is exactly what it would
//! have archived yesterday"* — a row written before the split carries NULL, and
//! NULL is judged by `is_cleared`, which is what the archive was judging it by
//! the day before the column existed.
//!
//! So three states, three answers:
//!
//! | `is_reconciled` | archived by this verb? |
//! | --- | --- |
//! | `1` | yes, if it is old enough |
//! | `0` | **no** — marked but not committed is work in progress, and it stays in the register where it can still be unmarked |
//! | NULL | ask `is_cleared`: pre-split history, judged as it always was |
//!
//! The middle row is the behaviour change this verb inherits from the split, and
//! it is the one worth reading twice: an account whose whole statement has been
//! ticked but never finished archives NOTHING, which is correct — nothing about
//! it has been settled.
//!
//! # IT AUDITS NOTHING, AND THAT IS THE RPC'S SHAPE RATHER THAN AN OMISSION
//!
//! There is no `write_financial_audit` anywhere in the cloud function, and none
//! here. The asymmetry with [`super::set_transactions_archived`] — the per-row
//! archive, which audits every row it touches — is the CLOUD's, and the port
//! reproduces it rather than tidying it: these two verbs are ports of RPCs, so
//! the RPC is the specification, and a local edition that wrote an audit trail
//! the cloud does not would make `auditShape` diverge on every archive and hide
//! the difference that matters. Recorded here so the next reader can see it was
//! traced rather than forgotten. (Contrast the account, category, planning and
//! dismissal families, where there is NO RPC and the audit decision is genuinely
//! the port's to make — [`crate::verbs`] carries those four tables.)
//!
//! # Balance-neutral, and the seeded register total that depends on it
//!
//! `archived` and `updated_at` on the rows, `archive_through_date` and
//! `updated_at` on the account. Nothing else. The register seeds its running
//! balance from the sum of the rows it is HIDING, so an archive that moved a
//! balance would be double-counted on the very screen it was meant to tidy.
//!
//! # Investments are refused, in v1
//!
//! `IF v_acct.type = 'investment' THEN RAISE`. The soft-archive migration's
//! reason: *"their transfers/cost-basis want special handling"*. Ported with the
//! cloud's own sentence so both engines refuse with the same words.
//!
//! # The account is stamped even when nothing was old enough
//!
//! Both UPDATEs always run: the cutoff is recorded whether or not any row met
//! it, because the cutoff is a statement about the ACCOUNT ("everything before
//! this is archived") and the sweep in `schema.sql` reads it afterwards. An
//! account with a cutoff and no archived rows is the normal state of an account
//! whose old rows are not reconciled yet, and A-3 is what fills it in later, one
//! row at a time, as each is committed.
//!
//! # Which guard it holds: none, and measured
//!
//! `archived`/`updated_at` on transactions and `archive_through_date`/
//! `updated_at` on the account. No split protection watches any of them; C-4
//! watches `name` and `is_active`; the reconcile sweep watches `is_reconciled`,
//! which this verb reads and never writes.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::account::{self, ListedAccount};

/// The command: `(p_user_id, p_account_id, p_cutoff)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArchiveTransactionsBefore {
    /// `p_user_id`. As [`super::finalize_reconciliation`]: no owner, no account.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `p_account_id`. Whose history is being tidied.
    pub account_id: String,
    /// `p_cutoff`. Everything on or before this day, `YYYY-MM-DD`.
    pub cutoff: String,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct ArchiveTransactionsBeforeResult {
    /// The projection both engines are compared on — the RPC's own
    /// `jsonb_build_object`, key for key.
    pub answer: ArchiveAnswer,
    /// The account as stored afterwards. Local, and beside the answer rather
    /// than in it: the cloud function returns no account, and a key one engine
    /// has is a key the differential runner reports as a divergence.
    pub account: ListedAccount,
}

/// The RPC's return value.
#[derive(Debug, Serialize)]
pub struct ArchiveAnswer {
    /// How many rows were hidden by this call.
    pub archived: i64,
    /// The cutoff now recorded on the account.
    pub cutoff: String,
}

/// Archive an account's committed history up to and including a cutoff.
///
/// # Errors
/// [`CoreError::Refused`] for `account_not_found`, for an investment account and
/// for a cutoff that is not a calendar day; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn archive_transactions_before(
    connection: &mut Connection,
    command: ArchiveTransactionsBefore,
) -> CoreResult<ArchiveTransactionsBeforeResult> {
    // Before the transaction, and before the account is even looked for:
    // Postgres casts `p_cutoff` to `date` at call time, so an impossible day is
    // refused there before the function body runs. `LIKE '____-__-__'` would
    // store 31 February, so the day is judged here instead — D-8, and the same
    // local strengthening `create_transaction` applies to `date`.
    let Some(cutoff) = super::create_account::calendar_day(&command.cutoff, "cutoff")? else {
        return Err(CoreError::Refused(
            Refusal::named(
                "date_invalid",
                "cutoff must be a real calendar date as YYYY-MM-DD",
            )
            .with_hint("An archive with no cutoff would be an archive of everything."),
        ));
    };

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // `SELECT * INTO v_acct … WHERE id = p_account_id AND user_id = p_user_id;
    //  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found'` — and the name is
    // the RPC's own, which is NOT the `account_not_found_or_not_owned` the
    // transaction RPCs raise. Two names for one shape of failure is the cloud's
    // inconsistency; a port that unified them would refuse with a word no cloud
    // caller has ever seen.
    let owner = command.user_id.as_deref().ok_or_else(not_found)?;
    let before = account::read_listed(&write, &command.account_id, owner)?.ok_or_else(not_found)?;

    if before.kind == "investment" {
        return Err(CoreError::refuse(
            "investment_cannot_be_archived",
            "investment accounts cannot be archived yet",
        ));
    }

    let archived = write.execute(
        // COALESCE(is_reconciled, is_cleared) = true — see the module docs. The
        // date comparison is a TEXT one, which is exactly a date comparison for
        // 'YYYY-MM-DD': the shape CHECK on the column is what makes that true.
        "UPDATE transactions
            SET archived   = 1,
                updated_at = ?1
          WHERE user_id = ?2
            AND account_id = ?3
            AND COALESCE(is_reconciled, is_cleared) = 1
            AND archived = 0
            AND date <= ?4",
        params![now, before.user_id, command.account_id, cutoff],
    )?;

    let stamped = write.execute(
        "UPDATE accounts
            SET archive_through_date = ?1,
                updated_at           = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![cutoff, now, command.account_id, before.user_id],
    )?;
    if stamped != 1 {
        return Err(CoreError::refuse(
            "account_not_found",
            "the account disappeared between finding it and recording the cutoff",
        ));
    }

    let after = account::read_listed(&write, &command.account_id, &before.user_id)?
        .ok_or_else(not_found)?;

    let count = super::count(archived)?;

    write.commit()?;

    Ok(ArchiveTransactionsBeforeResult {
        answer: ArchiveAnswer {
            archived: count,
            cutoff,
        },
        account: after,
    })
}

fn not_found() -> CoreError {
    CoreError::Refused(
        Refusal::named("account_not_found", "account_not_found")
            .with_hint("The account does not exist or does not belong to this user."),
    )
}
