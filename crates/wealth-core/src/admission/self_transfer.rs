//! TS-I8 — a suggested category may never make a row a transfer to the account
//! it is already in.
//!
//! Port of `isSelfTransferCategory` (`src/utils/transferMatch.ts:85-94`), the
//! guard the two file importers apply to every automatic category suggestion
//! (`ofxImportService.ts:595`, `qifImportService.ts:415`).
//!
//! # The incident this exists for
//!
//! A transfer moves money between two accounts; "Current Account → Current
//! Account" describes nothing. The manual editor had always refused it — *"that
//! is this account's own transfer category; pick the OTHER account's To/From
//! category"* — but the importers' automatic categoriser had no such guard, and
//! its merchant key is the generic payment channel: *immediate faster payment*,
//! *direct debit*. A swept account's own internal sweeps share that key with
//! every third-party payment on the statement, so ordinary direct debits
//! arrived filed as transfers to the very account they sat in.
//!
//! # Why it is a refusal and not a confidence threshold
//!
//! Suggestions are advice, and advice is allowed to be wrong. This one is never
//! right, whatever its confidence — so it is refused rather than ranked. The
//! confidence floor the importers apply (`>= 0.7`) is a separate decision made
//! by the caller and is deliberately not here: a rule that is *always* wrong and
//! a rule that is *probably* wrong do not belong in the same expression.
//!
//! # Growing room, stated so it is not discovered
//!
//! This is the first rule in what PHASE1-PLAN §3.2 calls `plan_import`'s
//! category admission. TS-I11 — *a QIF category name with no app match is left
//! BLANK, never stored raw*, currently the only protection of R-3 on the QIF
//! path — belongs beside it and is not ported here. The result already names its
//! refusal so that a second one can be added without changing the shape.

use serde::{Deserialize, Serialize};

/// The category fields this rule reads.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CategoryIdentity {
    /// The category's id.
    pub id: String,
    /// True for the account-managed "To/From <account>" categories.
    #[serde(default)]
    pub is_transfer_category: bool,
    /// The account a To/From category belongs to.
    #[serde(default)]
    pub account_id: Option<String>,
}

/// Would filing this row under this category make it a transfer to the account
/// it is already in?
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanCategoryAdmission {
    /// The user's own category tree.
    pub categories: Vec<CategoryIdentity>,
    /// The category the categoriser wants to file the row under.
    #[serde(default)]
    pub category_id: String,
    /// The account the row is being imported into.
    #[serde(default)]
    pub account_id: String,
}

/// Whether the suggestion may be admitted, and why not when it may not.
#[derive(Debug, Clone, Serialize)]
pub struct PlanCategoryAdmissionResult {
    /// True when the row may be filed under this category.
    pub admitted: bool,
    /// The rule that refused, when one did.
    pub refusal: Option<&'static str>,
}

/// The name the refusal is reported under.
pub const SELF_TRANSFER: &str = "self_transfer";

/// Would filing this transaction under `category_id` make it a transfer to the
/// account it is ALREADY in?
///
/// An empty category or an empty account is `false`: there is nothing being
/// suggested, so there is nothing to refuse.
#[must_use]
pub fn is_self_transfer_category(
    categories: &[CategoryIdentity],
    category_id: &str,
    account_id: &str,
) -> bool {
    if category_id.is_empty() || account_id.is_empty() {
        return false;
    }
    categories.iter().any(|category| {
        category.id == category_id
            && category.is_transfer_category
            && category.account_id.as_deref() == Some(account_id)
    })
}

/// Apply TS-I8.
#[must_use]
pub fn plan_category_admission(
    command: &PlanCategoryAdmission,
) -> PlanCategoryAdmissionResult {
    let self_transfer = is_self_transfer_category(
        &command.categories,
        &command.category_id,
        &command.account_id,
    );
    PlanCategoryAdmissionResult {
        admitted: !self_transfer,
        refusal: if self_transfer {
            Some(SELF_TRANSFER)
        } else {
            None
        },
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{is_self_transfer_category, CategoryIdentity};

    fn category(id: &str, is_transfer: bool, account: Option<&str>) -> CategoryIdentity {
        CategoryIdentity {
            id: id.to_owned(),
            is_transfer_category: is_transfer,
            account_id: account.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn all_three_conditions_are_required() {
        let tree = vec![
            category("to-from-current", true, Some("current")),
            category("to-from-savings", true, Some("savings")),
            category("groceries", false, None),
            // A category that is scoped to the account but is NOT a To/From
            // one. C-11 forbids it in the file; the rule still has to say no.
            category("odd", false, Some("current")),
        ];
        assert!(is_self_transfer_category(&tree, "to-from-current", "current"));
        assert!(!is_self_transfer_category(&tree, "to-from-savings", "current"));
        assert!(!is_self_transfer_category(&tree, "groceries", "current"));
        assert!(!is_self_transfer_category(&tree, "odd", "current"));
        assert!(!is_self_transfer_category(&tree, "unknown", "current"));
    }

    #[test]
    fn nothing_suggested_is_nothing_to_refuse() {
        let tree = vec![category("to-from-current", true, Some("current"))];
        assert!(!is_self_transfer_category(&tree, "", "current"));
        assert!(!is_self_transfer_category(&tree, "to-from-current", ""));
        assert!(!is_self_transfer_category(&[], "to-from-current", "current"));
    }
}
