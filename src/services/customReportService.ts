import type { CustomReport, ReportComponent } from '../components/CustomReportBuilder';
import type { Transaction, Account, Budget, Category } from '../types';
import Decimal from 'decimal.js';
import { buildCategoryKindLookup, classifyFlow, type FlowKind } from '../utils/incomeExpense';
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, parseISO, format } from 'date-fns';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Logger = Pick<Console, 'error'>;

export interface CustomReportServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
}

export class CustomReportService {
  private readonly STORAGE_KEY = 'money_management_custom_reports';
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;

  constructor(options: CustomReportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {}))
    };
  }

  // Get all custom reports
  getCustomReports(): CustomReport[] {
    if (!this.storage) return [];
    try {
      const stored = this.storage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.logger.error('Failed to load custom reports:', error as Error);
      return [];
    }
  }

  // Save a custom report
  saveCustomReport(report: CustomReport): void {
    if (!this.storage) return;
    const reports = this.getCustomReports();
    const index = reports.findIndex(r => r.id === report.id);
    
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.push(report);
    }
    
    this.storage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Delete a custom report
  deleteCustomReport(reportId: string): void {
    if (!this.storage) return;
    const reports = this.getCustomReports().filter(r => r.id !== reportId);
    this.storage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Generate report data based on configuration
  async generateReportData(
    report: CustomReport,
    data: {
      transactions: Transaction[];
      accounts: Account[];
      budgets: Budget[];
      categories: Category[];
    }
  ): Promise<{
    report: CustomReport;
    dateRange: { startDate: Date; endDate: Date };
    data: Record<string, unknown>;
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

    // Generate component data
    const componentData: Record<string, unknown> = {};
    
    for (const component of report.components) {
      componentData[component.id] = await this.generateComponentData(
        component,
        {
          transactions: filteredTransactions,
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
      data: componentData
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
