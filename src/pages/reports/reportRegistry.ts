import { type ComponentType, type ElementType, type LazyExoticComponent } from 'react';
import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import {
  BarChart3Icon,
  CalendarIcon,
  FileTextIcon,
  LandmarkIcon,
  PieChartIcon,
  RepeatIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from '../../components/icons';
import type { PeriodKey } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';

/**
 * The report gallery — Microsoft Money's model: a named list of reports
 * grouped by the question they answer, not a row of tabs.
 *
 * Every report is addressable at /reports/<id>, so the Dashboard's pinned
 * reports, a bookmark and the back button all point at something stable. The
 * period picker lives at hub level (see ReportsHub) and is handed to each
 * report, so it PERSISTS as the user moves between them.
 */

export type ReportGroupId = 'what-i-have' | 'spending' | 'investments' | 'custom';

export interface ReportGroup {
  id: ReportGroupId;
  title: string;
  description: string;
  /**
   * What these reports LEAVE OUT, stated permanently under the heading.
   *
   * This lived in the gallery's dismissible tip. A rule that decides whether
   * the totals below are the whole story is not a tip — someone who dismissed
   * it once would read every spending figure afterwards as complete, and the
   * honesty about uncategorised rows is the thing this product is built on
   * (DESIGN_PASS_2026-08 §3.5).
   */
  note?: string;
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    id: 'what-i-have',
    title: 'What I have',
    description: 'Where you stand, and how you got there.',
  },
  {
    id: 'spending',
    title: 'Spending',
    description: 'Where the money goes, when it goes, and who it goes to.',
    note: 'A transaction with no category is left out of these totals, so nothing is counted under the wrong heading. Each report lists those rows for filing.',
  },
  {
    id: 'investments',
    title: 'Investments',
    description: 'What you hold, what it cost, and what it did.',
  },
  {
    id: 'custom',
    title: 'Custom reports',
    description: 'Reports you build yourself.',
  },
];

