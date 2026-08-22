import type { Account, Category, Transaction, TransactionSplit } from '../types';
import { toDecimal, sumDecimals, type DecimalInstance } from './decimal';
import { toDecimalAccount, toDecimalTransaction } from './decimal-converters';
import { calculateTotalBalance } from './calculations-decimal';
import { buildTopLevelIdByAccountId, groupByTopLevelId } from './accountNesting';
import { buildCategoryKindLookup, classifyFlow } from './incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from './transactionSplits';
import { buildNetWorthSnapshots, type NetWorthConversion, type NetWorthConversionByDate } from './netWorthSeries';
import type { PeriodRange } from '../hooks/usePeriod';

/**
 * What a portfolio is worth, and what of that the owner actually put in.
 *
 * THE PORTFOLIO IS THE PAIR, NOT THE SECURITIES ACCOUNT (the Microsoft Money
 * model). A brokerage account and its settlement cash are one holding to the
 * person who owns them: money sitting in the cash side is money that has not
 * left the portfolio, so a value that omits it drops to zero the moment
 * everything is sold. Every figure here therefore runs over the investment
 * account TOGETHER WITH every account nested inside it (Account.parentAccountId
 * — see utils/accountNesting), and each account is counted in exactly one line.
 *
 * Value is the ledger figure — opening balance plus the account's transactions,
 * Decimal throughout — not the cached `balance` column, so the page agrees with
 * the Accounts page and the net-worth report to the penny.
 */

/** One nested account inside a portfolio line. */
export interface PortfolioCashLine {
  accountId: string;
  /**
   * 'Cash' for the parent's own "<Name> (Cash)" account (what the importer
   * creates and what the Accounts page prints), otherwise the account's name —
   * printing "Fund ISA (Cash)" underneath "Fund ISA" says the same word twice.
   */
  label: string;
  value: DecimalInstance;
}

/**
 * One external transfer, as the drill-down shows it — the rows that MAKE UP a
 * line's `netContributions`. Kept because the owner clicked a figure of
 * (£40,759.08), followed the account link, and landed on an empty register:
 * the money had moved through the pair's cash sleeve, so "which account is
 * this" and "where did this figure come from" had different answers. These
 * are the second answer.
 */
export interface ContributionRow {
  transactionId: string;
  /** The MEMBER account the row sits on — often the cash sleeve, not the root. */
  accountId: string;
  date: Date;
  description: string;
  amount: DecimalInstance;
}

/** One row of the Holdings list, and one slice of the allocation donut. */
export interface PortfolioLine {
  accountId: string;
  name: string;
  /** Secondary line of the row; empty when the account names no institution. */
  institution: string;
  /** The investment account plus everything nested inside it. */
  value: DecimalInstance;
  /** The nested part of `value`, itemised. Empty when nothing is paired. */
  cash: PortfolioCashLine[];
  /** Share of the whole portfolio, 0–100. Zero when the portfolio is worth nothing. */
  allocation: DecimalInstance;
  /**
   * This pair's share of `netContributions` — the same walk, attributed by the
   * MEMBER account each transfer row sits on, so the lines always sum to the
   * portfolio figure exactly. A transfer between two pairs counts −X on one
   * line and +X on the other, netting to zero across the list just as it does
   * in the total.
   */
  netContributions: DecimalInstance;
  /** value − netContributions, for this pair alone. The lines sum to the portfolio's. */
  totalReturn: DecimalInstance;
  /** The external transfers behind `netContributions`, newest first. */
  contributionRows: ContributionRow[];
}

/**
 * Transfer legs counted as external because nothing identifies their other
 * side. They are counted rather than dropped — a real contribution that lost
 * its link is still a contribution — so this is how much of
 * `netContributions` rests on that assumption.
 */
export interface UnattributedTransfers {
  count: number;
  /** Gross magnitude of those legs. */
  amount: DecimalInstance;
}

export interface PortfolioSummary {
  /** One row per top-level investment account, in the order given. */
  lines: PortfolioLine[];
  /** Every account counted: the investment accounts and everything nested in them. */
  memberAccounts: Account[];
  /** Total value of every line. */
  value: DecimalInstance;
  /**
   * NET EXTERNAL CONTRIBUTIONS: money transferred INTO the portfolio from
   * outside it, less money transferred back OUT. Signed, so a portfolio that
   * has paid out more than it took in reports a negative figure.
   *
   * Movements BETWEEN a pair's own accounts (selling a fund into its own
   * settlement cash) are not contributions and are excluded. Growth, dividends,
   * fees and revaluations are not contributions either — they are what the
   * money DID once inside, which is exactly why `totalReturn` can measure them.
   */
  netContributions: DecimalInstance;
  /** value − netContributions: everything the portfolio earned or lost. */
  totalReturn: DecimalInstance;
  /**
   * Return as a percentage of what was put in, or null when nothing was —
   * there is no such thing as a return on nothing, and printing "0.00%" for
   * it states a fact that was never measured.
   */
  returnPercent: DecimalInstance | null;
  unattributedTransfers: UnattributedTransfers;
}

