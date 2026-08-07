/**
 * Whether an imported statement's closing balance may be written onto an
 * account's Bank Balance, and what exactly gets written.
 *
 * WHY THIS EXISTS
 * ---------------
 * Bank Balance is the number Reconciliation compares the cleared ledger
 * against; without it, Difference reads N/A and finalising a reconciliation
 * proves nothing. Only the bank feed ever set it, so anyone importing a
 * statement by hand had to type the closing balance in themselves — while the
 * file they had just imported stated it. A statement import should populate it
 * the same way a feed does.
 *
 * WHAT IT WILL NEVER WRITE
 * ------------------------
 * `balance`. That is the ledger: initial_balance plus every transaction, moved
 * only by the atomic transaction RPCs. The statement's transactions have
 * already moved it by the time this runs, so writing the statement's total on
 * top would count the same money twice. bank_balance is a REFERENCE the app
 * compares against and never adds to — which is also why a wrong one is safe:
 * it shows up as a visible Difference, not as money that changed.
 *
 * THE SIGN IS THE FILE'S OWN
 * --------------------------
 * Nothing here normalises a sign. OFX signs a statement's balance in the same
 * frame as the transactions printed beside it, so a card with money owing
 * closes on a negative ledger balance — the same way this app stores a
 * liability. (TrueLayer's card API is the opposite and cardNormalization
 * negates it there; doing that here would turn a correctly-signed debt into an
 * asset.) See the note on OFXImportService.importTransactions.
 */

import type { Account } from '../types';
import { toDecimal, toNumber } from './decimal';

/** A statement's closing balance and the day it is true for. */
export interface StatementBalance {
  amount: number;
  /** Calendar day, 'YYYY-MM-DD'. */
  dateAsOf: string;
}

/** The account fields this module reads — and the only ones it ever writes. */
export type BankBalanceRecord = Pick<Account, 'bankBalance' | 'bankBalanceDate'>;

export type StatementBankBalanceOutcome =
  /** Write these fields onto the account. */
  | { kind: 'set'; updates: BankBalanceRecord; amount: number; dateAsOf: string }
  /** Left alone: what the account already holds is more recent than this file. */
  | { kind: 'stale'; recordedDate: string; recordedBalance: number }
  /** Nothing to do, and nothing worth saying. */
  | { kind: 'none' };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day in the one form that compares and sorts correctly. */
export const isIsoDay = (value: string | null | undefined): value is string =>
  typeof value === 'string' && ISO_DAY.test(value);

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/**
 * '2026-03-31' → '31 Mar 2026'.
 *
 * Read straight off the string rather than through a Date, because a Date has
 * to put the day in some timezone: `new Date('2026-03-31')` is midnight UTC,
 * and west of Greenwich that renders as the 30th. A statement date shown a day
 * out is a statement the user cannot find.
 */
export const formatStatementDay = (isoDay: string): string => {
  if (!isIsoDay(isoDay)) return isoDay;
  const [year, month, day] = isoDay.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  if (!monthName) return isoDay;
  return `${Number(day)} ${monthName} ${year}`;
};

/**
 * Today, where the user is, as a calendar day.
 *
 * Local parts rather than toISOString().slice(0, 10): the latter is the UTC
 * day, which is yesterday for anyone far enough east in the morning — and this
 * day is compared against statement dates to decide which figure is newer.
 */
export const todayIsoDay = (now: Date = new Date()): string => {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export interface StatementBankBalanceOptions {
  /**
   * True when a person has settled which account this statement belongs to —
   * they picked it, or the account's own recorded sort code / account number
   * is the one in the file.
   *
   * False for the unattended batch importers, where a file is matched by a
   * digit or two in an account's name and nobody sees the result before it is
   * written. Those runs still import the transactions (individually visible,
   * individually removable); they just do not get to redefine what the account
   * reconciles against on the strength of a guess.
   */
  destinationConfirmed: boolean;
}

/**
 * What this statement should do to the account's Bank Balance.
 *
 * The staleness rule is the point of the recorded date: last March's statement
 * must not overwrite a figure that is already newer, or reopening
 * Reconciliation would show a difference of several months' spending and
 * finalising would be worse than useless. Equal days are allowed to write —
 * re-importing the same statement then settles on the same figure instead of
 * depending on the order files were opened in.
 *
 * A recorded balance with no recorded date cannot be compared, so it is
 * written over: the alternative is refusing forever on accounts whose balance
 * predates the date column.
 */
export const planStatementBankBalance = (
  statementBalance: StatementBalance | undefined,
  account: BankBalanceRecord | null | undefined,
  options: StatementBankBalanceOptions
): StatementBankBalanceOutcome => {
  if (!account || !options.destinationConfirmed) {
    return { kind: 'none' };
  }
  if (
    !statementBalance ||
    !Number.isFinite(statementBalance.amount) ||
    !isIsoDay(statementBalance.dateAsOf)
  ) {
    return { kind: 'none' };
  }

  const recordedDate = account.bankBalanceDate;
  const recordedBalance = account.bankBalance;
  if (
    recordedBalance != null &&
    isIsoDay(recordedDate) &&
    recordedDate > statementBalance.dateAsOf
  ) {
    return { kind: 'stale', recordedDate, recordedBalance };
  }

  // Money never touches a float: the parsed amount is re-rounded through
  // Decimal so what reaches the column is exactly what will be compared.
  const amount = toNumber(toDecimal(statementBalance.amount));

  return {
    kind: 'set',
    updates: { bankBalance: amount, bankBalanceDate: statementBalance.dateAsOf },
    amount,
    dateAsOf: statementBalance.dateAsOf
  };
};
