import type { Transaction, Account } from '../types';
import { exportTransactionsToCSV } from '../utils/csvExport';
import { generatePDFReport, generateSimplePDFReport } from '../utils/pdfExport';

export type DateRange = 'month' | 'quarter' | 'year' | 'all' | 'custom';
export type ActiveTab = 'overview' | 'budget' | 'generator';

export interface ReportSummary {
  income: number;
  expenses: number;
  netIncome: number;
  savingsRate: number;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface ChartData {
  labels: string[];
  datasets: any[];
}

export interface ReportData {
  title: string;
  dateRange: string;
  summary: ReportSummary;
  categoryBreakdown: CategoryTotal[];
  topTransactions: Transaction[];
  chartElements?: HTMLElement[];
}

class ReportsPageService {
  getDateRangeStart(dateRange: DateRange, customStartDate?: string): Date {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      case 'custom':
        if (customStartDate) {
          startDate = new Date(customStartDate);
        }
        break;
    }

    return startDate;
  }

  filterTransactions(
    transactions: Transaction[],
    dateRange: DateRange,
    selectedAccount: string,
    customStartDate?: string,
    customEndDate?: string
  ): Transaction[] {
    const startDate = this.getDateRangeStart(dateRange, customStartDate);

    return transactions.filter(t => {
      const transDate = new Date(t.date);
      let dateMatch = transDate >= startDate;
      
      // For custom date range, also check end date
      if (dateRange === 'custom' && customEndDate) {
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end day
        dateMatch = dateMatch && transDate <= endDate;
      }
      
      const accountMatch = selectedAccount === 'all' || t.accountId === selectedAccount;
      return dateMatch && accountMatch;
    });
  }

  calculateSummary(transactions: Transaction[]): ReportSummary {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = income - expenses;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;

    return { income, expenses, netIncome, savingsRate };
  }

  getCategoryData(transactions: Transaction[]): ChartData {
    const categoryTotals = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    return {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [{
        data: sortedCategories.map(([, amount]) => amount),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
          '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
        ]
      }]
    };
  }

  getMonthlyTrendData(transactions: Transaction[]): ChartData {
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    transactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expenses += t.amount;
      }
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
      labels: sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Income',
          data: sortedMonths.map(month => monthlyData[month].income),
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: sortedMonths.map(month => monthlyData[month].expenses),
          borderColor: '#EF4444',
          backgroundColor: '#EF444420',
          tension: 0.4
        }
      ]
    };
  }

  getCategoryBreakdown(transactions: Transaction[]): CategoryTotal[] {
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return Object.entries(
      transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>)
    )
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }));
  }

  getTopTransactions(transactions: Transaction[], limit: number = 10): Transaction[] {
    return transactions
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  formatDateRangeLabel(dateRange: DateRange): string {
    switch (dateRange) {
      case 'month': return 'Last Month';
      case 'quarter': return 'Last Quarter';
      case 'year': return 'Last Year';
      case 'all': return 'All Time';
      case 'custom': return 'Custom Range';
      default: return '';
    }
  }

  async exportToPDF(
    reportData: ReportData,
    accounts: Account[],
    includeCharts: boolean = true
  ): Promise<void> {
    if (includeCharts) {
      await generatePDFReport(reportData, accounts);
    } else {
      generateSimplePDFReport(reportData, accounts);
    }
  }

  exportToCSV(transactions: Transaction[], accounts: Account[]): string {
    return exportTransactionsToCSV(transactions, accounts);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  }

  getSavingsRateColor(rate: number): string {
    return rate >= 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';
  }

  getNetIncomeColor(amount: number): string {
    return amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  }

  getTransactionColor(type: 'income' | 'expense'): string {
    return type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  }

  formatBudgetExportData(data: any[]): string {
    const csv = data.map(row => ({
      Category: row.categoryName,
      Budgeted: row.budgeted,
      Actual: row.actual,
      Variance: row.variance,
      'Variance %': row.variancePercent.toFixed(1) + '%',
      Status: row.status
    }));
    
    return [
      Object.keys(csv[0]).join(','),
      ...csv.map(row => Object.values(row).join(','))
    ].join('\n');
  }
}

export const reportsPageService = new ReportsPageService();
