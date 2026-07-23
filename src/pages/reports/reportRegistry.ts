import { lazy, type ComponentType, type ElementType, type LazyExoticComponent } from 'react';
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

export type ReportGroupId = 'what-i-have' | 'spending' | 'custom';

export interface ReportGroup {
  id: ReportGroupId;
  title: string;
  description: string;
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
  component: LazyExoticComponent<ComponentType<ReportViewProps>>;
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'net-worth',
    title: 'Net worth',
    description: 'Everything you own less everything you owe, account by account.',
    group: 'what-i-have',
    icon: WalletIcon,
    usesPeriod: true,
    component: lazy(() => import('./NetWorthStatementReport')),
  },
  {
    id: 'net-worth-over-time',
    title: 'Net worth over time',
    description: 'The whole history as a line. Click any point for that day’s balances.',
    group: 'what-i-have',
    icon: TrendingUpIcon,
    usesPeriod: true,
    // The whole history is the point of this one — a month of net worth is a
    // dot, and even a year says little about the direction of travel.
    defaultPeriod: 'all',
    component: lazy(() => import('../NetWorthReport')),
  },
  {
    id: 'account-balances',
    title: 'Account balances',
    description: 'Opening balance, money in and out, closing balance — for every account.',
    group: 'what-i-have',
    icon: LandmarkIcon,
    usesPeriod: true,
    component: lazy(() => import('./AccountBalancesReport')),
  },
  {
    id: 'monthly-income-expenses',
    title: 'Monthly income and expenses',
    description: 'Every category down the side, the months across the top.',
    group: 'spending',
    icon: CalendarIcon,
    usesPeriod: true,
    component: lazy(() => import('../Reports')),
  },
  {
    id: 'spending-by-category',
    title: 'Spending by category',
    description: 'What you spent on what, ranked, with the share of the total.',
    group: 'spending',
    icon: PieChartIcon,
    usesPeriod: true,
    component: lazy(() => import('./SpendingByCategoryReport')),
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
    component: lazy(() => import('./IncomeSpendingOverTimeReport')),
  },
  {
    id: 'spending-by-payee',
    title: 'Spending by payee',
    description: 'Who the money actually went to, and how each payee is usually filed.',
    group: 'spending',
    icon: UsersIcon,
    usesPeriod: true,
    component: lazy(() => import('./SpendingByPayeeReport')),
  },
  {
    id: 'period-comparison',
    title: 'This period vs last',
    description: 'The same period a year ago, or the one before — and what changed.',
    group: 'spending',
    icon: RepeatIcon,
    usesPeriod: true,
    component: lazy(() => import('./PeriodComparisonReport')),
  },
  {
    id: 'custom-reports',
    title: 'Custom reports',
    description: 'Build a report from the components you want, and save it.',
    group: 'custom',
    icon: FileTextIcon,
    // Custom reports carry their own date and account filters.
    usesPeriod: false,
    component: lazy(() => import('../CustomReports')),
  },
];

export function findReport(id: string | undefined): ReportDefinition | null {
  if (!id) return null;
  return REPORTS.find(report => report.id === id) ?? null;
}

export function reportsInGroup(group: ReportGroupId): ReportDefinition[] {
  return REPORTS.filter(report => report.group === group);
}
