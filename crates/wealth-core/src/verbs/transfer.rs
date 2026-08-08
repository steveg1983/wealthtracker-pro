//! The refusals four transfer verbs share, defined once.
//!
//! # Why this file exists, and what it deliberately does NOT change
//!
//! `repair_claimed_transfer`'s migration is explicit that its guards are
//! duplicated source (`20260805145035:252-255`):
//!
//! > The invariants below are copied **VERBATIM** from `link_transfer_pair`
//! > (`20260716100000`) and must be kept in step with it.
//!
//! `link_split_line_transfer` copies the same block a third time
//! (`20260806094058:519-522`, *"The invariants below are copied from it, with the
//! amounts compared against the LINE"*), and `create_transfer_counterpart` a
//! fourth. Four copies of one sentence in one schema is a maintenance hazard the
//! cloud accepted because plpgsql gives it nowhere better to put them.
//!
//! Locally there is somewhere better, so the *strings* live here once. What does
//! **not** live here is the *conditions*: each verb applies them to different
//! rows, in a different order, and against a different pair of amounts — the
//! split-line verb compares the row against the LINE, never the parent (T-10),
//! which is the single most-likely-to-be-mis-ported rule in the schema. Sharing
//! the conditions would be how that gets lost. So this module is a message table
//! and one predicate, and every verb still spells out what it is testing.
//!
//! # The machine codes
//!
//! The cloud raises these with a bare message and an SQLSTATE. `error.rs`
//! explains why a local refusal carries a name as well: the differential harness
//! matches on the name, and *"it errored" is not a proof that the right rule
//! fired*. So each refusal below is `code` + the cloud's message, character for
//! character, with the `%` substitutions filled in exactly as `RAISE` fills them.

use crate::error::{CoreError, Refusal};
use crate::money::Money;

/// `p_id_a = p_id_b`, and its two cousins in the split-line and repair verbs.
///
/// `20260716100000:80-82`, `20260806094058:555-557`.
pub fn self_link() -> CoreError {
    CoreError::refuse(
        "transfer_self_link",
        "a transaction cannot be linked to itself",
    )
}

/// T-4. `20260716100000:102-104`, `20260805145035:320-322`.
///
/// Degenerate under RLS and kept anyway, for the reason DESIGN.md gives: a
/// restored cloud backup can carry rows of more than one owner, and this is the
/// only thing that notices.
pub fn different_users() -> CoreError {
    CoreError::refuse(
        "transfer_different_users",
        "transactions belong to different users",
    )
}

/// T-2. `20260716100000:105-107` and three copies of it.
///
/// Locally this is *also* a CHECK (`transactions_transfer_two_accounts`), so the
/// file would refuse the write even if a verb forgot. The verb still checks,
/// because a named refusal in the RPC's own order is what the caller is promised
/// and `constraint_violated` is not it.
pub fn needs_two_accounts() -> CoreError {
    CoreError::Refused(
        Refusal::named(
            "transfer_needs_two_accounts",
            "a transfer needs two different accounts",
        )
        .with_hint("Both sides of a transfer would be in the same account."),
    )
}

/// T-1, worded as the cloud words it — with both figures, in the cloud's order.
///
/// The order of the two arguments is part of the message and differs per verb:
/// `link_transfer_pair` prints `(a, b)`, `repair_claimed_transfer` prints
/// `(counterpart, stranded)` and `link_split_line_transfer` prints
/// `(row, LINE)`. Passing them the wrong way round would still refuse the right
/// call and still show the user a wrong sentence.
pub fn amounts_not_opposite(first: Money, second: Money) -> CoreError {
    CoreError::refuse(
        "transfer_amounts_not_opposite",
        &format!(
            "transfer sides must have exactly opposite non-zero amounts ({first} vs {second})"
        ),
    )
}

