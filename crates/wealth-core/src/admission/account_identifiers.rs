//! TS-A1 / TS-A2 / TS-A3 — what an OFX statement says about the account it came
//! from, and what may safely be copied out of it onto one of the user's
//! accounts.
//!
//! Port of `src/utils/ofxAccountIdentifiers.ts`, and of the three constants and
//! two helpers it takes from `src/utils/accountNumberInput.ts`.
//!
//! # Three rules, each because getting it wrong writes something permanent
//!
//! * **A card's `<ACCTID>` is the CARD number**, and some banks put the whole
//!   PAN in it. A full card number must never be stored: it would land in the
//!   user's backups, their JSON export and their audit history. A credit account
//!   keeps the last four digits and nothing else — the same shape the account
//!   form asks for and the same shape the bank feed's mask is compared against.
//! * **A sort code belongs to a bank account.** A card has none, so one is never
//!   stored against one, whatever the file happens to contain.
//! * **Anything that cannot be recognised for certain is left alone.** Storing a
//!   wrong sort code is worse than storing none, because the NEXT import would
//!   then match confidently to the wrong account.
//!
//! # The account number is deliberately conservative
//!
//! Exactly eight digits is a UK account number. Some banks instead put the sort
//! code and the account number together in one `<ACCTID>`, which is recognisable
//! because the first six digits are the `<BANKID>` already in hand; that case
//! splits cleanly. Anything else — an IBAN, a padded reference, a twelve-digit
//! foreign number — yields nothing, because a guessed eight digits would be
//! stored as fact.
//!
//! # The backfill only ever writes into a blank field
//!
//! And it stops entirely if any recorded detail disagrees with the file: a file
//! that is not this account's is not an invitation to fill in the half that
//! happens to be empty, because a half-wrong record that looks complete is worse
//! than an empty one.
//!
//! # Why the match is here too
//!
//! `find_account_by_ofx_identifiers` is the other half of the same rule and the
//! reason a backfill is worth doing at all: once the details are on the account,
//! the next file finds it by FACT rather than by the name-and-type guesswork
//! below it — which is exactly what `destination_confirmed`
//! ([`super::statement_bank_balance`], TS-B2) is asking about. Ambiguity counts
//! as no match: two accounts carrying the same identifiers is a data problem,
//! not a choice this function should make.

use serde::{Deserialize, Serialize};

/// A UK sort code is exactly six digits, written `XX-XX-XX`.
pub const SORT_CODE_LENGTH: usize = 6;

/// A UK bank account number is exactly eight digits.
pub const BANK_ACCOUNT_NUMBER_LENGTH: usize = 8;

/// A card is identified by the last four digits printed on it, and no more.
pub const CARD_LAST_FOUR_LENGTH: usize = 4;

/// The account types, exactly as `src/types/accountType.ts` spells them.
///
/// No catch-all variant: an unrecognised type is a refusal at the boundary
/// rather than a row quietly treated as "not a bank account". `checking` is the
/// database's own spelling of `current` and is a bank account too.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountType {
    /// A current account.
    Current,
    /// A savings account.
    Savings,
    /// A credit card — the one type whose number is a card number.
    Credit,
    /// A loan.
    Loan,
    /// An investment account.
    Investment,
    /// An asset.
    Asset,
    /// A liability.
    Liability,
    /// A mortgage.
    Mortgage,
    /// An asset, in the plural spelling the app also stores.
    Assets,
    /// Anything else the user classified themselves.
    Other,
    /// The database's spelling of a current account.
    Checking,
}

impl AccountType {
    /// The account types that have a sort code and an account number at all.
    const fn is_bank_account(self) -> bool {
        matches!(self, Self::Current | Self::Savings | Self::Checking)
    }
}

/// The identifiers an OFX statement carries about its own account.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OfxAccountIdentifiers {
    /// `<ACCTID>` — the account number, or on a card statement the card number.
    pub account_id: String,
    /// `<BANKID>` — the sort code. Card statements do not have one.
    #[serde(default)]
    pub bank_id: Option<String>,
    /// True when the statement came from `<CCACCTFROM>` rather than
    /// `<BANKACCTFROM>`.
    pub is_credit_card_statement: bool,
}

/// The account fields this module reads.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountIdentity {
    /// The account's own id, so a match can name which one it found.
    #[serde(default)]
    pub id: String,
    /// Which kind of account it is.
    pub r#type: AccountType,
    /// The recorded sort code, in whatever formatting it was typed.
    #[serde(default)]
    pub sort_code: Option<String>,
    /// The recorded account number — or, for a card, its last four digits.
    #[serde(default)]
    pub account_number: Option<String>,
}

