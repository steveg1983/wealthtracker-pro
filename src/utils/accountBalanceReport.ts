import type { Account, Transaction } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';
import { dailyFactorLookup, type NetWorthConversion } from './netWorthSeries';
import { toDecimal, type DecimalInstance } from './decimal';
import { resolveEffectiveOpeningDates } from './openingDates';
import { buildChildrenByParent } from './accountNesting';

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
  /**
   * The investment valuation's movement across the period (slice 3b): what
   * the account's open positions gained or lost at market beyond their
   * pooled cost. NOT cash — the row identity is
   * opening + change + marketChange = closing, and this is the third term.
   * Zero for every non-investment row and whenever no valuation is passed.
   */
  marketChange: number;
  /** Balance at the end of the period — ledger plus the valuation term. */
  closing: number;
  /**
   * The display-currency figures the group and report totals sum — equal to
   * the native ones when nothing converted. The row's own printed figures
   * stay native, in the account's own currency.
   */
  openingConverted: number;
  changeConverted: number;
  marketChangeConverted: number;
  closingConverted: number;
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
  /** Σ rows' converted market movement — zero unless a valuation is passed. */
  marketChange: number;
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
  /**
   * The period's market revaluation across every investment position — the
   * "of which" beside `change`, which deliberately stays cash movements.
   */
  marketChange: number;
  /** The date the closing balances are stated at. */
  asOf: Date;
  /** True when any conversion factor was applied — the ≈ gate. */
  holdsForeign: boolean;
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

/**
 * Which side a TYPE would normally land on — not which side its balance
 * actually puts it on, which is always the sign's business.
 *
 * The two differ more often than one would guess, and that is the point: an
 * overdrawn current account is asset-typed and owed, an overpaid credit card
 * is liability-typed and owned. The reports use this ONLY to say why a row
 * has moved (Design §1.1, 25 Aug); nothing here classifies money.
 *
 * `null` for 'other', which implies no side, so a row of that type is never
 * described as having moved anywhere.
 */
export type AccountSide = 'asset' | 'liability';

const SIDE_OF_TYPE: Partial<Record<Account['type'], AccountSide>> = {
  current: 'asset', checking: 'asset', savings: 'asset',
  investment: 'asset', asset: 'asset', assets: 'asset',
  credit: 'liability', loan: 'liability',
  mortgage: 'liability', liability: 'liability',
};

export const sideOfType = (type: Account['type']): AccountSide | null =>
  SIDE_OF_TYPE[type] ?? null;

/**
 * The word for a row sitting on the side its TYPE does not imply — the
 * labelling that survived Design's own reversal on sign-vs-type (25 Aug).
 *
 * It was proposed to explain why a row sat on the *unexpected* side. Under
 * sign-based classification — which is correct, because a balance sheet
 * states claims rather than product categories — its job inverts: it explains
 * why a row has MOVED. A reader looking for their current account under what
 * you own, and not finding it, needs the row itself to say why it is on the
 * other side.
 *
 * Null when the row is where its type implies, because then there is nothing
 * to explain and a label would be noise on every row in the report.
 */
export function movedSideLabel(type: Account['type'], closing: number): string | null {
  const side = sideOfType(type);
  if (side === null || closing === 0) return null;
  if (side === 'asset' && closing < 0) return 'overdrawn';
  if (side === 'liability' && closing > 0) return 'in credit';
  return null;
}

/**
 * Where a band sits in the report.
 *
 * "Loans in" takes the place Loans held, among the bands of things you owe.
 * "Loans out" sorts up with the asset bands instead, because that is what
 * Design's "under what you own" means in a report that has no such heading to
 * put it under: the band ORDER is this report's only way of agreeing with the
 * two headline figures, so the asset half of a split loan band belongs beside
 * the other assets rather than filed under debts by an accident of type.
 */
const orderOfLabel = (label: string): number => {
  if (label === 'Loans in') return TYPE_LABELS.findIndex(entry => entry.label === 'Loans');
  // Immediately after the last asset band, before the first liability one.
  if (label === 'Loans out') return TYPE_LABELS.findIndex(entry => entry.label === 'Credit cards') - 0.5;
  const index = TYPE_LABELS.findIndex(entry => entry.label === label);
  return index === -1 ? TYPE_LABELS.length : index;
};

interface Accumulator {
  opening: ReturnType<typeof toDecimal>;
  moneyIn: ReturnType<typeof toDecimal>;
  moneyOut: ReturnType<typeof toDecimal>;
  /** The same three in the display currency (equal when nothing converted). */
  openingConverted: ReturnType<typeof toDecimal>;
  moneyInConverted: ReturnType<typeof toDecimal>;
  moneyOutConverted: ReturnType<typeof toDecimal>;
  count: number;
}

