/**
 * What an OFX statement says about the account it came from, and what may
 * safely be copied out of it onto one of the user's accounts.
 *
 * Three rules do all the work, and each of them exists because getting it
 * wrong writes something permanent onto a real account:
 *
 *  - A card's <ACCTID> is the CARD number, and some banks put the whole PAN in
 *    it. A full card number must never be stored: it would land in the user's
 *    backups, their JSON export and their audit history. A credit account
 *    therefore keeps the last 4 digits and nothing else — the same shape the
 *    account form asks for (see accountNumberInput) and the same shape
 *    findCardMaskMatch compares a bank feed against.
 *  - A sort code belongs to a bank account. A card has none, so one is never
 *    stored against one, whatever the file happens to contain.
 *  - Anything that cannot be recognised for certain is left alone. Storing a
 *    wrong sort code is worse than storing none at all, because the NEXT
 *    import would then match confidently to the wrong account.
 */

import type { Account } from '../types';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_LAST_FOUR_LENGTH,
  digitsOnly,
  formatSortCode,
  keepLastFour
} from './accountNumberInput';

/** A UK sort code is exactly 6 digits, written XX-XX-XX. */
export const SORT_CODE_LENGTH = 6;

/** The identifiers an OFX statement carries about its own account. */
export interface OfxAccountIdentifiers {
  /** <ACCTID> — the account number, or on a card statement the card number. */
  accountId: string;
  /** <BANKID> — the sort code. Card statements do not have one. */
  bankId?: string;
  /** True when the statement came from <CCACCTFROM> rather than <BANKACCTFROM>. */
  isCreditCardStatement: boolean;
}

/** The identifiers above, cleaned into the shapes an account actually stores. */
export interface OfxIdentifierValues {
  /** Formatted XX-XX-XX, and only when the file gave a full 6 digits. */
  sortCode?: string;
  /** A full 8-digit bank account number, and only when one is recognisable. */
  accountNumber?: string;
  /** The last 4 digits — everything a credit account stores, and no more. */
  cardLastFour?: string;
}

/** The fields a backfill would write, plus wording safe to show the user. */
export interface AccountDetailsBackfill {
  /** Only ever fields the account has left blank. */
  updates: Pick<Account, 'sortCode' | 'accountNumber'>;
  /**
   * What was filled, in words. Never contains a full account or card number:
   * a sort code and a last 4 are enough for a person to recognise the account,
   * and a message is one more place a full number would end up.
   */
  summary: string;
}

/** The account fields this module reads. Keeps callers free of the full type. */
type AccountIdentity = Pick<Account, 'type' | 'sortCode' | 'accountNumber'>;

const isBlank = (value: string | undefined): boolean => (value ?? '').trim() === '';

/** Compare two stored identifiers ignoring formatting (12-34-56 vs 123456). */
const sameDigits = (a: string | undefined, b: string | undefined): boolean =>
  digitsOnly(a ?? '') === digitsOnly(b ?? '');

/**
 * The account types that have a sort code and an account number at all.
 * 'checking' is the database's own spelling of 'current' (see
 * sectionTypeForAccount in accountGrouping) — a row that reaches here
 * untranslated is still a current account and still has bank details.
 */
const isBankAccountType = (type: Account['type']): boolean =>
  type === 'current' || type === 'savings' || type === 'checking';

/**
 * Clean the raw OFX tags into storable values.
 *
 * The account number is deliberately conservative. Exactly 8 digits is a UK
 * account number. Some banks instead put the sort code and the account number
 * together in one <ACCTID>, which is recognisable because the first 6 digits
 * are the <BANKID> we already have — that case splits cleanly. Anything else
 * (an IBAN, a padded reference, a 12-digit foreign number) yields nothing,
 * because a guessed 8 digits would be stored as fact.
 */
export const readOfxAccountIdentifiers = (ofx: OfxAccountIdentifiers): OfxIdentifierValues => {
  const accountDigits = digitsOnly(ofx.accountId);
  const bankDigits = digitsOnly(ofx.bankId ?? '');

  const sortCode = bankDigits.length === SORT_CODE_LENGTH ? formatSortCode(bankDigits) : undefined;
  const cardLastFour =
    accountDigits.length >= CARD_LAST_FOUR_LENGTH ? keepLastFour(accountDigits) : undefined;

  let accountNumber: string | undefined;
  if (!ofx.isCreditCardStatement) {
    if (accountDigits.length === BANK_ACCOUNT_NUMBER_LENGTH) {
      accountNumber = accountDigits;
    } else if (
      bankDigits.length === SORT_CODE_LENGTH &&
      accountDigits.length === SORT_CODE_LENGTH + BANK_ACCOUNT_NUMBER_LENGTH &&
      accountDigits.startsWith(bankDigits)
    ) {
      accountNumber = accountDigits.slice(SORT_CODE_LENGTH);
    }
  }

  return { sortCode, accountNumber, cardLastFour };
};