/// The identifiers, cleaned into the shapes an account actually stores.
#[derive(Debug, Clone, Serialize)]
pub struct OfxIdentifierValues {
    /// Formatted `XX-XX-XX`, and only when the file gave a full six digits.
    pub sort_code: Option<String>,
    /// A full eight-digit bank account number, and only when one is
    /// recognisable.
    pub account_number: Option<String>,
    /// The last four digits — everything a credit account stores, and no more.
    pub card_last_four: Option<String>,
}

/// The fields a backfill would write. Two, and there is no third.
#[derive(Debug, Clone, Serialize)]
pub struct AccountDetailsUpdates {
    /// The sort code to fill in, when it was blank and the file states one.
    pub sort_code: Option<String>,
    /// The account number to fill in, when it was blank and the file states
    /// one.
    pub account_number: Option<String>,
}

/// The fields a backfill would write, plus wording safe to show the user.
#[derive(Debug, Clone, Serialize)]
pub struct AccountDetailsBackfill {
    /// Only ever fields the account has left blank.
    pub updates: AccountDetailsUpdates,
    /// What was filled, in words. Never contains a full account or card
    /// number: a sort code and a last four are enough for a person to recognise
    /// the account, and a message is one more place a full number would end up.
    pub summary: String,
}

/// Read a statement's identifiers, and say what may be filled in on one
/// account.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanAccountIdentifiers {
    /// What the file says about its own account.
    pub ofx: OfxAccountIdentifiers,
    /// The account the caller means to write to, when there is one.
    #[serde(default)]
    pub account: Option<AccountIdentity>,
}

/// The values, and the backfill if one is permitted.
#[derive(Debug, Clone, Serialize)]
pub struct PlanAccountIdentifiersResult {
    /// What the file states, cleaned.
    pub values: OfxIdentifierValues,
    /// What may be written, or nothing — which is the common answer.
    pub backfill: Option<AccountDetailsBackfill>,
}

/// Which of the user's accounts this statement is provably from.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanAccountIdentifierMatch {
    /// What the file says about its own account.
    pub ofx: OfxAccountIdentifiers,
    /// Every account the user has.
    pub accounts: Vec<AccountIdentity>,
}

/// The single account whose own recorded identifiers are the file's, if there
/// is exactly one.
#[derive(Debug, Clone, Serialize)]
pub struct PlanAccountIdentifierMatchResult {
    /// The account's id, or nothing — for no match AND for an ambiguous one.
    pub account_id: Option<String>,
    /// How many accounts the file's identifiers fit. Carried because "none" and
    /// "more than one" are the same answer and very different situations.
    pub candidates: usize,
}

/// Keep only the ASCII digits. The port of `value.replace(/\D/g, '')`, whose
/// character class is ASCII because the regular expression has no `u` flag.
#[must_use]
pub fn digits_only(value: &str) -> String {
    value.chars().filter(char::is_ascii_digit).collect()
}

/// The last four digits — the only part of a card number worth storing.
///
/// `String.prototype.slice(-4)` on a shorter string returns the whole of it,
/// and so does this: a value carrying fewer than four digits is those digits,
/// never a padded lie about how much is held.
#[must_use]
pub fn keep_last_four(value: &str) -> String {
    let digits = digits_only(value);
    let start = digits.len().saturating_sub(CARD_LAST_FOUR_LENGTH);
    digits.get(start..).unwrap_or_default().to_owned()
}

/// Format six digits as `XX-XX-XX`.
fn format_sort_code(digits: &str) -> String {
    let part = |from: usize, to: usize| digits.get(from..to).unwrap_or_default();
    format!("{}-{}-{}", part(0, 2), part(2, 4), part(4, 6))
}

fn is_blank(value: Option<&str>) -> bool {
    value.unwrap_or_default().trim().is_empty()
}

/// Compare two stored identifiers ignoring formatting (`12-34-56` vs `123456`).
fn same_digits(left: Option<&str>, right: Option<&str>) -> bool {
    digits_only(left.unwrap_or_default()) == digits_only(right.unwrap_or_default())
}

/// True when the file is unmistakably a bank statement rather than a card one:
/// it quoted a sort code, and cards do not have those.
fn is_definitely_bank_statement(ofx: &OfxAccountIdentifiers) -> bool {
    !ofx.is_credit_card_statement
        && digits_only(ofx.bank_id.as_deref().unwrap_or_default()).len() == SORT_CODE_LENGTH
}

