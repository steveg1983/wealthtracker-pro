/**
 * The rules for the sort code / account number fields shared by the two places
 * an account's bank details can be entered: AddAccountModal when it is created
 * and AccountSettingsModal afterwards. Both forms write the same `sortCode` and
 * `accountNumber` fields, so they have to agree on what those fields mean.
 *
 * The subtlety is `accountNumber`. For a current or savings account it is the
 * bank's 8-digit account number. For a credit card it is the LAST 4 DIGITS
 * only: that is what the bank feed publishes as its mask, and what
 * findCardMaskMatch (components/banking/LinkBankAccountsModal) compares against
 * to link a card to its feed. A card has no sort code at all.
 *
 * For a card, "last 4 only" is not advice — it is enforced. Whatever the field
 * holds, and whatever an imported statement happens to quote, four digits at
 * most are written. Anything stored is stored in plain text and reaches the
 * user's backups, their JSON export and their audit history, so a full card
 * number must never get that far, however it arrived.
 *
 * The forms trim before they save, but a form is not where a rule like this can
 * live: it only covers the callers that remember it. The rule is enforced again
 * inside every service that writes accounts.account_number — creates through
 * accountNumberForStorage, partial updates through accountNumberUpdateForStorage
 * — and once more on the server, in api/banking/link-accounts, which cannot
 * trust what a client sends it. This module holds the rule; those are the
 * boundaries that apply it.
 */

// .js extension required: this module is part of the api/ serverless import
// graph (api/banking/link-accounts), where node ESM refuses extensionless
// relative imports at runtime. Type-only imports are erased today, but a later
// value import on this line must not resurrect the crash.
import type { AccountType } from '../types/accountType.js';

/** A UK bank account number is exactly 8 digits. */
export const BANK_ACCOUNT_NUMBER_LENGTH = 8;

/** A card is identified by the last 4 digits printed on it, and nothing more. */
export const CARD_LAST_FOUR_LENGTH = 4;

/** One wording for the field label, so both forms ask for the same thing. */
export const CARD_NUMBER_LABEL = 'Card Number — last 4 digits only';

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** The one account type whose number is a card number. */
const CARD_ACCOUNT_TYPE = 'credit';

/**
 * Whether an account's number is a CARD number rather than a bank one — the
 * one place that question is answered, so a save and a display can never
 * disagree about which rule applies to a given account.
 */
export const isCardAccountType = (type: AccountType | undefined): boolean =>
  type === CARD_ACCOUNT_TYPE;

/**
 * The same question asked of a value that has not been through the type system:
 * a `type` column read back from the database, or one arriving in a request
 * body. Both are plain unknowns at that point, and the alternative to asking
 * here is a cast at each boundary.
 */
export const isCardAccountTypeValue = (type: unknown): boolean =>
  type === CARD_ACCOUNT_TYPE;

/** Format a typed sort code as XX-XX-XX while it is being entered. */
export const formatSortCode = (value: string): string => {
  const digits = digitsOnly(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
};

/**
 * What the account-number field should hold after a keystroke or a paste.
 *
 * A bank account number is capped at its real length. A card's is deliberately
 * NOT capped: capping (or a maxLength attribute) truncates a pasted 16-digit
 * number to its FIRST four, which is silently wrong and, worse, the wrong four.
 * The whole entry is kept while it is being typed so the LAST four survive to
 * the save, where accountNumberForStorage drops the rest.
 */
export const nextAccountNumberValue = (rawInput: string, isCard: boolean): string => {
  const digits = digitsOnly(rawInput);
  return isCard ? digits : digits.slice(0, BANK_ACCOUNT_NUMBER_LENGTH);
};

/** True when a card field holds more than the last 4 digits it needs. */
export const hasMoreThanLastFour = (value: string): boolean =>
  digitsOnly(value).length > CARD_LAST_FOUR_LENGTH;

/** The last 4 digits — the only part of a card number worth storing. */
export const keepLastFour = (value: string): string =>
  digitsOnly(value).slice(-CARD_LAST_FOUR_LENGTH);

/**
 * The account number a save is allowed to write, when the whole account is in
 * hand — a create, or a form submitting every field.
 *
 * This is the boundary the input deliberately does not enforce (see
 * nextAccountNumberValue): a full card number cannot be stored by typing it,
 * pasting it, or importing a file that quotes it, because the source does not
 * matter here, only the account type does. A field left empty comes back as
 * undefined so it clears the column rather than storing a blank string.
 */
export const accountNumberForStorage = (
  value: string | undefined,
  isCard: boolean
): string | undefined => {
  const stored = isCard ? keepLastFour(value ?? '') : (value ?? '').trim();
  return stored === '' ? undefined : stored;
};

/** The two fields of an account update the card-number rule needs to see. */
interface AccountNumberUpdate {
  type?: AccountType;
  accountNumber?: string;
}

/**
 * The same rule applied to a PARTIAL update, where two things are unknown that
 * a create knows.
 *
 * The first is whether the account number is being written at all: an update
 * carries only the fields it changes, so an absent one leaves the stored value
 * alone and is returned untouched — this must never blank a number nobody
 * asked to change.
 *
 * The second is the account's type, which may be in a different payload
 * entirely (an importer filling in identifiers sends the number and nothing
 * else). What decides the rule is the type the row will HAVE once this write
 * lands: the payload's when it carries one — a save that switches an account to
 * Credit Card and sets its number in the same breath is a card write — and the
 * stored one otherwise. `storedType` is therefore the value read back from the
 * row, and a caller that could not read it must refuse the write rather than
 * pass undefined, which reads here as "not a card".
 */
export const accountNumberUpdateForStorage = <T extends AccountNumberUpdate>(
  updates: T,
  storedType: unknown
): T => {
  if (updates.accountNumber === undefined) {
    return updates;
  }
  const isCard = updates.type !== undefined
    ? isCardAccountType(updates.type)
    : isCardAccountTypeValue(storedType);
  return isCard ? { ...updates, accountNumber: keepLastFour(updates.accountNumber) } : updates;
};

/**
 * The account number a bank-link request is allowed to store.
 *
 * The server's copy of the rule (api/banking/link-accounts), where the facts
 * come from two different places on purpose. `isCardFeed` is the client's claim
 * that this number arrived from the provider's CARDS surface, and is believed
 * only in the direction that truncates. `storedType` is the type of the account
 * being linked to, read from the row rather than taken from the request body,
 * which is not evidence of anything. Either saying "card" is enough: a number
 * from a card feed is a card number whatever the local row happens to be
 * called, and a card row's number is a card number whatever sent it.
 */
export const linkedAccountNumberForStorage = (
  value: string,
  isCardFeed: boolean,
  storedType: unknown
): string =>
  isCardFeed || isCardAccountTypeValue(storedType) ? keepLastFour(value) : value;

/**
 * A stored card number as it is shown back: XXXX XXXX XXXX 1234.
 *
 * The X's stand for digits nobody has, which is the point — they say "this is
 * a card, and these four are all we hold". So a value carrying fewer than four
 * digits is shown as those digits alone: padding it into a full-looking card
 * number would claim we hold a 16-digit number when we do not. Nothing to show
 * comes back empty, for the caller to render no element at all.
 */
export const formatCardNumberForDisplay = (value: string | undefined): string => {
  const lastFour = keepLastFour(value ?? '');
  return lastFour.length < CARD_LAST_FOUR_LENGTH ? lastFour : `XXXX XXXX XXXX ${lastFour}`;
};
