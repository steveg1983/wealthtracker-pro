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
 * holds, and whatever an imported statement happens to quote, every save runs
 * through accountNumberForStorage and writes four digits at most. Anything
 * stored is stored in plain text and reaches the user's backups, their JSON
 * export and their audit history, so a full card number must never get that
 * far, however it arrived.
 */

import type { Account } from '../types';

/** A UK bank account number is exactly 8 digits. */
export const BANK_ACCOUNT_NUMBER_LENGTH = 8;

/** A card is identified by the last 4 digits printed on it, and nothing more. */
export const CARD_LAST_FOUR_LENGTH = 4;

/** One wording for the field label, so both forms ask for the same thing. */
export const CARD_NUMBER_LABEL = 'Card Number — last 4 digits only';

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Whether an account's number is a CARD number rather than a bank one — the
 * one place that question is answered, so a save and a display can never
 * disagree about which rule applies to a given account.
 */
export const isCardAccountType = (type: Account['type'] | undefined): boolean =>
  type === 'credit';

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
 * The account number a save is allowed to write.
 *
 * This is the boundary the input deliberately does not enforce (see
 * nextAccountNumberValue). Every path that persists an account number goes
 * through here, so a full card number cannot be stored by typing it, pasting
 * it, or importing a file that quotes it — the source does not matter, only
 * the account type does. A field left empty comes back as undefined so it
 * clears the column rather than storing a blank string.
 */
export const accountNumberForStorage = (
  value: string | undefined,
  isCard: boolean
): string | undefined => {
  const stored = isCard ? keepLastFour(value ?? '') : (value ?? '').trim();
  return stored === '' ? undefined : stored;
};

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
