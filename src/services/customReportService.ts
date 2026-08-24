/**
 * Custom reports: the BUILDER of them, and — since slice 32 — a store that is
 * not the browser's.
 *
 * ── WHAT CHANGED, AND WHAT DID NOT ──────────────────────────────────────────
 *
 * The report GENERATION half below is untouched: the date-range resolution, the
 * account/category/tag filtering, and the seven generators that turn a
 * definition and a ledger into stats, charts and tables. Every figure in there
 * is computed with `Decimal` through `utils/incomeExpense`'s classifier, it is
 * correct, and it has nothing to do with where a definition is kept.
 *
 * What changed is the four lines that were the whole of "where": a report used
 * to live in `localStorage['money_management_custom_reports']` and NOWHERE else.
 * The consequences were all silent, which is why it took until now to fix:
 *
 *   • a report built on the laptop did not exist on the phone;
 *   • clearing browser data deleted every one of them, with no warning, no
 *     undo, and a reports page that then looks exactly like a person who has
 *     never made one;
 *   • a backup did not carry them, so "I restored my file" put back the ledger
 *     and none of the questions somebody had written about it;
 *   • and on a desktop they lived in the WebView's storage rather than in the
 *     ledger file the person chose, so copying that file to a new machine left
 *     every report behind — the failure `services/local/preferencesTransport.ts`
 *     opens by describing, one entity along.
 *
 * So persistence goes through `@data` now, like every other entity the app
 * stores. The alias and never a path: the specifier is what chooses the engine,
 * and a service that named `services/port` would put a Supabase client into a
 * desktop window (`docs/edition-gating.md`).
 *
 * ── AND THE REPORTS PEOPLE ALREADY HAVE ─────────────────────────────────────
 *
 * {@link CustomReportService.adoptLegacyReports} carries them across, once per
 * device. Its rules are written out at length there, because a migration that
 * runs twice, or half, or after a delete, is a migration that loses or
 * resurrects somebody's work — and all three failures are as quiet as the ones
 * above.
 */

import { dataPort } from '@data';
import { preferences } from './preferencesService';
// The one reading of a report's two JSON blobs, shared by both engines and by
// this adoption, so a component cannot mean one thing on the way in and another
// on the way out. See `services/reports/document.ts`.
import { parseReportComponents, parseReportFilters } from './reports/document';
import type {
  Account,
  Budget,
  Category,
  CustomReport,
  ReportComponent,
  Transaction
} from '../types';
import Decimal from 'decimal.js';
import { toDecimal } from '../utils/decimal';
import { buildCategoryKindLookup, classifyFlow, type FlowKind, type FlowFactorResolver } from '../utils/incomeExpense';
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, parseISO, format } from 'date-fns';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Logger = Pick<Console, 'error'>;

/**
 * The store, narrowed to the four operations a report needs.
 *
 * Derived from the port rather than re-declared, so a signature that changes on
 * the seam cannot silently drift from what is called here — the same discipline
 * `dataService.ts` uses for every engine it routes to. Injectable so a test can
 * drive this class without an engine behind it; the default is the alias, which
 * is DataService in a browser and the open ledger file in a desktop window.
 */
export type CustomReportStore = Pick<
  typeof dataPort,
  'listCustomReports' | 'createCustomReport' | 'updateCustomReport' | 'deleteCustomReport'
>;

/**
 * The preference that pins reports to the dashboard, narrowed to two methods.
 *
 * Here for ONE reason, and it is the adoption's: `dashboardPinnedReports` holds
 * `custom:<report id>` strings, so a report that comes back from the store under
 * a new id is a pinned widget that silently stops resolving. See
 * {@link CustomReportService.adoptLegacyReports}.
 */
export type PinnedReportStore = Pick<typeof preferences, 'getItem' | 'setItem'>;

export interface CustomReportServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  store?: CustomReportStore;
  pins?: PinnedReportStore;
}

/**
 * Where reports used to live: plain, unencrypted `localStorage`, written by the
 * reports page and read by it and two dashboard surfaces.
 *
 * Read by exactly one thing now — the adoption — and never written again.
 * Deliberately NOT deleted after it is adopted: it is the only remaining record
 * of what a person had before the migration, it costs a few kilobytes, and a
 * build that had to be rolled back would find it exactly as it was.
 */