export interface PortfolioSummaryInput {
  /** The accounts in view. Closed accounts are absent, so they nest nowhere. */
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  /** Split lines, so a transfer leg inside a split is classified as one. */
  transactionSplits: readonly TransactionSplit[];
  categories: readonly Category[];
}

const ZERO = toDecimal(0);

/** Category id → the account its "To/From <account>" filing names. */
export function transferCategoryAccounts(categories: readonly Category[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const category of categories) {
    if (category.isTransferCategory === true && category.accountId) {
      map.set(category.id, category.accountId);
    }
  }
  return map;
}

/**
 * The account on the other side of a transfer, or undefined when nothing says.
 *
 * Order follows resolveTransferOtherSide: the linked row's OWN accountId is
 * authoritative (transfer_account_id is denormalised and imported history
 * routinely carries a link with no denormalised account on one leg), then the
 * denormalised id, then the "To/From <account>" category the row is filed
 * under — which is how a hand-entered transfer names its target before the two
 * legs are ever linked.
 *
 * A SPLIT LINE gets the category alone: the virtual row inherits its parent's
 * link fields, which belong to the parent's own leg, not to this line's.
 *
 * EXPORTED for utils/portfolioPerformance, which must classify a transfer as
 * internal or external by exactly this rule — a second resolver would be two
 * definitions of one boundary waiting to drift apart.
 */
export function counterpartyAccountId(
  row: SplitExpandedTransaction,
  transactionsById: ReadonlyMap<string, Transaction>,
  categoryAccounts: ReadonlyMap<string, string>
): string | undefined {
  if (row.isSplitLine !== true) {
    const linked = row.linkedTransferId ? transactionsById.get(row.linkedTransferId) : undefined;
    if (linked) return linked.accountId;
    if (row.transferAccountId) return row.transferAccountId;
  }
  return categoryAccounts.get(row.category);
}

/**
 * The member accounts of every investment pair in `accounts` — the roots and
 * everything nested inside them, by the same walk the summary uses. Exported
 * for the PERFORMANCE scope, which must run over OPEN AND CLOSED accounts
 * alike: measured on the owner's ledger (20 Aug), the open-only scope read
 * his all-time contributions at less than half their true figure, because a
 * closed sleeve's transfers vanished and transfers TO it were misread as
 * money leaving the portfolio. Anything walking history needs the closed
 * accounts — the net-worth report's own lesson.
 */
export function investmentMemberAccounts(accounts: readonly Account[]): Account[] {
  const topLevelIdByAccountId = buildTopLevelIdByAccountId(accounts);
  const membersByTopLevelId = groupByTopLevelId(accounts, topLevelIdByAccountId);
  return accounts
    .filter(a => a.type === 'investment' && topLevelIdByAccountId.get(a.id) === a.id)
    .flatMap(root => membersByTopLevelId.get(root.id) ?? [root]);
}

