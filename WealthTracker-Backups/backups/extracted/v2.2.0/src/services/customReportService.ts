import type { CustomReport, ReportComponent } from '../components/CustomReportBuilder';
import type { Transaction, Account, Budget, Category } from '../types';
import Decimal from 'decimal.js';
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subYears, parseISO, format } from 'date-fns';
import { logger } from './loggingService';

// Component configuration types
interface BaseComponentConfig {
  title?: string;
  showLegend?: boolean;
  showLabels?: boolean;
}

interface SummaryStatsConfig extends BaseComponentConfig {
  includeMetrics?: string[];
}

interface ChartConfig extends BaseComponentConfig {
  metric?: 'amount' | 'count';
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'account';
  chartType?: string;
}

interface TableConfig extends BaseComponentConfig {
  columns?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

interface TextBlockConfig {
  content?: string;
}

interface CategoryBreakdownConfig extends BaseComponentConfig {
  showBudgetComparison?: boolean;
  sortBy?: 'amount' | 'name' | 'budget';
}

interface DateComparisonConfig extends BaseComponentConfig {
  comparisonPeriod?: 'previous' | 'year';
  metrics?: string[];
}

type ComponentConfig = SummaryStatsConfig | ChartConfig | TableConfig | TextBlockConfig | CategoryBreakdownConfig | DateComparisonConfig;

// Report data interfaces
interface ReportData {
  report: CustomReport;
  dateRange: { startDate: Date; endDate: Date };
  data: Record<string, ComponentData>;
}

interface ComponentData {
  [key: string]: unknown;
}

interface SummaryStats {
  income: number;
  expenses: number;
  netIncome: number;
  savingsRate: number;
  transactionCount: number;
  avgTransaction: number;
  [key: string]: number;
}

interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

interface TableRow {
  [key: string]: string | number | Date | boolean | null;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  budget?: number;
  variance?: number;
}

interface DateComparisonData {
  current: Record<string, number>;
  previous: Record<string, number>;
  change: Record<string, number>;
  changePercent: Record<string, number>;
}

class CustomReportService {
  private readonly STORAGE_KEY = 'money_management_custom_reports';

  // Get all custom reports
  getCustomReports(): CustomReport[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Failed to load custom reports:', error);
      return [];
    }
  }

  // Save a custom report
  saveCustomReport(report: CustomReport): void {
    const reports = this.getCustomReports();
    const index = reports.findIndex(r => r.id === report.id);
    
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.push(report);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Delete a custom report
  deleteCustomReport(reportId: string): void {
    const reports = this.getCustomReports().filter(r => r.id !== reportId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
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
  ): Promise<ReportData> {
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
    const componentData: Record<string, ComponentData> = {};
    
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
  ): Promise<ReportData> {
    const { transactions, accounts, budgets, categories, dateRange } = context;

    switch (component.type) {
      case 'summary-stats':
        return this.generateSummaryStats(transactions, component.config);
      
      case 'line-chart':
        return this.generateLineChartData(transactions, dateRange, component.config);
      
      case 'pie-chart':
        return this.generatePieChartData(transactions, categories, component.config);
      
      case 'bar-chart':
        return this.generateBarChartData(transactions, dateRange, component.config);
      
      case 'table':
        return this.generateTableData(transactions, accounts, component.config);
      
      case 'text-block':
        return { content: component.config.content || '' };
      
      case 'category-breakdown':
        return this.generateCategoryBreakdown(transactions, categories, budgets, component.config);
      
      case 'date-comparison':
        return this.generateDateComparison(transactions, dateRange, component.config);
      
      default:
        return null;
    }
  }

  private generateSummaryStats(transactions: Transaction[], config: SummaryStatsConfig): SummaryStats {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(Math.abs(t.amount)), new Decimal(0));
    
    const netIncome = income.minus(expenses);
    const savingsRate = income.gt(0) ? netIncome.div(income).mul(100) : new Decimal(0);

    const stats: SummaryStats = {
      income: income.toNumber(),
      expenses: expenses.toNumber(),
      netIncome: netIncome.toNumber(),
      savingsRate: savingsRate.toNumber(),
      transactionCount: transactions.length,
      avgTransaction: transactions.length > 0 
        ? expenses.div(transactions.filter(t => t.type === 'expense').length).toNumber()
        : 0
    };

    // Filter based on config
    if (config.metrics && Array.isArray(config.metrics)) {
      return Object.keys(stats)
        .filter(key => config.metrics.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: stats[key] }), {});
    }