/// T-1 as a predicate: `v_x.amount = 0 OR v_x.amount <> -v_y.amount`, inverted.
///
/// The zero test is on the **first** argument in all four call sites, and it is
/// not redundant with the negation test: `0 <> -0` is false, so without it two
/// zero-amount rows would pair happily and the ledger would gain a transfer that
/// moves nothing (MEASURED: `ltp-both-zero` refuses on the cloud, which is what
/// tells you the zero test is doing the work).
///
/// Negation is `checked_neg`, so `i64::MIN` — which has no positive counterpart
/// — reports "not opposite" rather than panicking. It cannot be stored anyway
/// (`transactions_amount_bounded`), but a money path with an unchecked negation
/// in it is a money path with a panic in it.
pub fn are_opposite(first: Money, second: Money) -> bool {
    if first == Money::ZERO {
        return false;
    }
    second
        .minor()
        .checked_neg()
        .is_some_and(|negated| first.minor() == negated)
}

/// T-5. `20260716100000:112-115` and three copies.
pub fn split_cannot_become_transfer() -> CoreError {
    CoreError::refuse(
        "split_cannot_become_transfer",
        "a split transaction cannot become a transfer — remove the split first",
    )
}

/// T-3. `20260716100000:116-118` and three copies.
pub fn already_linked() -> CoreError {
    CoreError::refuse(
        "transfer_already_linked",
        "transaction is already part of a linked transfer",
    )
}

/// T-13, in the two wordings the cloud actually uses.
///
/// `repair_claimed_transfer` says *"one of these rows"* because it has three to
/// choose from; `link_split_line_transfer` says *"that row"* because it has one.
/// Both carry the same code. The wording difference is the cloud's and is
/// reproduced rather than harmonised — the client shows `error.message` to a
/// human, and "one of these rows" in front of a single row is a worse sentence.
pub fn archived(one_of_several: bool) -> CoreError {
    CoreError::refuse(
        "archived_row_not_repairable",
        if one_of_several {
            "archived_row_not_repairable: one of these rows is archived — bring it back into the register before re-pairing it"
        } else {
            "archived_row_not_repairable: that row is archived — bring it back into the register before pairing it"
        },
    )
}

/// The row went between reading it and writing it — `changes()` said 0.
///
/// Postgres cannot reach this: `UPDATE … RETURNING * INTO v` after a
/// `SELECT … FOR UPDATE` in the same transaction always finds its row. Locally
/// `BEGIN IMMEDIATE` gives the same guarantee, so this is unreachable here too —
/// and it is asserted anyway, because SQLite reports "no rows changed" by saying
/// nothing at all, and a balance or a link that silently did not move is exactly
/// the failure this crate exists to prevent.
pub fn vanished(what: &str) -> CoreError {
    CoreError::refuse(
        "transaction_not_found",
        &format!("{what} disappeared between finding it and writing it"),
    )
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{amounts_not_opposite, are_opposite};
    use crate::money::Money;

    #[test]
    fn opposite_means_exactly_opposite_and_non_zero() {
        assert!(are_opposite(Money::from_minor(-1500), Money::from_minor(1500)));
        assert!(are_opposite(Money::from_minor(1500), Money::from_minor(-1500)));
        // The zero test is not redundant with the negation test.
        assert!(!are_opposite(Money::ZERO, Money::ZERO));
        assert!(!are_opposite(Money::from_minor(-1500), Money::from_minor(1499)));
        assert!(!are_opposite(Money::from_minor(-1500), Money::from_minor(-1500)));
        // i64::MIN has no negation. Not storable, and not a panic either.
        assert!(!are_opposite(Money::from_minor(1), Money::from_minor(i64::MIN)));
    }

    #[test]
    fn the_message_carries_both_figures_in_the_order_given() {
        let error = amounts_not_opposite(Money::from_minor(-3000), Money::from_minor(2999));
        assert_eq!(
            error.to_string(),
            "transfer_amounts_not_opposite: transfer sides must have exactly opposite non-zero amounts (-30.00 vs 29.99)"
        );
    }
}
