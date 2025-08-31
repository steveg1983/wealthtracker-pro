// Dividend Tracking Service
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { errorHandlingService, ErrorCategory, ErrorSeverity, validate } from './errorHandlingService';
import type { SavedDividend } from '../types/dividend';
import { logger } from './loggingService';

export interface Dividend {
  id: string;
  investmentId: string;
  accountId: string;
  symbol: string;
  amount: number;
  amountPerShare: number;
  shares: number;
  currency: string;
  paymentDate: Date;
  exDividendDate: Date;
  recordDate?: Date;
  declarationDate?: Date;
  frequency: 'quarterly' | 'monthly' | 'annual' | 'semi-annual' | 'special';
  type: 'regular' | 'special' | 'return-of-capital' | 'qualified' | 'non-qualified';
  taxWithheld?: number;
  reinvested: boolean;
  reinvestmentPrice?: number;
  reinvestmentShares?: number;
  notes?: string;
}

export interface DividendSummary {
  totalDividends: DecimalInstance;
  totalTaxWithheld: DecimalInstance;
  bySymbol: Record<string, {
    total: DecimalInstance;
    count: number;
    lastPayment: Date;
    averagePerPayment: DecimalInstance;
    yieldPercent?: DecimalInstance;
  }>;
  byFrequency: Record<string, DecimalInstance>;
  byType: Record<string, DecimalInstance>;
  byMonth: Record<string, DecimalInstance>;
  projectedAnnual: DecimalInstance;
}

export interface DividendProjection {
  symbol: string;
  nextPaymentDate: Date;
  estimatedAmount: DecimalInstance;
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'history' | 'yield' | 'manual';
}

class DividendService {
  private dividends: Dividend[] = [];
  private storageKey = 'wealthtracker_dividends';
  private yieldData: Record<string, number> = {}; // Symbol -> annual yield %

  constructor() {
    this.loadDividends();
    this.loadYieldData();
  }