    return stats;
  }

  private generateLineChartData(
    transactions: Transaction[], 
    dateRange: { startDate: Date; endDate: Date },
    config: ChartConfig
  ): ChartDataPoint[] {
    // Group transactions by month
    const monthlyData = new Map<string, { income: Decimal; expenses: Decimal }>();
    
    transactions.forEach(t => {
      const monthKey = format(new Date(t.date), 'yyyy-MM');
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          income: new Decimal(0),
          expenses: new Decimal(0)
        });
      }
      
      const data = monthlyData.get(monthKey)!;
      if (t.type === 'income') {
        data.income = data.income.plus(t.amount);
      } else if (t.type === 'expense') {
        data.expenses = data.expenses.plus(Math.abs(t.amount));
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
    config: ChartConfig
  ): ChartDataPoint[] {
    // Group expenses by category
    const categoryTotals = new Map<string, Decimal>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const current = categoryTotals.get(t.category) || new Decimal(0);
        categoryTotals.set(t.category, current.plus(Math.abs(t.amount)));
      });

    // Sort by amount and apply limit
    const sortedCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1].toNumber() - a[1].toNumber())
      .slice(0, config.limit || 10);

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
    dateRange: { startDate: Date; endDate: Date },
    config: ChartConfig
  ): ChartDataPoint[] {
    // Similar to line chart but with bar format
    const monthlyExpenses = new Map<string, Decimal>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const monthKey = format(new Date(t.date), 'MMM yyyy');
        const current = monthlyExpenses.get(monthKey) || new Decimal(0);
        monthlyExpenses.set(monthKey, current.plus(Math.abs(t.amount)));
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
    config: TableConfig
  ): { rows: TableRow[]; columns: string[] } {
    let sortedTransactions = [...transactions];

    // Apply sorting
    if (config.sortBy) {
      sortedTransactions.sort((a, b) => {
        const aVal = a[config.sortBy as keyof Transaction];
        const bVal = b[config.sortBy as keyof Transaction];
        
        if (config.sortOrder === 'desc') {
          return aVal > bVal ? -1 : 1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    // Apply limit
    if (config.limit) {
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
    config: CategoryBreakdownConfig
  ): CategoryBreakdown[] {
    // Group by category with budget comparison
    const categoryData = new Map<string, {
      actual: Decimal;
      budget: Decimal;
      count: number;
    }>();

    // Calculate actuals
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const current = categoryData.get(t.category) || {
          actual: new Decimal(0),
          budget: new Decimal(0),
          count: 0
        };
        
        current.actual = current.actual.plus(Math.abs(t.amount));
        current.count++;
        categoryData.set(t.category, current);
      });

    // Add budget data
    budgets.forEach(budget => {
      const current = categoryData.get(budget.category) || {
        actual: new Decimal(0),
        budget: new Decimal(0),
        count: 0
      };
      current.budget = new Decimal(budget.amount);
      categoryData.set(budget.category, current);
    });

    // Convert to array format
    return Array.from(categoryData.entries()).map(([categoryId, data]) => {
      const category = categories.find(c => c.id === categoryId);
      const variance = data.budget.gt(0) 
        ? data.actual.minus(data.budget).div(data.budget).mul(100)
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
    config: DateComparisonConfig
  ): DateComparisonData {
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

    // Calculate metrics for both periods
    const calculateMetrics = (trans: Transaction[]) => {
      const income = trans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
      
      const expenses = trans
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum.plus(Math.abs(t.amount)), new Decimal(0));
      
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