/**
 * True when the file is unmistakably a bank statement rather than a card one:
 * it quoted a sort code, and cards do not have those.
 */
const isDefinitelyBankStatement = (ofx: OfxAccountIdentifiers): boolean =>
  !ofx.isCreditCardStatement && digitsOnly(ofx.bankId ?? '').length === SORT_CODE_LENGTH;

/**
 * What (if anything) this statement may fill in on this account.
 *
 * Returns null far more often than not, and every null is deliberate: a
 * detail already recorded, a detail the file states differently from the
 * account, a file of the wrong kind for the account, or an account type that
 * has no bank details to record. Nothing recorded is ever replaced — the only
 * write this function will ever describe is one into an empty field.
 */
export const planAccountDetailsBackfill = (
  ofx: OfxAccountIdentifiers,
  account: AccountIdentity
): AccountDetailsBackfill | null => {
  const values = readOfxAccountIdentifiers(ofx);

  // A detail already on the account that disagrees with the file means this
  // file is not this account's (or one of the two is wrong). Filling the
  // other, still-blank field would make a half-wrong record look complete, so
  // this stops before writing anything.
  if (!isBlank(account.sortCode) && values.sortCode && !sameDigits(account.sortCode, values.sortCode)) {
    return null;
  }
  if (
    !isBlank(account.accountNumber) &&
    values.accountNumber &&
    !sameDigits(account.accountNumber, values.accountNumber)
  ) {
    return null;
  }

  if (account.type === 'credit') {
    // A card statement's number is the only thing a card stores, and a file
    // carrying a sort code is not a card statement at all.
    if (isDefinitelyBankStatement(ofx) || !isBlank(account.accountNumber) || !values.cardLastFour) {
      return null;
    }
    return {
      updates: { accountNumber: values.cardLastFour },
      summary: `card ending ${values.cardLastFour}`
    };
  }

  // A card statement's <ACCTID> may be a full PAN. Trimming it to 8 digits for
  // a bank account's field would store the wrong digits of a card number.
  if (!isBankAccountType(account.type) || ofx.isCreditCardStatement) {
    return null;
  }

  const updates: AccountDetailsBackfill['updates'] = {};
  const filled: string[] = [];

  if (isBlank(account.sortCode) && values.sortCode) {
    updates.sortCode = values.sortCode;
    filled.push(`sort code ${values.sortCode}`);
  }
  if (isBlank(account.accountNumber) && values.accountNumber) {
    updates.accountNumber = values.accountNumber;
    filled.push(`account number ending ${keepLastFour(values.accountNumber)}`);
  }

  if (filled.length === 0) {
    return null;
  }

  return { updates, summary: filled.join(' and ') };
};

/** Does this account's own recorded identifiers say the file is its own? */
const matchesRecordedIdentifiers = (
  ofx: OfxAccountIdentifiers,
  values: OfxIdentifierValues,
  account: Account
): boolean => {
  if (account.type === 'credit') {
    // The card's last 4 is the identifier, exactly as the bank feed matches it.
    if (isDefinitelyBankStatement(ofx) || !values.cardLastFour) return false;
    const recorded = digitsOnly(account.accountNumber ?? '');
    return recorded.length >= CARD_LAST_FOUR_LENGTH && recorded.slice(-CARD_LAST_FOUR_LENGTH) === values.cardLastFour;
  }

  if (!isBankAccountType(account.type) || ofx.isCreditCardStatement) return false;
  if (!values.accountNumber || isBlank(account.accountNumber)) return false;
  if (!sameDigits(account.accountNumber, values.accountNumber)) return false;

  // Sort codes only have to agree when both sides have one; a sort code that
  // was never recorded is missing information, not a contradiction.
  if (values.sortCode && !isBlank(account.sortCode)) {
    return sameDigits(account.sortCode, values.sortCode);
  }
  return true;
};

/**
 * The account whose OWN recorded sort code / account number matches the file.
 *
 * This is the only kind of account match that is a fact rather than a guess,
 * and it is what a backfill buys the user: once the details are on the
 * account, the next file finds it here instead of falling through to the
 * name-and-type guesswork below it. Ambiguity counts as no match — two
 * accounts carrying the same identifiers is a data problem, not a choice this
 * function should make.
 */
export const findAccountByOfxIdentifiers = (
  ofx: OfxAccountIdentifiers,
  accounts: readonly Account[]
): Account | null => {
  const values = readOfxAccountIdentifiers(ofx);
  if (!values.accountNumber && !values.cardLastFour) return null;

  const matches = accounts.filter((account) => matchesRecordedIdentifiers(ofx, values, account));
  return matches.length === 1 ? matches[0] : null;
};
