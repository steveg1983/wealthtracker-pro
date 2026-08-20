import type { Account, Category, Transaction, TransactionSplit } from '../types';
import { toDecimal, type DecimalInstance } from './decimal';
import { buildCategoryKindLookup, classifyFlow } from './incomeExpense';
import { expandSplitTransactions } from './transactionSplits';
import { resolveEffectiveOpeningDates } from './openingDates';
import { counterpartyAccountId, transferCategoryAccounts } from './portfolioSummary';
import { dayOf } from './plWindow';

/**
 * PORTFOLIO PERFORMANCE, the way the industry measures it — both ways.
 *
 * The owner's brief (20 Aug), after researching how the big firms do it:
 * "We now need to bake in both MWR and TWR and allow the user the option on
 * which they want to view." The semantics are his, stated in the same
 * message, and each is pinned by a test:
 *
 *  - OPENING BALANCES ARE MONEY IN: a portfolio's (or its cash sleeve's)
 *    opening balance is a contribution on its EFFECTIVE date
 *    (utils/openingDates — the same resolution the net-worth walk uses), not
 *    growth the portfolio can claim credit for.
 *  - TRANSFERS ACROSS THE BOUNDARY ARE FLOWS: money moved between a member
 *    account and any account OUTSIDE the scope — including an external
 *    account paying into the pair's cash sleeve — is an addition or a
 *    withdrawal. Transfers BETWEEN members (fund ↔ its own settlement cash)
 *    are internal and touch nothing. The boundary rule is portfolioSummary's
 *    own (counterpartyAccountId), one definition for both surfaces. A
 *    transfer leg whose other side nothing identifies is counted as EXTERNAL
 *    — a contribution that lost its link is still a contribution.
 *  - EVERYTHING ELSE IS PERFORMANCE: the owner's periodic "account
 *    adjustment" / market revaluation rows, dividends and interest arriving
 *    inside, fees charged inside — they are what the money DID once there.
 *    Nothing here needs to enumerate them: they move the VALUATION walk and
 *    are absent from the flow list, which is the definition of performance.
 *
 * VALUATION IS THE LEDGER: the owner keeps his portfolios marked to market
 * through those revaluation rows, so a member account's running balance IS
 * its value — no quotes, no estimates, and TWR is exact rather than
 * approximated. Flows are taken at END OF DAY (a day's performance happens
 * before its flow), the one convention this file needs and states.
 *
 * THE TWO MEASURES (see the 20 Aug research summary):
 *  - TWR chains sub-period growth between flows — the manager's figure, what
 *    GIPS requires firms to advertise, blind to flow timing.
 *  - MWR is the internal rate of return of the flows against the ending
 *    value — the investor's own experience, where timing counts.
 *  Both are computed in Decimal end to end (fractional powers included):
 *  these are REPORTED FINANCIAL FIGURES, not chart geometry.
 *
 * Honesty at the edges: a measure that cannot be taken is null, never 0% —
 * TWR while the portfolio's value is not positive has no meaningful ratio
 * (the chain restarts at the first funding instead, as statements do), and
 * MWR with no capital ever at work has nothing to solve.
 */

export interface PortfolioPerformanceInput {
  /** The scope: one pair's members, or every pair's for the whole portfolio. */
  memberAccounts: readonly Account[];
  transactions: readonly Transaction[];
  transactionSplits: readonly TransactionSplit[];
  categories: readonly Category[];
  /** Null/undefined bounds mean "from the beginning" / "until now". */
  range: { from?: Date | null; to?: Date | null };
  now?: Date;
}

export interface PortfolioPerformance {
  /** Value at the end of the day before the window — 0 for an unbounded start. */
  startValue: DecimalInstance;
  endValue: DecimalInstance;
  /** Contributions into the scope during the window (positive). */
  moneyIn: DecimalInstance;
  /** Withdrawals out of the scope during the window (positive). */
  moneyOut: DecimalInstance;
  /** moneyIn − moneyOut. */
  netFlows: DecimalInstance;
  /** endValue − startValue − netFlows: what the portfolio earned or lost. */
  gain: DecimalInstance;
  /** Time-weighted return over the window, as a fraction (0.05 = +5%). */
  twrPeriod: DecimalInstance | null;
  twrAnnualised: DecimalInstance | null;
  /** Money-weighted return over the window, as a fraction. */
  mwrPeriod: DecimalInstance | null;
  /** The IRR itself — MWR is annualised by construction. */
  mwrAnnualised: DecimalInstance | null;
  /** External flows inside the window (days with flows, after netting). */
  flowCount: number;
  days: number;
}