/// Clean the raw OFX tags into storable values.
#[must_use]
pub fn read_ofx_account_identifiers(ofx: &OfxAccountIdentifiers) -> OfxIdentifierValues {
    let account_digits = digits_only(&ofx.account_id);
    let bank_digits = digits_only(ofx.bank_id.as_deref().unwrap_or_default());

    let sort_code = if bank_digits.len() == SORT_CODE_LENGTH {
        Some(format_sort_code(&bank_digits))
    } else {
        None
    };
    let card_last_four = if account_digits.len() >= CARD_LAST_FOUR_LENGTH {
        Some(keep_last_four(&account_digits))
    } else {
        None
    };

    let mut account_number: Option<String> = None;
    if !ofx.is_credit_card_statement {
        if account_digits.len() == BANK_ACCOUNT_NUMBER_LENGTH {
            account_number = Some(account_digits.clone());
        } else if bank_digits.len() == SORT_CODE_LENGTH
            && account_digits.len() == SORT_CODE_LENGTH + BANK_ACCOUNT_NUMBER_LENGTH
            && account_digits.starts_with(&bank_digits)
        {
            account_number = account_digits.get(SORT_CODE_LENGTH..).map(ToOwned::to_owned);
        }
    }

    OfxIdentifierValues {
        sort_code,
        account_number,
        card_last_four,
    }
}

/// What (if anything) this statement may fill in on this account.
///
/// Returns nothing far more often than not, and every one is deliberate: a
/// detail already recorded, a detail the file states differently from the
/// account, a file of the wrong kind for the account, or an account type that
/// has no bank details to record. Nothing recorded is ever replaced — the only
/// write this function will describe is one into an empty field.
#[must_use]
pub fn plan_account_details_backfill(
    ofx: &OfxAccountIdentifiers,
    account: &AccountIdentity,
) -> Option<AccountDetailsBackfill> {
    let values = read_ofx_account_identifiers(ofx);

    // A detail already on the account that disagrees with the file means this
    // file is not this account's (or one of the two is wrong). Filling the
    // other, still-blank field would make a half-wrong record look complete, so
    // this stops before writing anything.
    if !is_blank(account.sort_code.as_deref())
        && values.sort_code.is_some()
        && !same_digits(account.sort_code.as_deref(), values.sort_code.as_deref())
    {
        return None;
    }
    if !is_blank(account.account_number.as_deref())
        && values.account_number.is_some()
        && !same_digits(
            account.account_number.as_deref(),
            values.account_number.as_deref(),
        )
    {
        return None;
    }

    if account.r#type == AccountType::Credit {
        // A card statement's number is the only thing a card stores, and a file
        // carrying a sort code is not a card statement at all.
        let card_last_four = values.card_last_four.as_deref()?;
        if is_definitely_bank_statement(ofx) || !is_blank(account.account_number.as_deref()) {
            return None;
        }
        return Some(AccountDetailsBackfill {
            updates: AccountDetailsUpdates {
                sort_code: None,
                account_number: Some(card_last_four.to_owned()),
            },
            summary: format!("card ending {card_last_four}"),
        });
    }

    // A card statement's <ACCTID> may be a full PAN. Trimming it to eight
    // digits for a bank account's field would store the wrong digits of a card
    // number.
    if !account.r#type.is_bank_account() || ofx.is_credit_card_statement {
        return None;
    }

    let mut updates = AccountDetailsUpdates {
        sort_code: None,
        account_number: None,
    };
    let mut filled: Vec<String> = Vec::new();

    if is_blank(account.sort_code.as_deref()) {
        if let Some(sort_code) = values.sort_code.as_deref() {
            updates.sort_code = Some(sort_code.to_owned());
            filled.push(format!("sort code {sort_code}"));
        }
    }
    if is_blank(account.account_number.as_deref()) {
        if let Some(account_number) = values.account_number.as_deref() {
            updates.account_number = Some(account_number.to_owned());
            filled.push(format!(
                "account number ending {}",
                keep_last_four(account_number)
            ));
        }
    }

    if filled.is_empty() {
        return None;
    }
    Some(AccountDetailsBackfill {
        updates,
        summary: filled.join(" and "),
    })
}

/// Does this account's own recorded identifiers say the file is its own?
fn matches_recorded_identifiers(
    ofx: &OfxAccountIdentifiers,
    values: &OfxIdentifierValues,
    account: &AccountIdentity,
) -> bool {
    if account.r#type == AccountType::Credit {
        // The card's last four is the identifier, exactly as the bank feed
        // matches it.
        let Some(card_last_four) = values.card_last_four.as_deref() else {
            return false;
        };
        if is_definitely_bank_statement(ofx) {
            return false;
        }
        let recorded = digits_only(account.account_number.as_deref().unwrap_or_default());
        let start = recorded.len().saturating_sub(CARD_LAST_FOUR_LENGTH);
        return recorded.len() >= CARD_LAST_FOUR_LENGTH
            && recorded.get(start..) == Some(card_last_four);
    }

    if !account.r#type.is_bank_account() || ofx.is_credit_card_statement {
        return false;
    }
    if values.account_number.is_none() || is_blank(account.account_number.as_deref()) {
        return false;
    }
    if !same_digits(
        account.account_number.as_deref(),
        values.account_number.as_deref(),
    ) {
        return false;
    }

    // Sort codes only have to agree when both sides have one; a sort code that
    // was never recorded is missing information, not a contradiction.
    if values.sort_code.is_some() && !is_blank(account.sort_code.as_deref()) {
        return same_digits(account.sort_code.as_deref(), values.sort_code.as_deref());
    }
    true
}