export const LEGACY_REPORTS_KEY = 'money_management_custom_reports';

/**
 * What this device has already carried across.
 *
 * `{ complete, ids }` — see {@link CustomReportService.adoptLegacyReports} for
 * why it is both a flag AND a map rather than either one alone.
 */
export const REPORTS_ADOPTED_KEY = 'money_management_custom_reports_adopted';

/** The preference the dashboard keeps its pinned report ids in. */
const PINNED_REPORTS_PREFERENCE = 'dashboardPinnedReports';

/** The prefix a pinned CUSTOM report carries, as `ImprovedDashboard` writes it. */
const PINNED_CUSTOM_PREFIX = 'custom:';

/** How far this device has got carrying the old key's reports into the store. */
interface AdoptionMarker {
  /**
   * True once every report the old key held has landed. From the boot after
   * that, the old key is not read at all — this flag is checked first and the
   * adoption returns immediately.
   */
  complete: boolean;
  /**
   * Old id → the id the store minted for it.
   *
   * The map rather than a bare list of done ids, because it has a second job:
   * repointing the dashboard pins, which name reports by their old ids.
   */
  ids: Record<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A stored legacy report, made safe to hand to the store.
 *
 * The old key was written by `JSON.stringify` and read by `JSON.parse`, so its
 * `createdAt` and `updatedAt` are STRINGS however the app spelled them, and
 * nothing ever validated the rest. This is where that becomes an app object
 * again.
 *
 * THE TWO DATES ARE PARSED AND THEN THROWN AWAY BY THE STORE, and that is worth
 * knowing here rather than being surprised by there. `Omit<CustomReport, 'id'>`
 * requires them, so they are read properly; neither engine honours a stated one
 * (`create_custom_report`'s draft has no clock, and the cloud's writer has no
 * line for either column), so an adopted report is dated the day it was carried
 * across. `services/local/mappers/writes.ts` argues why that is the right trade
 * — honouring a date in the cloud that a ledger file cannot honour would be two
 * editions disagreeing about when somebody did something.
 *
 * A date that will not parse falls back to the day the adoption runs rather than
 * to the epoch, which is the same answer the store is about to give anyway.
 */
const legacyReport = (value: unknown, now: Date): { id: string; draft: Omit<CustomReport, 'id'> } | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
  if (id === null) return null;
  const at = (raw: unknown): Date => {
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return now;
  };
  return {
    id,
    draft: {
      name: typeof value.name === 'string' ? value.name : 'Untitled report',
      description: typeof value.description === 'string' ? value.description : '',
      // The two blobs travel as they were stored. Reading them is the STORE's
      // job on the way back out — `services/reports/document.ts`, which both
      // engines share — and a second reading here would be a third opinion
      // about what a component means.
      components: Array.isArray(value.components) ? parseReportComponents(value.components) : [],
      filters: parseReportFilters(value.filters),
      createdAt: at(value.createdAt),
      updatedAt: at(value.updatedAt)
    }
  };
};

export class CustomReportService {
  private readonly storage: StorageLike | null;

  private readonly logger: Logger;

  private readonly store: CustomReportStore;

  private readonly pins: PinnedReportStore;