const ZERO = toDecimal(0);
const ONE = toDecimal(1);
const DAYS_PER_YEAR = toDecimal('365.25');

/** Local day string → a comparable time (UTC midnight of that day). */
const dayTime = (day: string): number => Date.parse(`${day}T00:00:00Z`);

export function computePortfolioPerformance(input: PortfolioPerformanceInput): PortfolioPerformance {
  const { memberAccounts, transactions, transactionSplits, categories, range } = input;
  const now = input.now ?? new Date();

  const memberIds = new Set(memberAccounts.map(a => a.id));
  const memberTransactions = transactions.filter(t => memberIds.has(t.accountId));

  /**
   * Every event that moves the scope's value, by local day:
   * value[d] = the day's total change; flow[d] = the external part of it.
   */
  const valueByDay = new Map<string, DecimalInstance>();
  const flowByDay = new Map<string, DecimalInstance>();
  const bump = (map: Map<string, DecimalInstance>, day: string, amount: DecimalInstance): void => {
    map.set(day, (map.get(day) ?? ZERO).plus(amount));
  };

  // Opening balances: money in, on their effective date. An account with no
  // datable signal seeds at time-zero — before any window can start, so it
  // reaches startValue and is never a window flow (the net-worth walk's rule).
  const openingDates = resolveEffectiveOpeningDates([...memberAccounts], [...memberTransactions]);
  const TIME_ZERO = '0000-01-01';
  for (const account of memberAccounts) {
    const opening = toDecimal(account.openingBalance ?? 0);
    if (opening.isZero()) continue;
    const effective = openingDates.get(account.id);
    const day = effective === undefined ? TIME_ZERO : dayOf(effective);
    bump(valueByDay, day, opening);
    if (effective !== undefined) bump(flowByDay, day, opening);
  }

  const categoryKinds = buildCategoryKindLookup([...categories]);
  const categoryAccounts = transferCategoryAccounts(categories);
  const memberRows = expandSplitTransactions([...memberTransactions], [...transactionSplits]);
  const transactionsById: ReadonlyMap<string, Transaction> = memberRows.length > 0
    ? new Map(transactions.map(t => [t.id, t]))
    : new Map();

  for (const row of memberRows) {
    const day = dayOf(row.date);
    const amount = toDecimal(row.amount);
    bump(valueByDay, day, amount);
    if (classifyFlow(row, categoryKinds) !== 'transfer') continue;
    const other = counterpartyAccountId(row, transactionsById, categoryAccounts);
    // Membership, not pair-equality: for a whole-portfolio scope a transfer
    // between two pairs is internal to the whole. Unidentified = external.
    if (other !== undefined && memberIds.has(other)) continue;
    bump(flowByDay, day, amount);
  }

  const days = [...valueByDay.keys()].sort();
  const fromDay = range.from ? dayOf(range.from) : null;
  const toDay = dayOf(range.to ?? now);

  /** Value at the END of `day` (inclusive walk). */
  let running = ZERO;
  const valueAtEndOf = new Map<string, DecimalInstance>();
  for (const day of days) {
    running = running.plus(valueByDay.get(day) ?? ZERO);
    valueAtEndOf.set(day, running);
  }
  const valueAsOf = (day: string): DecimalInstance => {
    // Last event day ≤ day. The list is sorted and short; linear is honest.
    let value = ZERO;
    for (const eventDay of days) {
      if (eventDay > day) break;
      value = valueAtEndOf.get(eventDay) ?? value;
    }
    return value;
  };

  const dayBefore = (day: string): string => dayOf(new Date(dayTime(day) - 86_400_000));

  const startValue = fromDay === null ? ZERO : valueAsOf(dayBefore(fromDay));
  const endValue = valueAsOf(toDay);

  const inWindow = (day: string): boolean =>
    (fromDay === null || day >= fromDay) && day <= toDay && day !== TIME_ZERO;

  const flowDays = [...flowByDay.keys()].filter(inWindow).sort();
  let moneyIn = ZERO;
  let moneyOut = ZERO;
  for (const day of flowDays) {
    const flow = flowByDay.get(day) ?? ZERO;
    if (flow.greaterThan(0)) moneyIn = moneyIn.plus(flow);
    else moneyOut = moneyOut.plus(flow.abs());
  }
  const netFlows = moneyIn.minus(moneyOut);
  const gain = endValue.minus(startValue).minus(netFlows);

  const startTime = fromDay === null ? (days.length > 0 ? dayTime(days.find(d => d !== TIME_ZERO) ?? toDay) : dayTime(toDay)) : dayTime(fromDay);
  const windowDays = Math.max(0, Math.round((dayTime(toDay) - startTime) / 86_400_000));
  const years = toDecimal(windowDays).dividedBy(DAYS_PER_YEAR);

  // ── TWR: chain the growth between flows, flows at end of day ─────────────
  // A chain link needs a positive base; while the scope holds nothing the
  // chain RESTARTS at the next funding (a brand-new portfolio's day-one
  // contribution is not a 0 → £1m return). A non-positive value between real
  // links is unmeasurable, and says so as null.
  let twrPeriod: DecimalInstance | null = ONE;
  let base = startValue;
  for (const day of flowDays) {
    if (twrPeriod === null) break;
    const flow = flowByDay.get(day) ?? ZERO;
    const valueEnd = valueAsOf(day);
    const valueBeforeFlow = valueEnd.minus(flow);
    if (base.greaterThan(0)) {
      if (valueBeforeFlow.lessThanOrEqualTo(0)) {
        twrPeriod = null;
        break;
      }
      twrPeriod = twrPeriod.times(valueBeforeFlow.dividedBy(base));
    }
    base = valueEnd;
  }
  if (twrPeriod !== null) {
    if (base.greaterThan(0)) {
      // The ordinary ending: one last stretch from the final flow to the
      // window's end. A scope driven to nothing-or-below has no ratio.
      twrPeriod = endValue.greaterThan(0)
        ? twrPeriod.times(endValue.dividedBy(base)).minus(ONE)
        : null;
    } else if (endValue.minus(base).isZero()) {
      // The scope emptied at its last flow (fully withdrawn) and stayed
      // empty: the chain measured everything that happened while money was
      // at work, and that measurement stands. A chain with NO links means
      // nothing was ever at work — null, never 0%.
      twrPeriod = twrPeriod.equals(ONE) ? null : twrPeriod.minus(ONE);
    } else {
      // Value moved while the base was not positive — no ratio exists.
      twrPeriod = null;
    }
  }

  const twrAnnualised = twrPeriod !== null && years.greaterThan(0) && twrPeriod.greaterThan(-1)
    ? ONE.plus(twrPeriod).toPower(ONE.dividedBy(years)).minus(ONE)
    : null;

  // ── MWR: the IRR of (startValue + flows) against endValue ────────────────
  // Solve Σ cf·(1+r)^yearsRemaining = endValue by bisection. Every cash flow
  // compounds over the time it was actually at work — the investor's figure.
  const cashflows: Array<{ amount: DecimalInstance; yearsRemaining: DecimalInstance }> = [];
  if (!startValue.isZero()) {
    cashflows.push({ amount: startValue, yearsRemaining: years });
  }
  for (const day of flowDays) {
    const flow = flowByDay.get(day) ?? ZERO;
    if (flow.isZero()) continue;
    cashflows.push({
      amount: flow,
      yearsRemaining: toDecimal(Math.max(0, dayTime(toDay) - dayTime(day)))
        .dividedBy(86_400_000)
        .dividedBy(DAYS_PER_YEAR),
    });
  }

  let mwrAnnualised: DecimalInstance | null = null;
  const capitalIn = cashflows.reduce(
    (sum, cf) => (cf.amount.greaterThan(0) ? sum.plus(cf.amount) : sum),
    ZERO
  );
  if (cashflows.length > 0 && capitalIn.greaterThan(0) && years.greaterThan(0)) {
    const terminal = (rate: DecimalInstance): DecimalInstance =>
      cashflows.reduce(
        (sum, cf) => sum.plus(cf.amount.times(ONE.plus(rate).toPower(cf.yearsRemaining))),
        ZERO
      );
    let low = toDecimal('-0.9999');
    let high = toDecimal(10);
    const fLow = terminal(low).minus(endValue);
    const fHigh = terminal(high).minus(endValue);
    // Same sign at both ends = no rate explains the outcome (all capital
    // gone, or growth beyond the bracket): unmeasurable, said as null.
    if (fLow.isNegative() !== fHigh.isNegative()) {
      for (let i = 0; i < 200; i++) {
        const mid = low.plus(high).dividedBy(2);
        const fMid = terminal(mid).minus(endValue);
        if (fMid.isNegative() === fLow.isNegative()) low = mid;
        else high = mid;
      }
      mwrAnnualised = low.plus(high).dividedBy(2);
    }
  }

  const mwrPeriod = mwrAnnualised !== null
    ? ONE.plus(mwrAnnualised).toPower(years).minus(ONE)
    : null;

  return {
    startValue,
    endValue,
    moneyIn,
    moneyOut,
    netFlows,
    gain,
    twrPeriod,
    twrAnnualised,
    mwrPeriod,
    mwrAnnualised,
    flowCount: flowDays.length,
    days: windowDays,
  };
}