/// Read the file's identifiers and plan a backfill onto one account.
#[must_use]
pub fn plan_account_identifiers(
    command: &PlanAccountIdentifiers,
) -> PlanAccountIdentifiersResult {
    PlanAccountIdentifiersResult {
        values: read_ofx_account_identifiers(&command.ofx),
        backfill: command
            .account
            .as_ref()
            .and_then(|account| plan_account_details_backfill(&command.ofx, account)),
    }
}

/// The account whose OWN recorded sort code / account number matches the file.
///
/// This is the only kind of account match that is a fact rather than a guess.
#[must_use]
pub fn plan_account_identifier_match(
    command: &PlanAccountIdentifierMatch,
) -> PlanAccountIdentifierMatchResult {
    let values = read_ofx_account_identifiers(&command.ofx);
    if values.account_number.is_none() && values.card_last_four.is_none() {
        return PlanAccountIdentifierMatchResult {
            account_id: None,
            candidates: 0,
        };
    }
    let matched: Vec<&AccountIdentity> = command
        .accounts
        .iter()
        .filter(|account| matches_recorded_identifiers(&command.ofx, &values, account))
        .collect();
    PlanAccountIdentifierMatchResult {
        account_id: match matched.as_slice() {
            [only] => Some(only.id.clone()),
            _ => None,
        },
        candidates: matched.len(),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{digits_only, keep_last_four, read_ofx_account_identifiers, OfxAccountIdentifiers};

    fn bank(account_id: &str, bank_id: Option<&str>) -> OfxAccountIdentifiers {
        OfxAccountIdentifiers {
            account_id: account_id.to_owned(),
            bank_id: bank_id.map(ToOwned::to_owned),
            is_credit_card_statement: false,
        }
    }

    #[test]
    fn digits_only_is_ascii_because_the_regular_expression_is() {
        assert_eq!(digits_only("12-34-56"), "123456");
        // Including the `29` inside `GB29` — an IBAN's check digits are digits,
        // which is exactly why the length tests above it never call fourteen
        // of them an account number.
        assert_eq!(digits_only("GB29 NWBK 6016 1331 9268 19"), "2960161331926819");
        // Not an ASCII digit, so not a digit — the same answer `\D` gives
        // without the `u` flag.
        assert_eq!(digits_only("١٢٣"), "");
    }

    #[test]
    fn keep_last_four_never_pads_and_never_takes_the_first_four() {
        assert_eq!(keep_last_four("4929123456789012"), "9012");
        assert_eq!(keep_last_four("12"), "12");
        assert_eq!(keep_last_four(""), "");
        assert_eq!(keep_last_four("XXXXXXXXXXXX3456"), "3456");
    }

    #[test]
    fn a_card_statement_never_yields_an_account_number() {
        let card = OfxAccountIdentifiers {
            account_id: "4929123456789012".to_owned(),
            bank_id: None,
            is_credit_card_statement: true,
        };
        let values = read_ofx_account_identifiers(&card);
        assert_eq!(values.account_number, None);
        assert_eq!(values.card_last_four.as_deref(), Some("9012"));
        assert_eq!(values.sort_code, None);
    }

    #[test]
    fn twelve_digits_and_an_iban_yield_nothing_rather_than_a_guess() {
        assert_eq!(
            read_ofx_account_identifiers(&bank("987654321098", Some("123456"))).account_number,
            None
        );
        assert_eq!(
            read_ofx_account_identifiers(&bank("GB29NWBK", None)).account_number,
            None
        );
    }

    #[test]
    fn a_sort_code_in_front_of_the_account_number_splits_cleanly() {
        let values = read_ofx_account_identifiers(&bank("12345687654321", Some("123456")));
        assert_eq!(values.account_number.as_deref(), Some("87654321"));
        assert_eq!(values.sort_code.as_deref(), Some("12-34-56"));
        // …and only when the leading six ARE the sort code in hand.
        assert_eq!(
            read_ofx_account_identifiers(&bank("99999987654321", Some("123456"))).account_number,
            None
        );
    }
}