  constructor(options: CustomReportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {}))
    };
    this.store = options.store ?? dataPort;
    this.pins = options.pins ?? preferences;
  }

  /** Every report this owner has, oldest first. */
  async listCustomReports(): Promise<CustomReport[]> {
    return this.store.listCustomReports();
  }

  /**
   * Save a report somebody just built.
   *
   * The id is the STORE's (divergence B-5). The builder used to mint one —
   * `report-${Date.now()}` — and cannot any more, because that is not a uuid and
   * the cloud's column is; it hands over a draft with a blank id and the page
   * decides between this and {@link updateCustomReport}.
   */
  async createCustomReport(draft: Omit<CustomReport, 'id'>): Promise<CustomReport> {
    return this.store.createCustomReport(draft);
  }

  /**
   * Change a report, and hand back the whole report as it now stands.
   *
   * `components` and `filters` REPLACE — the seam says so and every engine keeps
   * it, which is what makes removing a component from a report work.
   */
  async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    return this.store.updateCustomReport(id, updates);
  }

  /** Remove a report. Removing one that is already gone is a no-op, not an error. */
  async deleteCustomReport(id: string): Promise<void> {
    return this.store.deleteCustomReport(id);
  }

  /**
   * Carry the reports that are still in `localStorage` into the store — once,
   * per device, and never again.
   *
   * Answers the reports it wrote THIS call, so the caller can put them straight
   * into the list it already has rather than re-reading the store. An empty
   * array is the ordinary answer on every boot after the first.
   *
   * ── THE RULE, WRITTEN DOWN BECAUSE EVERY WAY OF GETTING IT WRONG IS SILENT ─
   *
   * A marker key records how far this device has got:
   * `{ complete: boolean, ids: { <old id>: <new id> } }`, under
   * {@link REPORTS_ADOPTED_KEY}. Four properties follow from it, and each one is
   * a failure that would otherwise never show itself.
   *
   *   IT DOES NOT RUN TWICE. `complete` is checked first, and while it is true
   *   the old key is not read at all. THAT IS THE PRECISE MOMENT THE OLD KEY
   *   STOPS BEING READ: the end of the first pass in which every report it held
   *   reached the store. Before that moment the key is read once per boot, to
   *   work out what is still outstanding.
   *
   *   A FAILURE HALFWAY LOSES NOTHING. The marker is written after EACH report
   *   lands, not once at the end, and the loop stops at the first refusal
   *   without setting `complete`. So the reports that landed are recorded as
   *   landed, the ones that did not are still in the old key, and the next boot
   *   picks up exactly where this one stopped. The alternative — one write at
   *   the end — turns a network failure on report four into either four
   *   duplicates or four losses, depending on which way it is written.
   *
   *   IT DOES NOT RESURRECT WHAT SOMEBODY DELETED. This is the property the
   *   `ids` map buys that a bare "done" flag would not, and the case is
   *   ordinary: adopt three reports, delete one of them from the reports page,
   *   and then have the adoption interrupted before it finished the third. The
   *   old key still holds all three, because nothing has ever written to it
   *   since. Membership of the map — not membership of the key — is what decides
   *   whether a report has been dealt with, so a deleted report is dealt with
   *   and stays deleted.
   *
   *   IT DOES NOT UNPIN A DASHBOARD. The ids change (see B-5 above), and
   *   `dashboardPinnedReports` holds `custom:<old id>`. Left alone, every pinned
   *   custom report would resolve to nothing and its widget would render `null`
   *   — a card that vanishes from somebody's dashboard with no message and no
   *   way to tell it apart from having unpinned it themselves. So the map is
   *   read back over the preference, and only the entries this device actually
   *   carried are touched.
   *
   * ── TWO DEVICES, ONE LOGIN ─────────────────────────────────────────────────
   *
   * The marker lives in `localStorage`, which is per-device and does not sync —
   * and that is exactly right, because the thing it is a marker FOR does not
   * sync either. The old key never left the browser it was written in, so two
   * devices sharing one login hold DIFFERENT reports, not two copies of the same
   * ones. Each device adopts its own set once; the store ends up holding the
   * union, which is what the person actually built; and nothing is written
   * twice, because no report is in two places to begin with. A marker that
   * synced would be worse in both directions — device B would skip its own
   * reports, or re-adopt device A's.
   *
   * The pin repoint is the one part that touches a SYNCED value, and it is safe
   * for the same reason: device B's map contains only device B's old ids, so it
   * leaves device A's already-repointed pins exactly as they are.
   */
  async adoptLegacyReports(): Promise<CustomReport[]> {
    if (!this.storage) return [];

    const marker = this.readMarker();
    if (marker.complete) return [];

    const now = new Date();
    const legacy = this.readLegacyReports(now);
    const outstanding = legacy.filter(report => marker.ids[report.id] === undefined);
    if (outstanding.length === 0) {
      // Nothing left to carry — including the common case of a device that never
      // had a report at all. Stamping it here is what stops the old key being
      // read on every subsequent boot.
      this.writeMarker({ complete: true, ids: marker.ids });
      return [];
    }

    const carried: CustomReport[] = [];
    let stopped = false;
    for (const report of outstanding) {
      try {
        const created = await this.store.createCustomReport(report.draft);
        marker.ids[report.id] = created.id;
        // After EACH one. See the rule above.
        this.writeMarker({ complete: false, ids: marker.ids });
        carried.push(created);
      } catch (error) {
        // Not rethrown: the caller is the boot, and a report that could not be
        // carried this morning is a report that will be carried this afternoon.
        // Failing the boot over it would replace a working ledger with an error
        // screen to protect a list of saved questions.
        this.logger.error('Failed to carry a saved report into the store:', error as Error);
        stopped = true;
        break;
      }
    }

    if (!stopped) this.writeMarker({ complete: true, ids: marker.ids });
    if (carried.length > 0) this.repointPinnedReports(marker.ids);
    return carried;
  }

  /** The old key's contents, as drafts the store can take. */
  private readLegacyReports(now: Date): Array<{ id: string; draft: Omit<CustomReport, 'id'> }> {
    if (!this.storage) return [];
    let parsed: unknown;
    try {
      const stored = this.storage.getItem(LEGACY_REPORTS_KEY);
      if (stored === null) return [];
      parsed = JSON.parse(stored);
    } catch (error) {
      // Unreadable rather than absent. Reported and then treated as empty: there
      // is nothing to be done about a corrupted blob, and the adoption must not
      // become a reason the app will not start.
      this.logger.error('Failed to read the saved reports this device still holds:', error as Error);
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const reports: Array<{ id: string; draft: Omit<CustomReport, 'id'> }> = [];
    for (const entry of parsed) {
      const report = legacyReport(entry, now);
      if (report !== null) reports.push(report);
    }
    return reports;
  }

  private readMarker(): AdoptionMarker {
    if (!this.storage) return { complete: false, ids: {} };
    try {
      const stored = this.storage.getItem(REPORTS_ADOPTED_KEY);
      if (stored === null) return { complete: false, ids: {} };
      const parsed: unknown = JSON.parse(stored);
      if (!isRecord(parsed)) return { complete: false, ids: {} };
      const ids: Record<string, string> = {};
      if (isRecord(parsed.ids)) {
        for (const [key, value] of Object.entries(parsed.ids)) {
          if (typeof value === 'string') ids[key] = value;
        }
      }
      return { complete: parsed.complete === true, ids };
    } catch (error) {
      // A marker that cannot be read is treated as no marker, which re-adopts.
      // The alternative — treating it as complete — would strand every report
      // the device still holds, permanently and silently, which is the worse of
      // the two wrong answers.
      this.logger.error('Failed to read how far this device has carried its reports:', error as Error);
      return { complete: false, ids: {} };
    }
  }

  private writeMarker(marker: AdoptionMarker): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(REPORTS_ADOPTED_KEY, JSON.stringify(marker));
    } catch (error) {
      // A marker that will not write is the one failure here that CAN duplicate
      // a report — the next boot would carry it again. Said out loud rather than
      // swallowed, because a full or blocked localStorage is something a person
      // can act on and a duplicated report is something they will otherwise be
      // left to explain to themselves.
      this.logger.error('Failed to record which reports this device has carried:', error as Error);
    }
  }

  /**
   * Point the dashboard's pinned reports at the ids the store gave them.
   *
   * Only the entries in `ids` are touched: a pin naming anything else is either
   * a built-in report or a custom report ANOTHER device already carried, and
   * both must come through untouched. A pin whose id is not in the map is
   * therefore left exactly as it is, which is the same rule
   * `remapBackupIds` keeps for a reference it cannot resolve.
   */
  private repointPinnedReports(ids: Record<string, string>): void {
    let stored: string | null;
    try {
      stored = this.pins.getItem(PINNED_REPORTS_PREFERENCE);
    } catch (error) {
      this.logger.error('Failed to read the dashboard’s pinned reports:', error as Error);
      return;
    }
    if (stored === null) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      // Not JSON this build wrote. Left alone — the dashboard's own reader falls
      // back to its default, and rewriting it here would throw away whatever a
      // newer build put there.
      return;
    }
    if (!Array.isArray(parsed)) return;

    let changed = false;
    const repointed = parsed.map(entry => {
      if (typeof entry !== 'string' || !entry.startsWith(PINNED_CUSTOM_PREFIX)) return entry;
      const replacement = ids[entry.slice(PINNED_CUSTOM_PREFIX.length)];
      if (replacement === undefined) return entry;
      changed = true;
      return `${PINNED_CUSTOM_PREFIX}${replacement}`;
    });
    if (!changed) return;

    try {
      this.pins.setItem(PINNED_REPORTS_PREFERENCE, JSON.stringify(repointed));
    } catch (error) {
      this.logger.error('Failed to repoint the dashboard’s pinned reports:', error as Error);
    }
  }

  // Generate report data based on configuration
  async generateReportData(
    report: CustomReport,
    data: {
      transactions: Transaction[];
      accounts: Account[];
      budgets: Budget[];
      categories: Category[];
    },
    /**
     * The flows seam (the disclosure ruling's ladder, closed here 24 Aug —
     * this was the LAST surface still summing native units): each row's
     * amount converts at its own day's reference rate before any aggregating
     * generator sees it, so stats, charts, breakdowns and comparisons all
     * convert through the one resolver every report uses. The TABLE
     * component keeps the raw rows — a listed transaction prints its own
     * money, only aggregates convert. Omitted, everything sums native and
     * the page's Phase 0 disclosure stays true.
     */
    convert?: FlowFactorResolver
  ): Promise<{
    report: CustomReport;
    dateRange: { startDate: Date; endDate: Date };
    data: Record<string, unknown>;
    /** True when any conversion factor was applied — the ≈ gate. */
    holdsForeign: boolean;
  }> {
    // Apply date filters
    const { startDate, endDate } = this.getDateRange(report.filters.dateRange, {
      start: report.filters.customStartDate,
      end: report.filters.customEndDate
    });

    // Filter transactions
    let filteredTransactions = data.transactions.filter(t => {
      const transDate = new Date(t.date);
      return transDate >= startDate && transDate <= endDate;
    });

    // Apply account filters
    if (report.filters.accounts && report.filters.accounts.length > 0) {
      filteredTransactions = filteredTransactions.filter(t => 
        report.filters.accounts!.includes(t.accountId)
      );
    }

    // Apply category filters
    if (report.filters.categories && report.filters.categories.length > 0) {
      filteredTransactions = filteredTransactions.filter(t => 
        report.filters.categories!.includes(t.category)
      );
    }

    // Apply tag filters
    if (report.filters.tags && report.filters.tags.length > 0) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.tags && t.tags.some(tag => report.filters.tags!.includes(tag))
      );
    }

    // The seam: aggregating generators receive rows whose amounts are
    // already in the display currency, each at its own day's factor. The
    // table generator receives the RAW rows below — listed money stays
    // native.
    let holdsForeign = false;
    const aggregable = convert
      ? filteredTransactions.map(t => {
          const factor = convert(t);
          if (factor === null) return t;
          holdsForeign = true;
          return { ...t, amount: toDecimal(t.amount).times(factor).toNumber() };
        })
      : filteredTransactions;

    // Generate component data
    const componentData: Record<string, unknown> = {};

    for (const component of report.components) {
      componentData[component.id] = await this.generateComponentData(
        component,
        {
          transactions: component.type === 'table' ? filteredTransactions : aggregable,
          accounts: data.accounts,
          budgets: data.budgets,
          categories: data.categories,
          dateRange: { startDate, endDate }
        }
      );
    }

    return {
      report,
      dateRange: { startDate, endDate },
      data: componentData,
      holdsForeign
    };
  }

  private getDateRange(
    rangeType: 'month' | 'quarter' | 'year' | 'custom',
    custom?: { start?: string; end?: string }
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    
    switch (rangeType) {
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case 'quarter':
        return {
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now)
        };
      case 'year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now)
        };
      case 'custom':
        return {
          startDate: custom?.start ? parseISO(custom.start) : subMonths(now, 1),
          endDate: custom?.end ? parseISO(custom.end) : now
        };
    }
  }

  private async generateComponentData(
    component: ReportComponent,
    context: {
      transactions: Transaction[];
      accounts: Account[];
      budgets: Budget[];
      categories: Category[];
      dateRange: { startDate: Date; endDate: Date };
    }
  ): Promise<unknown> {
    const { transactions, accounts, budgets, categories, dateRange } = context;
    // Income/expense by CATEGORY semantics (utils/incomeExpense): every
    // generator classifies rows through this one lookup, so a refund filed
    // under an expense category nets spending down instead of counting as
    // income — in stats, charts and comparisons alike.
    const kinds = buildCategoryKindLookup(categories);

    switch (component.type) {
      case 'summary-stats':
        return this.generateSummaryStats(transactions, component.config, kinds);

      case 'line-chart':
        return this.generateLineChartData(transactions, dateRange, component.config, kinds);

      case 'pie-chart':
        return this.generatePieChartData(transactions, categories, component.config, kinds);

      case 'bar-chart':
        return this.generateBarChartData(transactions, dateRange, component.config, kinds);
      
      case 'table':
        return this.generateTableData(transactions, accounts, component.config);
      
      case 'text-block':
        return { content: component.config.content || '' };
      
      case 'category-breakdown':
        return this.generateCategoryBreakdown(transactions, categories, budgets, component.config, kinds);

      case 'date-comparison':
        return this.generateDateComparison(transactions, dateRange, component.config, kinds);
      
      default:
        return null;
    }
  }

  private generateSummaryStats(
    transactions: Transaction[],
    config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): Record<string, number> {
    let income = new Decimal(0);
    let expenses = new Decimal(0);
    let expenseRowCount = 0;
    for (const t of transactions) {
      const kind = classifyFlow(t, kinds);
      if (kind === 'income') {
        income = income.plus(t.amount);
      } else if (kind === 'expense') {
        // Signed convention: spending is negative, so negating accumulates
        // spend and a refund credit nets it down.
        expenses = expenses.minus(t.amount);
        expenseRowCount++;
      }
    }

    const netIncome = income.minus(expenses);
    const savingsRate = income.gt(0) ? netIncome.div(income).times(100) : new Decimal(0);

    const stats: Record<string, number> = {
      income: income.toNumber(),
      expenses: expenses.toNumber(),
      netIncome: netIncome.toNumber(),
      savingsRate: savingsRate.toNumber(),
      transactionCount: transactions.length,
      avgTransaction: expenseRowCount > 0
        ? expenses.div(expenseRowCount).toNumber()
        : 0
    };

    // Filter based on config
    if (config.metrics && Array.isArray(config.metrics)) {
      const metrics = config.metrics as string[];
      return Object.keys(stats)
        .filter(key => metrics.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: stats[key] }), {});
    }

    return stats;
  }

  private generateLineChartData(
    transactions: Transaction[],
    dateRange: { startDate: Date; endDate: Date },
    config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): { labels: string[]; datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string; borderWidth?: number }> } {
    // Group transactions by month
    const monthlyData = new Map<string, { income: typeof Decimal.prototype; expenses: typeof Decimal.prototype }>();
    
    transactions.forEach(t => {
      const monthKey = format(new Date(t.date), 'yyyy-MM');
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          income: new Decimal(0),
          expenses: new Decimal(0)
        });
      }
      
      const data = monthlyData.get(monthKey)!;
      const kind = classifyFlow(t, kinds);
      if (kind === 'income') {
        data.income = data.income.plus(t.amount);
      } else if (kind === 'expense') {
        // Negated signed sum: refunds net the month's spending down.
        data.expenses = data.expenses.minus(t.amount);
      }
    });

    // Convert to chart format
    const labels = Array.from(monthlyData.keys()).sort();
    const datasets = [];

    if (config.dataType === 'income-vs-expenses' || config.dataType === 'both') {
      datasets.push({
        label: 'Income',
        data: labels.map(month => monthlyData.get(month)!.income.toNumber()),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)'
      });
      datasets.push({
        label: 'Expenses',
        data: labels.map(month => monthlyData.get(month)!.expenses.toNumber()),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)'
      });
    }

    return { labels, datasets };
  }

  private generatePieChartData(
    transactions: Transaction[],
    categories: Category[],
    config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): { labels: string[]; data: number[] } {
    // Net spend per category (refunds subtract); non-positive categories are
    // dropped — a pie slice cannot represent negative spend.
    const categoryTotals = new Map<string, typeof Decimal.prototype>();

    transactions
      .filter(t => classifyFlow(t, kinds) === 'expense')
      .forEach(t => {
        const current = categoryTotals.get(t.category) || new Decimal(0);
        categoryTotals.set(t.category, current.minus(t.amount));
      });
    for (const [key, total] of [...categoryTotals.entries()]) {
      if (!total.gt(0)) categoryTotals.delete(key);
    }

    // Sort by amount and apply limit
    const sortedCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1].toNumber() - a[1].toNumber())
      .slice(0, typeof config.limit === 'number' ? config.limit : 10);

    // If there are more categories, group them as "Other"
    if (categoryTotals.size > sortedCategories.length) {
      const otherTotal = Array.from(categoryTotals.entries())
        .slice(sortedCategories.length)
        .reduce((sum, [_, amount]) => sum.plus(amount), new Decimal(0));
      
      if (otherTotal.gt(0)) {
        sortedCategories.push(['Other', otherTotal]);
      }
    }

    const labels = sortedCategories.map(([cat]) => 
      categories.find(c => c.id === cat)?.name || cat
    );
    
    const data = sortedCategories.map(([_, amount]) => amount.toNumber());

    return { labels, data };
  }

  private generateBarChartData(
    transactions: Transaction[],
    _dateRange: { startDate: Date; endDate: Date },
    _config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): { labels: string[]; datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }> } {
    // Similar to line chart but with bar format. Net signed spend per month —
    // refunds filed to expense categories subtract.
    const monthlyExpenses = new Map<string, typeof Decimal.prototype>();

    transactions
      .filter(t => classifyFlow(t, kinds) === 'expense')
      .forEach(t => {
        const monthKey = format(new Date(t.date), 'MMM yyyy');
        const current = monthlyExpenses.get(monthKey) || new Decimal(0);
        monthlyExpenses.set(monthKey, current.minus(t.amount));
      });

    const sortedMonths = Array.from(monthlyExpenses.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    return {
      labels: sortedMonths,
      datasets: [{
        label: 'Monthly Expenses',
        data: sortedMonths.map(month => monthlyExpenses.get(month)!.toNumber()),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1
      }]
    };
  }

  private generateTableData(
    transactions: Transaction[],
    accounts: Account[],
    config: ReportComponent['config']
  ): Array<{
    date: string;
    description: string;
    category: string;
    account: string;
    amount: number;
    type: Transaction['type'];
  }> {
    let sortedTransactions = [...transactions];

    // Apply sorting
    if (config.sortBy) {
      sortedTransactions.sort((a, b) => {
        const aVal = a[config.sortBy as keyof Transaction];
        const bVal = b[config.sortBy as keyof Transaction];
        
        if (config.sortOrder === 'desc') {
          return (aVal || 0) > (bVal || 0) ? -1 : 1;
        } else {
          return (aVal || 0) > (bVal || 0) ? 1 : -1;
        }
      });
    }

    // Apply limit
    if (typeof config.limit === 'number') {
      sortedTransactions = sortedTransactions.slice(0, config.limit);
    }

    // Map to table format
    return sortedTransactions.map(t => ({
      date: format(new Date(t.date), 'MMM d, yyyy'),
      description: t.description,
      category: t.category,
      account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
      amount: t.amount,
      type: t.type
    }));
  }

  private generateCategoryBreakdown(
    transactions: Transaction[],
    categories: Category[],
    budgets: Budget[],
    _config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): Array<{
    category: string;
    actual: number;
    budget: number;
    variance: number;
    count: number;
    status: 'under' | 'over';
  }> {
    // Group by category with budget comparison
    const categoryData = new Map<string, {
      actual: typeof Decimal.prototype;
      budget: typeof Decimal.prototype;
      count: number;
    }>();

    // Calculate actuals — net signed spend, so refunds filed to the
    // category reduce the actual instead of inflating it.
    transactions
      .filter(t => classifyFlow(t, kinds) === 'expense')
      .forEach(t => {
        const current = categoryData.get(t.category) || {
          actual: new Decimal(0),
          budget: new Decimal(0),
          count: 0
        };

        current.actual = current.actual.minus(t.amount);
        current.count++;
        categoryData.set(t.category, current);
      });

    // Add budget data
    budgets.forEach(budget => {
      const current = categoryData.get(budget.categoryId) || {
        actual: new Decimal(0),
        budget: new Decimal(0),
        count: 0
      };
      current.budget = new Decimal(budget.amount);
      categoryData.set(budget.categoryId, current);
    });

    // Convert to array format
    return Array.from(categoryData.entries()).map(([categoryId, data]) => {
      const category = categories.find(c => c.id === categoryId);
      const variance = data.budget.gt(0) 
        ? data.actual.minus(data.budget).div(data.budget).times(100)
        : new Decimal(0);

      return {
        category: category?.name || categoryId,
        actual: data.actual.toNumber(),
        budget: data.budget.toNumber(),
        variance: variance.toNumber(),
        count: data.count,
        status: data.actual.lte(data.budget) ? 'under' : 'over'
      };
    });
  }

  private generateDateComparison(
    transactions: Transaction[],
    dateRange: { startDate: Date; endDate: Date },
    _config: ReportComponent['config'],
    kinds: Map<string, FlowKind | null>
  ): {
    current: {
      income: number;
      expenses: number;
      netIncome: number;
      transactionCount: number;
    };
    previous: {
      income: number;
      expenses: number;
      netIncome: number;
      transactionCount: number;
    };
    changes: {
      income: number;
      expenses: number;
      netIncome: number;
    };
    periodLabel: { current: string; previous: string };
  } {
    // Calculate period length
    const periodLength = Math.round(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Get previous period
    const previousStart = new Date(dateRange.startDate);
    previousStart.setDate(previousStart.getDate() - periodLength);
    const previousEnd = new Date(dateRange.startDate);
    previousEnd.setDate(previousEnd.getDate() - 1);

    // Filter transactions for both periods
    const currentPeriod = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= dateRange.startDate && tDate <= dateRange.endDate;
    });

    const previousPeriod = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= previousStart && tDate <= previousEnd;
    });

    // Calculate metrics for both periods — category semantics, so refunds
    // net expenses down in both the current and comparison windows.
    const calculateMetrics = (trans: Transaction[]) => {
      let income = new Decimal(0);
      let expenses = new Decimal(0);
      for (const t of trans) {
        const kind = classifyFlow(t, kinds);
        if (kind === 'income') income = income.plus(t.amount);
        else if (kind === 'expense') expenses = expenses.minus(t.amount);
      }

      return {
        income: income.toNumber(),
        expenses: expenses.toNumber(),
        netIncome: income.minus(expenses).toNumber(),
        transactionCount: trans.length
      };
    };

    const current = calculateMetrics(currentPeriod);
    const previous = calculateMetrics(previousPeriod);

    // Calculate changes
    const changes = {
      income: previous.income > 0 
        ? ((current.income - previous.income) / previous.income) * 100 
        : 0,
      expenses: previous.expenses > 0 
        ? ((current.expenses - previous.expenses) / previous.expenses) * 100 
        : 0,
      netIncome: previous.netIncome !== 0 
        ? ((current.netIncome - previous.netIncome) / Math.abs(previous.netIncome)) * 100 
        : 0
    };

    return {
      current,
      previous,
      changes,
      periodLabel: {
        current: `${format(dateRange.startDate, 'MMM d')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`,
        previous: `${format(previousStart, 'MMM d')} - ${format(previousEnd, 'MMM d, yyyy')}`
      }
    };
  }
}

export const customReportService = new CustomReportService();