export function buildPortfolioSummary(input: PortfolioSummaryInput): PortfolioSummary {
  const { accounts, transactions, transactionSplits, categories } = input;

  // Same walk the Accounts page uses, so a paired account lands in the same
  // place on both pages — and each account in exactly one line, even if a
  // paired cash account is later retyped 'investment' (it resolves to its
  // parent, so it is counted inside that line, never again beside it).
  const topLevelIdByAccountId = buildTopLevelIdByAccountId(accounts);
  const membersByTopLevelId = groupByTopLevelId(accounts, topLevelIdByAccountId);
  const roots = accounts.filter(
    a => a.type === 'investment' && topLevelIdByAccountId.get(a.id) === a.id
  );

  // A root is always in its own group (it resolves to itself), so the fallback
  // only satisfies the map's optional lookup.
  const membersOf = (root: Account): readonly Account[] =>
    membersByTopLevelId.get(root.id) ?? [root];

  const memberAccounts = roots.flatMap(membersOf);
  const memberIds = new Set(memberAccounts.map(a => a.id));

  const memberTransactions = transactions.filter(t => memberIds.has(t.accountId));
  const decimalTransactions = memberTransactions.map(toDecimalTransaction);

  const valueOf = (group: readonly Account[]): DecimalInstance =>
    calculateTotalBalance(group.map(toDecimalAccount), decimalTransactions);

  const lineValues = roots.map(root => {
    const members = membersOf(root);
    const nested = members.filter(m => m.id !== root.id);
    return {
      root,
      value: valueOf(members),
      cash: nested.map(child => ({
        accountId: child.id,
        label: child.name === `${root.name} (Cash)` ? 'Cash' : child.name,
        value: valueOf([child]),
      })),
    };
  });

  const value = sumDecimals(lineValues.map(l => l.value));
  const lines: PortfolioLine[] = lineValues.map(line => ({
    accountId: line.root.id,
    name: line.root.name,
    institution: line.root.institution ?? '',
    value: line.value,
    cash: line.cash,
    allocation: value.isZero() ? ZERO : line.value.dividedBy(value).times(100),
    // Filled in after the contributions walk below; ZERO until then so the
    // object is complete from birth.
    netContributions: ZERO,
    totalReturn: ZERO,
    contributionRows: [],
  }));

  // Contributions: transfer rows sitting on a member account whose other side
  // is NOT in the same pair. Amounts are signed, so money in and money out net
  // in one pass.
  const categoryKinds = buildCategoryKindLookup([...categories]);
  const categoryAccounts = transferCategoryAccounts(categories);
  const memberRows = expandSplitTransactions(memberTransactions, [...transactionSplits]);
  // A counterpart can sit in any account, so this indexes everything — but only
  // when there is something to look up. On a set with no investment accounts it
  // would be the largest allocation on the page, for nothing.
  const transactionsById: ReadonlyMap<string, Transaction> = memberRows.length > 0
    ? new Map(transactions.map(t => [t.id, t]))
    : new Map();

  let netContributions = ZERO;
  let unattributedCount = 0;
  let unattributedAmount = ZERO;
  // Per pair, for the drill-down: the same figures, attributed to the line the
  // row belongs to. Kept in the SAME loop so the split cannot drift from the
  // total — one classification, two aggregations.
  const contributionsByLine = new Map<string, DecimalInstance>();
  const contributionRowsByLine = new Map<string, ContributionRow[]>();
  for (const row of memberRows) {
    if (classifyFlow(row, categoryKinds) !== 'transfer') continue;
    const other = counterpartyAccountId(row, transactionsById, categoryAccounts);
    if (
      other !== undefined &&
      topLevelIdByAccountId.get(other) === topLevelIdByAccountId.get(row.accountId)
    ) {
      continue;
    }
    const amount = toDecimal(row.amount);
    netContributions = netContributions.plus(amount);
    const lineId = topLevelIdByAccountId.get(row.accountId) ?? row.accountId;
    contributionsByLine.set(lineId, (contributionsByLine.get(lineId) ?? ZERO).plus(amount));
    const rows = contributionRowsByLine.get(lineId) ?? [];
    rows.push({
      transactionId: row.id,
      accountId: row.accountId,
      date: row.date instanceof Date ? row.date : new Date(row.date),
      description: row.description ?? '',
      amount,
    });
    contributionRowsByLine.set(lineId, rows);
    if (other === undefined) {
      unattributedCount += 1;
      unattributedAmount = unattributedAmount.plus(amount.abs());
    }
  }

  const totalReturn = value.minus(netContributions);

  // Attach the split. Lines were built before the walk, so this closes the
  // shape rather than re-deriving anything.
  for (const line of lines) {
    const contributed = contributionsByLine.get(line.accountId) ?? ZERO;
    line.netContributions = contributed;
    line.totalReturn = line.value.minus(contributed);
    line.contributionRows = (contributionRowsByLine.get(line.accountId) ?? [])
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  return {
    lines,
    memberAccounts,
    value,
    netContributions,
    totalReturn,
    returnPercent: netContributions.greaterThan(0)
      ? totalReturn.dividedBy(netContributions).times(100)
      : null,
    unattributedTransfers: { count: unattributedCount, amount: unattributedAmount },
  };
}

/** One point of the portfolio's value over time. */
export interface PortfolioHistoryPoint {
  /** Axis label: a day for short windows, a month for long ones. */
  label: string;
  value: number;
  /** The point's own date — what the chart's per-date drill opens on. */
  date: Date;
}

/**
 * What the portfolio was ACTUALLY worth at each point in `range`: per-account
 * opening balance plus its transactions up to that date, summed over the pair.
 *
 * The net-worth walk does exactly this and already gets the hard parts right —
 * an opening balance folded in on its effective date rather than backdated to
 * the beginning of time, and a cadence that switches to month-end on long
 * windows. Its net worth of a set of accounts is the signed sum of their
 * balances, which for a portfolio is its value.
 */
export function buildPortfolioHistory(
  memberAccounts: readonly Account[],
  transactions: readonly Transaction[],
  range: PeriodRange,
  now: Date = new Date(),
  /**
   * The same conversion the net-worth surfaces pass (currency audit, 22 Aug):
   * this was the one caller of buildNetWorthSnapshots that kept summing a
   * foreign member's native units as display units after the walk learned to
   * convert. Dated, each point converts at its own day's reference rate.
   * Omitted, the single-currency portfolio behaves exactly as before.
   */
  conversion?: NetWorthConversion | NetWorthConversionByDate
): PortfolioHistoryPoint[] {
  const memberIds = new Set(memberAccounts.map(a => a.id));
  return buildNetWorthSnapshots(
    [...memberAccounts],
    transactions.filter(t => memberIds.has(t.accountId)),
    range,
    now,
    conversion
  ).map(point => ({ label: point.label, value: point.netWorth, date: point.date }));
}