const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * WHICH rates value the closing balances (Design ruling, 24 Aug §1, refined
 * by the owner the same night): a net worth is a snapshot AS AT the
 * statement's own date.
 *
 * As at TODAY — every default period — that is today's rates, the very
 * factors the Accounts page converts with, so the two surfaces give one
 * answer to "what am I worth". As at a PAST day (a custom range ending
 * there), it is that day's ECB reference rate — wealth held in dollars in
 * 2015 values at 2015's rate, never restated by today's. Degraded (no
 * history), today's rates stand in and the basis line says so.
 *
 * One exported rule, because two report pages call it and they may not
 * disagree about the same money.
 */
export function resolveClosingSnapshot(
  range: PeriodRange,
  now: Date,
  conversion: NetWorthConversion | null,
  conversionAt: ((date: Date) => NetWorthConversion | null) | null
): NetWorthConversion | null {
  if (range.to && dayKeyOf(range.to) < dayKeyOf(now)) {
    return conversionAt?.(range.to) ?? conversion;
  }
  return conversion;
}

export function buildAccountBalanceReport(
  accounts: Account[],
  transactions: Transaction[],
  range: PeriodRange,
  now: Date = new Date(),
  /**
   * The dated conversion seam (the balance reports' conversion, 23 Aug).
   * Movements convert on the identity's own terms: each movement at ITS OWN
   * day's rate, the opening column at the day the window opens (each lump at
   * its own effective day on an all-time window). Rows stay native — they
   * print their account's own currency — and only the group and report
   * totals wear the converted figures. Omitted, every figure is exactly what
   * it always was.
   */
  conversionAt?: (date: Date) => NetWorthConversion | null,
  /**
   * TODAY'S-rates factors for the CLOSING figures (Design ruling, 24 Aug §1):
   * a net worth is a snapshot, and two surfaces one click apart were giving
   * two authoritative answers to "what am I worth" — Accounts at today's
   * rates, this report's closings at each day's. One basis for the snapshot
   * everywhere: pass the same today's-rates conversion the Accounts card
   * uses and every converted closing (row, group total, assets/liabilities/
   * net worth) values the native closing at it. The identity argument keeps
   * the movement columns — which is where it was always aimed — so
   * `opening + change` and `closing` may differ in converted terms by
   * exactly the FX drift on held money; the caller's basis line states the
   * two bases. Omitted, closings keep the identity construction.
   */
  snapshot?: NetWorthConversion | null,
  /**
   * The investment valuation term (slice 3b, buildInvestmentValuation): what
   * an account's open positions are worth on a day beyond their pooled cost,
   * in the account's NATIVE currency. Openings and closings gain the day's
   * term; the difference across the window is the row's `marketChange` —
   * movement-basis, like the money columns. Omitted, every figure is exactly
   * what it always was.
   */
  investmentDeltaAt?: (accountId: string, day: string) => DecimalInstance
): AccountBalanceReport {
  const asOf = range.to ?? now;
  const fromTime = range.from ? range.from.getTime() : null;
  const toTime = asOf.getTime();
  const factorFor = dailyFactorLookup(conversionAt);
  const openingBasisDay = fromTime !== null ? dayKeyOf(new Date(fromTime - 86_400_000)) : null;
  let holdsForeign = false;
  const convert = (accountId: string, day: string, amount: DecimalInstance): DecimalInstance => {
    const factor = factorFor(accountId, day);
    if (factor === null) return amount;
    holdsForeign = true;
    return amount.times(factor);
  };

  const openingDates = resolveEffectiveOpeningDates(accounts, transactions);
  const totals = new Map<string, Accumulator>();
  for (const account of accounts) {
    totals.set(account.id, {
      opening: toDecimal(0),
      moneyIn: toDecimal(0),
      moneyOut: toDecimal(0),
      openingConverted: toDecimal(0),
      moneyInConverted: toDecimal(0),
      moneyOutConverted: toDecimal(0),
      count: 0,
    });
  }

  // An opening balance folds into the column that matches WHEN it takes effect:
  // effective before the window (or an open-started window, whose "opening" IS
  // the all-time start) → the opening balance; effective inside the window →
  // period movement (money appearing), so net worth before the account's real
  // opening date is no longer overstated in the opening column; effective after
  // the as-of date → nothing yet. An undated lump (rung 4) counts from the
  // beginning of time, as before.
  for (const account of accounts) {
    const accumulator = totals.get(account.id);
    if (!accumulator) continue;
    const opening = toDecimal(account.openingBalance ?? 0);
    if (opening.isZero()) continue;
    const eff = openingDates.get(account.id);
    const effTime = eff ? eff.getTime() : null; // null = beginning of time (rung 4)
    if (effTime !== null && effTime > toTime) continue; // not yet effective
    const insideWindow = fromTime !== null && effTime !== null && effTime >= fromTime;
    if (insideWindow) {
      const converted = convert(account.id, dayKeyOf(new Date(effTime)), opening);
      if (opening.greaterThanOrEqualTo(0)) {
        accumulator.moneyIn = accumulator.moneyIn.plus(opening);
        accumulator.moneyInConverted = accumulator.moneyInConverted.plus(converted);
      } else {
        accumulator.moneyOut = accumulator.moneyOut.plus(opening.abs());
        accumulator.moneyOutConverted = accumulator.moneyOutConverted.plus(converted.abs());
      }
    } else {
      // The opening column values at the day the window opens; on an
      // all-time window, at each lump's own effective day (the epoch's
      // earliest rate carries back for the undated).
      const basisDay = openingBasisDay
        ?? (effTime !== null ? dayKeyOf(new Date(effTime)) : '1999-01-04');
      accumulator.opening = accumulator.opening.plus(opening);
      accumulator.openingConverted = accumulator.openingConverted.plus(convert(account.id, basisDay, opening));
    }
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
      accumulator.openingConverted = accumulator.openingConverted.plus(
        convert(transaction.accountId, openingBasisDay ?? dayKeyOf(new Date(time)), amount)
      );
      continue;
    }
    accumulator.count += 1;
    const converted = convert(transaction.accountId, dayKeyOf(new Date(time)), amount);
    if (amount.greaterThanOrEqualTo(0)) {
      accumulator.moneyIn = accumulator.moneyIn.plus(amount);
      accumulator.moneyInConverted = accumulator.moneyInConverted.plus(converted);
    } else {
      accumulator.moneyOut = accumulator.moneyOut.plus(amount.abs());
      accumulator.moneyOutConverted = accumulator.moneyOutConverted.plus(converted.abs());
    }
  }

  const rows: AccountBalanceRow[] = accounts.map(account => {
    const accumulator = totals.get(account.id) ?? {
      opening: toDecimal(account.openingBalance ?? 0),
      moneyIn: toDecimal(0),
      moneyOut: toDecimal(0),
      openingConverted: toDecimal(account.openingBalance ?? 0),
      moneyInConverted: toDecimal(0),
      moneyOutConverted: toDecimal(0),
      count: 0,
    };
    const change = accumulator.moneyIn.minus(accumulator.moneyOut);
    const changeConverted = accumulator.moneyInConverted.minus(accumulator.moneyOutConverted);

    // The valuation term: the day-before-the-window's delta joins the
    // opening, the as-of day's joins the closing, and their difference is
    // the row's market movement — so opening + change + marketChange =
    // closing holds exactly. An all-time window opens before any position
    // existed, so its opening delta is zero by construction.
    const openingDelta = investmentDeltaAt !== undefined && openingBasisDay !== null
      ? investmentDeltaAt(account.id, openingBasisDay)
      : toDecimal(0);
    const closingDelta = investmentDeltaAt !== undefined
      ? investmentDeltaAt(account.id, dayKeyOf(asOf))
      : toDecimal(0);
    const marketChange = closingDelta.minus(openingDelta);
    const openingDeltaConverted = openingDelta.isZero() || openingBasisDay === null
      ? openingDelta
      : convert(account.id, openingBasisDay, openingDelta);
    const closingDeltaConverted = closingDelta.isZero()
      ? closingDelta
      : convert(account.id, dayKeyOf(asOf), closingDelta);
    const marketChangeConverted = closingDeltaConverted.minus(openingDeltaConverted);

    const opening = accumulator.opening.plus(openingDelta);
    const openingConverted = accumulator.openingConverted.plus(openingDeltaConverted);
    const closing = opening.plus(change).plus(marketChange);
    // The snapshot basis (see the parameter): the native closing valued at
    // today's rates — the Accounts card's own factors — so every surface
    // answers "what is this worth" with one number. Without a snapshot the
    // closing keeps the identity construction.
    const snapshotFactor = snapshot?.factors.get(account.id);
    let closingConverted: DecimalInstance;
    if (snapshot === undefined) {
      closingConverted = openingConverted.plus(changeConverted).plus(marketChangeConverted);
    } else if (snapshotFactor) {
      holdsForeign = true;
      closingConverted = closing.times(snapshotFactor);
    } else {
      closingConverted = closing;
    }
    return {
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      opening: opening.toNumber(),
      moneyIn: accumulator.moneyIn.toNumber(),
      moneyOut: accumulator.moneyOut.toNumber(),
      change: change.toNumber(),
      marketChange: marketChange.toNumber(),
      closing: closing.toNumber(),
      openingConverted: openingConverted.toNumber(),
      changeConverted: changeConverted.toNumber(),
      marketChangeConverted: marketChangeConverted.toNumber(),
      closingConverted: closingConverted.toNumber(),
      count: accumulator.count,
    };
  });

  /*
   * A NESTED ACCOUNT IS FILED WHERE ITS PARENT IS (owner, 25 Aug).
   *
   * The Accounts page has always nested a cash sleeve inside its investment
   * and counted it toward that band — accountNesting's own header calls its
   * rules "the whole answer to where does this account's money belong, so
   * two pages can never disagree about what a paired account is worth". This
   * report never asked it, and grouped by the row's own type. So a cash
   * sleeve inside a portfolio appeared under Current accounts and inflated
   * that total, while the same account sat inside Investments one page over.
   * Same money, two homes, and the reader had no way to tell which was the
   * lie.
   *
   * The parent must be present in the set to count — accountNesting's first
   * invariant, and the reason this uses the same resolution rather than
   * reading parentAccountId directly: on a window whose accounts exclude the
   * parent, the child falls back to its own type rather than into a band
   * that is not being drawn.
   */
  const childrenByParent = buildChildrenByParent(accounts);
  const parentTypeOf = new Map<string, Account['type']>();
  for (const [parentId, children] of childrenByParent) {
    const parent = accounts.find(a => a.id === parentId);
    if (!parent) continue;
    for (const child of children) parentTypeOf.set(child.id, parent.type);
  }

  /*
   * THE LOANS BAND SPLITS BY SIDE (Design §2.1, ruled 24 Aug, confirmed 25th).
   *
   * The headline splits by SIGN — "In credit" against "Overdrawn / owed" —
   * while the bands group by TYPE and net within themselves. Where a band
   * holds both signs, its one total contradicts the two figures above it: a
   * reader sees a loan counted as an asset up there and netted away down
   * here, with nothing to say which reading is the real one.
   *
   * Loans are where this actually bites, because the two signs are two
   * different PRODUCTS rather than one product in two states. A loan you made
   * is money owed to you; a loan you took is money you owe. "Loans" is the
   * only band label in the app that names both without distinguishing them —
   * an overdrawn current account is still a current account, and Design's
   * §1.1 row labelling is the answer for that case.
   *
   * Split ONLY when both signs are present. A ledger with borrowings alone
   * has no contradiction to resolve, and "Loans in" as the sole band would be
   * a distinction drawn against nothing.
   */
  const groupKeyOf = (row: AccountBalanceRow): string =>
    labelOfType(parentTypeOf.get(row.accountId) ?? row.type);

  const loanRows = rows.filter(row => groupKeyOf(row) === 'Loans');
  const loansHoldBothSides =
    loanRows.some(row => row.closing > 0) && loanRows.some(row => row.closing < 0);

  const byLabel = new Map<string, AccountBalanceRow[]>();
  for (const row of rows) {
    const base = groupKeyOf(row);
    // A zero-balance loan sits with the borrowings: it is a loan you took and
    // have cleared, not a loan you made. Filing it as an asset would put a
    // settled debt under what you own.
    const label = base === 'Loans' && loansHoldBothSides
      ? (row.closing > 0 ? 'Loans out' : 'Loans in')
      : base;
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
      // Totals sum the CONVERTED figures — the rows above them stay native
      // in their own currencies, exactly as everywhere else in the app.
      return {
        key: label,
        label,
        rows: sorted,
        opening: sum(row => row.openingConverted),
        change: sum(row => row.changeConverted),
        marketChange: sum(row => row.marketChangeConverted),
        closing: sum(row => row.closingConverted),
      };
    })
    .sort((a, b) => orderOfLabel(a.label) - orderOfLabel(b.label));

  let assets = toDecimal(0);
  let liabilities = toDecimal(0);
  let openingNetWorth = toDecimal(0);
  let netWorth = toDecimal(0);
  let periodChange = toDecimal(0);
  let periodMarketChange = toDecimal(0);
  for (const row of rows) {
    const closing = toDecimal(row.closingConverted);
    if (closing.greaterThan(0)) assets = assets.plus(closing);
    else liabilities = liabilities.plus(closing.abs());
    netWorth = netWorth.plus(closing);
    openingNetWorth = openingNetWorth.plus(toDecimal(row.openingConverted));
    periodChange = periodChange.plus(toDecimal(row.changeConverted));
    periodMarketChange = periodMarketChange.plus(toDecimal(row.marketChangeConverted));
  }

  return {
    rows,
    groups,
    assets: assets.toNumber(),
    liabilities: liabilities.toNumber(),
    netWorth: netWorth.toNumber(),
    openingNetWorth: openingNetWorth.toNumber(),
    holdsForeign,
    // The period's MOVEMENTS on their own per-day basis — never derived as
    // netWorth − opening, which would mix the snapshot basis into a flow
    // figure. Identity mode makes the two formulas equal exactly.
    change: periodChange.toNumber(),
    marketChange: periodMarketChange.toNumber(),
    asOf,
  };
}
