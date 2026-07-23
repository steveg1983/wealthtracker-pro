import type { Account, Transaction } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';
import { toDecimal } from './decimal';

/**
 * "Account balances" and "Net worth" — the two Microsoft Money statements,
 * from one set of figures so they can never disagree.
 *
 * Every balance is computed from first principles, exactly as the net-worth
 * chart does it: opening balance + cumulative transactions, Decimal
 * throughout. The stored `account.balance` is deliberately NOT used — it is a
 * cached figure, and a report that quietly mixed cached and computed money
 * would be impossible to reconcile.
 *
 * Assets vs liabilities follow the BALANCE's sign, not the account's type
 * (same rule as `buildNetWorthSnapshots`), so an overdrawn current account
 * counts as a liability while it is overdrawn.
 */

export interface AccountBalanceRow {
  accountId: string;
  name: string;
  type: Account['type'];
  currency: string;
  /** Balance the moment the period opened (all history before it). */
  opening: number;
  /** Money in / out DURING the period (positive magnitudes). */
  moneyIn: number;
  moneyOut: number;
  /** moneyIn − moneyOut. */
  change: number;
  /** Balance at the end of the period. */
  closing: number;
  /** Transactions inside the period. */
  count: number;
}

export interface AccountBalanceGroup {
  /** Stable key for the group (an account type). */
  key: string;
  label: string;
  rows: AccountBalanceRow[];
  opening: number;
  change: number;
  closing: number;
}

export interface AccountBalanceReport {
  rows: AccountBalanceRow[];
  groups: AccountBalanceGroup[];
  /** Sum of positive closing balances. */
  assets: number;
  /** Sum of negative closing balances, as a positive magnitude. */
  liabilities: number;
  netWorth: number;
  /** Net worth the moment the period opened, and the move since. */
  openingNetWorth: number;
  change: number;
  /** The date the closing balances are stated at. */
  asOf: Date;
}

/** Presentation order and wording for account types. */
const TYPE_LABELS: Array<{ key: Account['type']; label: string }> = [
  { key: 'current', label: 'Current accounts' },
  { key: 'checking', label: 'Current accounts' },
  { key: 'savings', label: 'Savings' },
  { key: 'investment', label: 'Investments' },
  { key: 'asset', label: 'Assets' },
  { key: 'assets', label: 'Assets' },
  { key: 'credit', label: 'Credit cards' },
  { key: 'loan', label: 'Loans' },
  { key: 'mortgage', label: 'Mortgages' },
  { key: 'liability', label: 'Liabilities' },
  { key: 'other', label: 'Other' },
];

const labelOfType = (type: Account['type']): string =>
  TYPE_LABELS.find(entry => entry.key === type)?.label ?? 'Other';

const orderOfLabel = (label: string): number => {
  const index = TYPE_LABELS.findIndex(entry => entry.label === label);
  return index === -1 ? TYPE_LABELS.length : index;
};

interface Accumulator {
  opening: ReturnType<typeof toDecimal>;
  moneyIn: ReturnType<typeof toDecimal>;
  moneyOut: ReturnType<typeof toDecimal>;
  count: number;
}

export function buildAccountBalanceReport(
  accounts: Account[],
  transactions: Transaction[],
  range: PeriodRange,
  now: Date = new Date()
): AccountBalanceReport {
  const asOf = range.to ?? now;
  const fromTime = range.from ? range.from.getTime() : null;
  const toTime = asOf.getTime();

  const totals = new Map<string, Accumulator>();
  for (const account of accounts) {
    totals.set(account.id, {
      opening: toDecimal(account.openingBalance ?? 0),
      moneyIn: toDecimal(0),
      moneyOut: toDecimal(0),
      count: 0,
    });
  }

  // One pass: everything before the window seeds the opening balance,
  // everything inside it is the period's movement, everything after is not
  // this report's business.
  for (const transaction of transactions) {
    const accumulator = totals.get(transaction.accountId);
    if (!accumulator) continue;
    const time = new Date(transaction.date).getTime();
    if (Number.isNaN(time) || time > toTime) continue;
    const amount = toDecimal(transaction.amount);
    if (fromTime !== null && time < fromTime) {
      accumulator.opening = accumulator.opening.plus(amount);
      continue;
    }
    accumulator.count += 1;
    if (amount.greaterThanOrEqualTo(0)) accumulator.moneyIn = accumulator.moneyIn.plus(amount);
    else accumulator.moneyOut = accumulator.moneyOut.plus(amount.abs());
  }

  const rows: AccountBalanceRow[] = accounts.map(account => {
    const accumulator = totals.get(account.id) ?? {
      opening: toDecimal(account.openingBalance ?? 0),
      moneyIn: toDecimal(0),
      moneyOut: toDecimal(0),
      count: 0,
    };
    const change = accumulator.moneyIn.minus(accumulator.moneyOut);
    return {
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      opening: accumulator.opening.toNumber(),
      moneyIn: accumulator.moneyIn.toNumber(),
      moneyOut: accumulator.moneyOut.toNumber(),
      change: change.toNumber(),
      closing: accumulator.opening.plus(change).toNumber(),
      count: accumulator.count,
    };
  });

  const byLabel = new Map<string, AccountBalanceRow[]>();
  for (const row of rows) {
    const label = labelOfType(row.type);
    const list = byLabel.get(label);
    if (list) list.push(row);
    else byLabel.set(label, [row]);
  }

  const groups: AccountBalanceGroup[] = [...byLabel.entries()]
    .map(([label, groupRows]) => {
      const sorted = [...groupRows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      const sum = (pick: (row: AccountBalanceRow) => number): number =>
        sorted.reduce((acc, row) => acc.plus(toDecimal(pick(row))), toDecimal(0)).toNumber();
      return {
        key: label,
        label,
        rows: sorted,
        opening: sum(row => row.opening),
        change: sum(row => row.change),
        closing: sum(row => row.closing),
      };
    })
    .sort((a, b) => orderOfLabel(a.label) - orderOfLabel(b.label));

  let assets = toDecimal(0);
  let liabilities = toDecimal(0);
  let openingNetWorth = toDecimal(0);
  let netWorth = toDecimal(0);
  for (const row of rows) {
    const closing = toDecimal(row.closing);
    if (closing.greaterThan(0)) assets = assets.plus(closing);
    else liabilities = liabilities.plus(closing.abs());
    netWorth = netWorth.plus(closing);
    openingNetWorth = openingNetWorth.plus(toDecimal(row.opening));
  }

  return {
    rows,
    groups,
    assets: assets.toNumber(),
    liabilities: liabilities.toNumber(),
    netWorth: netWorth.toNumber(),
    openingNetWorth: openingNetWorth.toNumber(),
    change: netWorth.minus(openingNetWorth).toNumber(),
    asOf,
  };
}