export interface ReportDefinition {
  /** Stable URL segment — never renamed once shipped. */
  id: string;
  title: string;
  description: string;
  group: ReportGroupId;
  icon: ElementType;
  /**
   * False for reports that own their own filtering (custom reports), which
   * hides the hub's period picker rather than showing an inert control.
   */
  usesPeriod: boolean;
  /**
   * The window this report is worth reading over — a trend over one month is
   * barely a trend. Applied ONLY until the user picks a period themselves;
   * from then on their choice follows them from report to report. Unset means
   * the hub's own default (this month).
   */
  defaultPeriod?: PeriodKey;
  /**
   * True when the report renders the hub's PeriodBar ITSELF, inside the card
   * the window governs (owner, 22 Aug: the net-worth chart carries its
   * timescale the way the Investments performance card does). Still the same
   * shared picker — the choice follows the reader between reports — the hub
   * just stands down from drawing a second copy above it.
   */
  ownsPeriodBar?: boolean;
  /**
   * How this report handles a ledger that spans currencies (the disclosure
   * ruling, 22 Aug §2, and the flows seam, §7 phase 1):
   *
   * - 'self'  — the report converts AND renders its own basis/provenance
   *             notes (the net-worth series). The hub mounts nothing.
   * - 'flows' — the report's totals convert through the shared flows seam
   *             (per-transaction-date ECB factors from useReportDataset).
   *             The hub mounts ReportCurrencyNote, which states the basis
   *             when the history is in force and falls back to the Phase 0
   *             mixed-currency disclosure while degraded.
   * - absent  — still native. The hub mounts the Phase 0 disclosure.
   *
   * Moving a report up this ladder is part of the commit that converts it.
   */
  currency?: 'self' | 'flows';
  component: LazyExoticComponent<ComponentType<ReportViewProps>>;
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'holdings',
    title: 'Holdings',
    description: 'Every holding as at a date — what it cost, what it is worth, and its register.',
    group: 'investments',
    icon: TrendingUpIcon,
    // The as-at day is the period's END, so "this month" is today and a
    // custom window shows what was held when it closed.
    usesPeriod: true,
    // Positions are stated in their own money and totalled per currency —
    // no rate is applied, so the hub's conversion line would be wrong here.
    currency: 'self',
    component: lazyWithRecovery(() => import('./HoldingsReport')),
  },
  {
    id: 'net-worth',
    title: 'Net worth',
    description: 'Everything you own less everything you owe, account by account.',
    group: 'what-i-have',
    icon: WalletIcon,
    usesPeriod: true,
    // Two bases since the one-net-worth ruling (24 Aug §1): closings at the
    // as-at day's rates, movements at their own days. The report states them
    // itself (BalanceReportCurrencyNote) — the hub's one-basis note would be
    // wrong here.
    currency: 'self',
    component: lazyWithRecovery(() => import('./NetWorthStatementReport')),
  },
  {
    id: 'net-worth-over-time',
    title: 'Net worth over time',
    description: 'The whole history as a line. Click any point for that day’s balances.',
    group: 'what-i-have',
    icon: TrendingUpIcon,
    usesPeriod: true,
    ownsPeriodBar: true,
    // Converts at each day's ECB reference rate, with its own basis line.
    currency: 'self',
    // The whole history is the point of this one — a month of net worth is a
    // dot, and even a year says little about the direction of travel.
    defaultPeriod: 'all',
    component: lazyWithRecovery(() => import('../NetWorthReport')),
  },
  {
    id: 'account-balances',
    title: 'Account balances',
    description: 'Opening balance, money in and out, closing balance — for every account.',
    group: 'what-i-have',
    icon: LandmarkIcon,
    usesPeriod: true,
    // Two bases since the one-net-worth ruling (24 Aug §1): closings at the
    // as-at day's rates, movements at their own days. The report states them
    // itself (BalanceReportCurrencyNote) — the hub's one-basis note would be
    // wrong here.
    currency: 'self',
    component: lazyWithRecovery(() => import('./AccountBalancesReport')),
  },
  {
    id: 'account-distribution',
    title: 'Account distribution',
    description: 'Which accounts hold the money you have, ranked, with each one’s share.',
    group: 'what-i-have',
    icon: PieChartIcon,
    // A snapshot of what the accounts hold NOW — there is no "distribution last
    // March" to draw, so the hub's period picker is hidden rather than shown
    // governing nothing.
    usesPeriod: false,
    // Converts at today's rates and carries its own ConvertedTotalNote — the
    // current-balance treatment, not the flows basis.
    currency: 'self',
    component: lazyWithRecovery(() => import('./AccountDistributionReport')),
  },
  {
    id: 'monthly-income-expenses',
    title: 'Monthly income and expenses',
    description: 'Every category down the side, the months across the top.',
    group: 'spending',
    icon: CalendarIcon,
    usesPeriod: true,
    // Totals convert through the shared flows seam (per-date ECB factors).
    currency: 'flows',
    component: lazyWithRecovery(() => import('../Reports')),
  },
  {
    id: 'spending-by-category',
    title: 'Spending by category',
    description: 'What you spent on what, ranked, with the share of the total.',
    group: 'spending',
    icon: PieChartIcon,
    usesPeriod: true,
    // Totals convert through the shared flows seam (per-date ECB factors).
    currency: 'flows',
    component: lazyWithRecovery(() => import('./SpendingByCategoryReport')),
  },
  {
    id: 'income-and-spending-over-time',
    title: 'Income and spending over time',
    description: 'Month by month, what came in against what went out.',
    group: 'spending',
    icon: BarChart3Icon,
    usesPeriod: true,
    // Month-by-month bars need enough months to compare, and a year covers the
    // seasonal swings (Christmas, holidays, annual bills) exactly once.
    defaultPeriod: 'last-12-months',
    // Totals convert through the shared flows seam (per-date ECB factors).
    currency: 'flows',
    component: lazyWithRecovery(() => import('./IncomeSpendingOverTimeReport')),
  },
  {
    id: 'spending-by-payee',
    title: 'Spending by payee',
    description: 'Who the money actually went to, and how each payee is usually filed.',
    group: 'spending',
    icon: UsersIcon,
    usesPeriod: true,
    // Totals convert through the shared flows seam (per-date ECB factors).
    currency: 'flows',
    component: lazyWithRecovery(() => import('./SpendingByPayeeReport')),
  },
  /*
   * "What I'm committed to" WAS here, as 'recurring-commitments'. It moved to
   * its own page under Plan (pages/RecurringPayments, at /recurring-payments)
   * on the owner's ruling, 18 Aug: confirming a pattern there is what feeds
   * the calendar's forward view and the forecast, which makes it a working
   * surface rather than a report to read. Its old address redirects, so
   * bookmarks and dashboard pins survive the move.
   *
   * The component itself still lives under reports/ — it is written as a
   * report body and the page wraps it — so nothing about its design rules
   * changed with its address.
   */
  {
    id: 'period-comparison',
    title: 'This period vs last',
    description: 'The same period a year ago, or the one before — and what changed.',
    group: 'spending',
    icon: RepeatIcon,
    usesPeriod: true,
    // Totals convert through the shared flows seam (per-date ECB factors).
    currency: 'flows',
    component: lazyWithRecovery(() => import('./PeriodComparisonReport')),
  },
  {
    id: 'custom-reports',
    title: 'Custom reports',
    description: 'Build a report from the components you want, and save it.',
    group: 'custom',
    icon: FileTextIcon,
    // Custom reports carry their own date and account filters.
    usesPeriod: false,
    // The LAST surface to convert (24 Aug): aggregates run through the
    // shared flows seam — each row at its own day's rate — so the hub's
    // note states the basis, and its degraded fallback keeps the old
    // sentence honest while the history loads. Listed table rows stay
    // native, as rows do everywhere.
    currency: 'flows',
    component: lazyWithRecovery(() => import('../CustomReports')),
  },
];

export function findReport(id: string | undefined): ReportDefinition | null {
  if (!id) return null;
  return REPORTS.find(report => report.id === id) ?? null;
}

export function reportsInGroup(group: ReportGroupId): ReportDefinition[] {
  return REPORTS.filter(report => report.group === group);
}