  private loadDividends() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.dividends = parsed.map((div: SavedDividend) => ({
          ...div,
          paymentDate: new Date(div.paymentDate),
          exDividendDate: new Date(div.exDividendDate),
          recordDate: div.recordDate ? new Date(div.recordDate) : undefined,
          declarationDate: div.declarationDate ? new Date(div.declarationDate) : undefined
        }));
      }
    } catch (error) {
      logger.error('Failed to load dividends:', error);
      this.dividends = [];
    }
  }

  private saveDividends() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.dividends));
    } catch (error) {
      errorHandlingService.handleError(error as Error, {
        category: ErrorCategory.STORAGE,
        severity: ErrorSeverity.HIGH,
        context: { dividendCount: this.dividends.length },
        userMessage: 'Failed to save dividend data. Your changes may not persist.',
        recoverable: true
      });
    }
  }

  private loadYieldData() {
    // In production, this would fetch from a financial API
    // For now, use some example yields
    this.yieldData = {
      'AAPL': 0.44,   // 0.44% annual yield
      'MSFT': 0.72,   // 0.72% annual yield
      'JNJ': 2.85,    // 2.85% annual yield
      'KO': 3.06,     // 3.06% annual yield
      'VZ': 6.48,     // 6.48% annual yield
      'T': 6.15,      // 6.15% annual yield
      'PG': 2.35,     // 2.35% annual yield
      'JPM': 2.82,    // 2.82% annual yield
      'XOM': 3.23,    // 3.23% annual yield
      'CVX': 3.48,    // 3.48% annual yield
      'O': 5.51,      // 5.51% annual yield (monthly REIT)
      'SCHD': 3.41,   // 3.41% annual yield (dividend ETF)
      'VYM': 2.91,    // 2.91% annual yield (high dividend ETF)
      'DVY': 3.68,    // 3.68% annual yield (dividend ETF)
      'VIG': 1.57     // 1.57% annual yield (dividend growth ETF)
    };
  }

  // Add a dividend payment
  addDividend(dividend: Omit<Dividend, 'id'>): Dividend {
    try {
      // Validate dividend data
      validate(dividend, [
        {
          test: (d) => d.amount > 0,
          message: 'Dividend amount must be positive'
        },
        {
          test: (d) => d.amountPerShare > 0,
          message: 'Amount per share must be positive'
        },
        {
          test: (d) => d.shares > 0,
          message: 'Number of shares must be positive'
        },
        {
          test: (d) => d.paymentDate instanceof Date && !isNaN(d.paymentDate.getTime()),
          message: 'Valid payment date is required'
        },
        {
          test: (d) => !d.taxWithheld || d.taxWithheld >= 0,
          message: 'Tax withheld cannot be negative'
        }
      ]);

      const newDividend: Dividend = {
        ...dividend,
        id: `div-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      this.dividends.push(newDividend);
      this.saveDividends();
      return newDividend;
    } catch (error) {
      errorHandlingService.handleError(error as Error, {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        context: { dividend },
        userMessage: 'Invalid dividend data. Please check your input.'
      });
      throw error;
    }
  }

  // Get all dividends
  getDividends(filters?: {
    accountId?: string;
    investmentId?: string;
    symbol?: string;
    startDate?: Date;
    endDate?: Date;
    type?: Dividend['type'];
  }): Dividend[] {
    let filtered = [...this.dividends];

    if (filters) {
      if (filters.accountId) {
        filtered = filtered.filter(d => d.accountId === filters.accountId);
      }
      if (filters.investmentId) {
        filtered = filtered.filter(d => d.investmentId === filters.investmentId);
      }
      if (filters.symbol) {
        filtered = filtered.filter(d => d.symbol === filters.symbol);
      }
      if (filters.startDate) {
        filtered = filtered.filter(d => d.paymentDate >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(d => d.paymentDate <= filters.endDate!);
      }
      if (filters.type) {
        filtered = filtered.filter(d => d.type === filters.type);
      }
    }

    return filtered.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }

  // Update a dividend
  updateDividend(dividendId: string, updates: Partial<Dividend>): boolean {
    const index = this.dividends.findIndex(d => d.id === dividendId);
    if (index === -1) return false;

    this.dividends[index] = {
      ...this.dividends[index],
      ...updates,
      id: this.dividends[index].id // Prevent ID changes
    };

    this.saveDividends();
    return true;
  }

  // Delete a dividend
  deleteDividend(dividendId: string): boolean {
    const index = this.dividends.findIndex(d => d.id === dividendId);
    if (index === -1) return false;

    this.dividends.splice(index, 1);
    this.saveDividends();
    return true;
  }

  // Get dividend summary
  getDividendSummary(startDate?: Date, endDate?: Date): DividendSummary {
    const filteredDividends = this.getDividends({ startDate, endDate });
    
    const summary: DividendSummary = {
      totalDividends: toDecimal(0),
      totalTaxWithheld: toDecimal(0),
      bySymbol: {},
      byFrequency: {},
      byType: {},
      byMonth: {},
      projectedAnnual: toDecimal(0)
    };

    // Calculate totals and group by various dimensions
    filteredDividends.forEach(div => {
      const amount = toDecimal(div.amount);
      summary.totalDividends = summary.totalDividends.plus(amount);
      
      if (div.taxWithheld) {
        summary.totalTaxWithheld = summary.totalTaxWithheld.plus(toDecimal(div.taxWithheld));
      }

      // By symbol
      if (!summary.bySymbol[div.symbol]) {
        summary.bySymbol[div.symbol] = {
          total: toDecimal(0),
          count: 0,
          lastPayment: div.paymentDate,
          averagePerPayment: toDecimal(0)
        };
      }
      summary.bySymbol[div.symbol].total = summary.bySymbol[div.symbol].total.plus(amount);
      summary.bySymbol[div.symbol].count++;
      if (div.paymentDate > summary.bySymbol[div.symbol].lastPayment) {
        summary.bySymbol[div.symbol].lastPayment = div.paymentDate;
      }

      // By frequency
      if (!summary.byFrequency[div.frequency]) {
        summary.byFrequency[div.frequency] = toDecimal(0);
      }
      summary.byFrequency[div.frequency] = summary.byFrequency[div.frequency].plus(amount);

      // By type
      if (!summary.byType[div.type]) {
        summary.byType[div.type] = toDecimal(0);
      }
      summary.byType[div.type] = summary.byType[div.type].plus(amount);

      // By month
      const monthKey = `${div.paymentDate.getFullYear()}-${String(div.paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (!summary.byMonth[monthKey]) {
        summary.byMonth[monthKey] = toDecimal(0);
      }
      summary.byMonth[monthKey] = summary.byMonth[monthKey].plus(amount);
    });

    // Calculate averages
    Object.keys(summary.bySymbol).forEach(symbol => {
      const symbolData = summary.bySymbol[symbol];
      symbolData.averagePerPayment = symbolData.total.div(toDecimal(symbolData.count));
    });

    // Calculate projected annual income
    summary.projectedAnnual = this.calculateProjectedAnnualIncome();

    return summary;
  }

  // Calculate projected annual dividend income
  private calculateProjectedAnnualIncome(): DecimalInstance {
    const recentDividends = this.getDividends({
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
    });

    // Group by symbol and frequency
    const symbolFrequency: Record<string, { total: DecimalInstance; frequency: string; count: number }> = {};
    
    recentDividends.forEach(div => {
      if (!symbolFrequency[div.symbol]) {
        symbolFrequency[div.symbol] = {
          total: toDecimal(0),
          frequency: div.frequency,
          count: 0
        };
      }
      symbolFrequency[div.symbol].total = symbolFrequency[div.symbol].total.plus(toDecimal(div.amount));
      symbolFrequency[div.symbol].count++;
    });

    let projectedAnnual = toDecimal(0);
    
    Object.entries(symbolFrequency).forEach(([symbol, data]) => {
      // Annualize based on frequency
      let annualMultiplier = 1;
      switch (data.frequency) {
        case 'monthly': annualMultiplier = 12; break;
        case 'quarterly': annualMultiplier = 4; break;
        case 'semi-annual': annualMultiplier = 2; break;
        case 'annual': annualMultiplier = 1; break;
        default: annualMultiplier = data.count; // For special dividends
      }
      
      const averagePayment = data.total.div(toDecimal(data.count));
      projectedAnnual = projectedAnnual.plus(averagePayment.times(toDecimal(annualMultiplier)));
    });

    return projectedAnnual;
  }

  // Get dividend projections
  getDividendProjections(holdings: Array<{ symbol: string; shares: number; currentValue: number }>): DividendProjection[] {
    const projections: DividendProjection[] = [];
    const today = new Date();

    holdings.forEach(holding => {
      const recentDividends = this.getDividends({
        symbol: holding.symbol,
        startDate: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
      });

      if (recentDividends.length > 0) {
        // Project based on history
        const lastDividend = recentDividends[0];
        const nextPaymentDate = new Date(lastDividend.paymentDate);
        
        // Calculate next payment date based on frequency
        switch (lastDividend.frequency) {
          case 'monthly':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
            break;
          case 'semi-annual':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 6);
            break;
          case 'annual':
            nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
            break;
        }

        // Skip if next payment is in the past
        if (nextPaymentDate > today) {
          const averagePerShare = toDecimal(lastDividend.amountPerShare);
          const estimatedAmount = averagePerShare.times(toDecimal(holding.shares));
          
          projections.push({
            symbol: holding.symbol,
            nextPaymentDate,
            estimatedAmount,
            confidence: recentDividends.length >= 4 ? 'high' : 'medium',
            basedOn: 'history'
          });
        }
      } else if (this.yieldData[holding.symbol]) {
        // Project based on yield
        const annualYield = this.yieldData[holding.symbol] / 100;
        const annualDividend = toDecimal(holding.currentValue).times(toDecimal(annualYield));
        const quarterlyDividend = annualDividend.div(toDecimal(4)); // Assume quarterly
        
        // Estimate next payment date (end of current quarter)
        const nextPaymentDate = new Date(today);
        const currentMonth = today.getMonth();
        const quarterEnd = Math.ceil((currentMonth + 1) / 3) * 3 - 1;
        nextPaymentDate.setMonth(quarterEnd);
        nextPaymentDate.setDate(15); // Mid-month estimate
        
        projections.push({
          symbol: holding.symbol,
          nextPaymentDate,
          estimatedAmount: quarterlyDividend,
          confidence: 'low',
          basedOn: 'yield'
        });
      }
    });

    return projections.sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());
  }

  // Import dividends from transaction history
  importFromTransactions(transactions: Array<{
    id: string;
    accountId: string;
    date: Date;
    amount: number;
    description: string;
    category: string;
  }>, investmentMap: Record<string, { symbol: string; shares: number }>) {
    const dividendKeywords = ['dividend', 'div', 'distribution', 'capital gain'];
    const imported: Dividend[] = [];

    transactions.forEach(txn => {
      // Check if this looks like a dividend transaction
      const lowerDesc = txn.description.toLowerCase();
      const isDividend = dividendKeywords.some(keyword => lowerDesc.includes(keyword)) ||
                        txn.category === 'Investment Income';
      
      if (isDividend && txn.amount > 0) {
        // Try to extract symbol from description
        let symbol = '';
        let investmentId = '';
        
        // Look for symbol patterns (e.g., "AAPL DIVIDEND", "DIV MICROSOFT CORP")
        const symbolMatch = txn.description.match(/\b([A-Z]{1,5})\b/);
        if (symbolMatch) {
          symbol = symbolMatch[1];
          // Find matching investment
          for (const [invId, inv] of Object.entries(investmentMap)) {
            if (inv.symbol === symbol) {
              investmentId = invId;
              break;
            }
          }
        }

        if (symbol && investmentId) {
          const investment = investmentMap[investmentId];
          const dividend: Omit<Dividend, 'id'> = {
            investmentId,
            accountId: txn.accountId,
            symbol,
            amount: txn.amount,
            amountPerShare: txn.amount / investment.shares,
            shares: investment.shares,
            currency: 'USD',
            paymentDate: txn.date,
            exDividendDate: new Date(txn.date.getTime() - 2 * 24 * 60 * 60 * 1000), // Estimate: 2 days before
            frequency: 'quarterly', // Default assumption
            type: 'regular',
            reinvested: false,
            notes: `Imported from transaction: ${txn.description}`
          };

          // Check if this dividend already exists
          const exists = this.dividends.some(d => 
            d.symbol === symbol &&
            d.paymentDate.toDateString() === txn.date.toDateString() &&
            Math.abs(d.amount - txn.amount) < 0.01
          );

          if (!exists) {
            imported.push(this.addDividend(dividend));
          }
        }
      }
    });

    return imported;
  }

  // Get dividend yield for a symbol
  getDividendYield(symbol: string, currentPrice: number): number | null {
    // First try to calculate from actual dividend history
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const recentDividends = this.getDividends({
      symbol,
      startDate: oneYearAgo
    });

    if (recentDividends.length > 0) {
      const totalDividends = recentDividends.reduce((sum, div) => sum + div.amountPerShare, 0);
      return (totalDividends / currentPrice) * 100;
    }

    // Fall back to stored yield data
    return this.yieldData[symbol] || null;
  }

  // Update yield data (for manual updates or API integration)
  updateYieldData(symbol: string, annualYieldPercent: number) {
    this.yieldData[symbol] = annualYieldPercent;
    localStorage.setItem('wealthtracker_yield_data', JSON.stringify(this.yieldData));
  }

  // Export dividends to CSV
  exportToCSV(): string {
    const headers = [
      'Date', 'Symbol', 'Amount', 'Amount Per Share', 'Shares', 'Type', 
      'Frequency', 'Tax Withheld', 'Reinvested', 'Notes'
    ];
    
    const rows = this.dividends.map(div => [
      div.paymentDate.toISOString().split('T')[0],
      div.symbol,
      div.amount.toFixed(2),
      div.amountPerShare.toFixed(4),
      div.shares.toString(),
      div.type,
      div.frequency,
      div.taxWithheld?.toFixed(2) || '',
      div.reinvested ? 'Yes' : 'No',
      div.notes || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const dividendService = new DividendService();