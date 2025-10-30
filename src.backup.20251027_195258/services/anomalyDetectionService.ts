import type { Transaction, Category } from '../types';
import { startOfMonth, endOfMonth, subMonths, differenceInDays, format } from 'date-fns';
import { logger } from './loggingService';
import { formatPercentageValue, toDecimal } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

export interface Anomaly {
  id: string;
  type: 'unusual_amount' | 'frequency_spike' | 'new_merchant' | 'category_overspend' | 'time_pattern' | 'duplicate_charge';
  severity: 'low' | 'medium' | 'high';
  transactionId?: string;
  transactions?: string[]; // For anomalies involving multiple transactions
  title: string;
  description: string;
  detectedAt: Date;
  amount?: number;
  category?: string;
  merchant?: string;
  suggestedAction?: string;
  dismissed?: boolean;
}

export interface AnomalyDetectionConfig {
  enabledTypes: Set<Anomaly['type']>;
  sensitivityLevel: 'low' | 'medium' | 'high';
  lookbackMonths: number;
  minTransactionHistory: number;
  autoAlert: boolean;
}

const formatAmount = (value: number | DecimalInstance): string =>
  formatCurrencyDecimal(toDecimal(value), 'USD');

const formatDeviation = (value: number, decimals: number = 1): string =>
  toDecimal(value).toDecimalPlaces(decimals).toString();

const formatPercentage = (value: number | DecimalInstance, decimals: number = 0): string =>
  formatPercentageValue(value, decimals);

const formatInterval = (value: number): string =>
  toDecimal(value).toDecimalPlaces(0).toString();

const formatAmountKey = (value: number): string =>
  toDecimal(value).abs().toDecimalPlaces(2).toString();

class AnomalyDetectionService {
  private readonly STORAGE_KEY = 'money_management_anomaly_config';
  private readonly ANOMALIES_KEY = 'money_management_detected_anomalies';
  
  // Default thresholds by sensitivity level
  private readonly THRESHOLDS = {
    low: {
      amountDeviation: 3, // 3 standard deviations
      frequencyIncrease: 2, // 2x normal frequency
      categoryOverspend: 1.5, // 50% over average
    },
    medium: {
      amountDeviation: 2.5,
      frequencyIncrease: 1.5,
      categoryOverspend: 1.3,
    },
    high: {
      amountDeviation: 2,
      frequencyIncrease: 1.3,
      categoryOverspend: 1.2,
    }
  };

  getConfig(): AnomalyDetectionConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        config.enabledTypes = new Set(config.enabledTypes);
        return config;
      }
    } catch (error) {
      logger.error('Failed to load anomaly detection config:', error);
    }
    
    // Default config
    return {
      enabledTypes: new Set(['unusual_amount', 'frequency_spike', 'new_merchant', 'category_overspend']),
      sensitivityLevel: 'medium',
      lookbackMonths: 3,
      minTransactionHistory: 30,
      autoAlert: true
    };
  }

  saveConfig(config: Partial<AnomalyDetectionConfig>): void {
    const current = this.getConfig();
    const updated = {
      ...current,
      ...config,
      enabledTypes: config.enabledTypes ? Array.from(config.enabledTypes) : Array.from(current.enabledTypes)
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  async detectAnomalies(
    transactions: Transaction[],
    categories: Category[]
  ): Promise<Anomaly[]> {
    const config = this.getConfig();
    const anomalies: Anomaly[] = [];
    
    // Filter to recent transactions based on lookback period
    const cutoffDate = subMonths(new Date(), config.lookbackMonths);
    const recentTransactions = transactions.filter(t => new Date(t.date) >= cutoffDate);
    
    // Need minimum transaction history
    if (recentTransactions.length < config.minTransactionHistory) {
      return [];
    }

    // Sort transactions by date
    const sortedTransactions = [...recentTransactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Detect different types of anomalies
    if (config.enabledTypes.has('unusual_amount')) {
      anomalies.push(...this.detectUnusualAmounts(sortedTransactions, config));
    }
    
    if (config.enabledTypes.has('frequency_spike')) {
      anomalies.push(...this.detectFrequencySpikes(sortedTransactions, config));
    }
    
    if (config.enabledTypes.has('new_merchant')) {
      anomalies.push(...this.detectNewMerchants(sortedTransactions, transactions));
    }
    
    if (config.enabledTypes.has('category_overspend')) {
      anomalies.push(...this.detectCategoryOverspend(sortedTransactions, categories, config));
    }
    
    if (config.enabledTypes.has('time_pattern')) {
      anomalies.push(...this.detectTimePatternAnomalies(sortedTransactions));
    }
    
    if (config.enabledTypes.has('duplicate_charge')) {
      anomalies.push(...this.detectDuplicateCharges(sortedTransactions));
    }

    // Filter out dismissed anomalies
    const savedAnomalies = this.getSavedAnomalies();
    const dismissedIds = new Set(
      savedAnomalies.filter(a => a.dismissed).map(a => a.id)
    );
    
    return anomalies.filter(a => !dismissedIds.has(a.id));
  }

  private detectUnusualAmounts(
    transactions: Transaction[],
    config: AnomalyDetectionConfig
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const threshold = this.THRESHOLDS[config.sensitivityLevel].amountDeviation;
    
    // Group by category
    const categoryGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const group = categoryGroups.get(t.category) || [];
        group.push(t);
        categoryGroups.set(t.category, group);
      }
    });

    // Analyze each category
    categoryGroups.forEach((categoryTransactions, category) => {
      if (categoryTransactions.length < 5) return; // Need sufficient data
      
      // Calculate statistics
      const amounts = categoryTransactions.map(t => Math.abs(t.amount));
      const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      
      // Find outliers
      categoryTransactions.forEach(transaction => {
        const amount = Math.abs(transaction.amount);
        const zScore = Math.abs((amount - mean) / stdDev);
        
        if (zScore > threshold) {
          const severity = zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low';
          
          anomalies.push({
            id: `unusual-amount-${transaction.id}`,
            type: 'unusual_amount',
            severity,
            transactionId: transaction.id,
            title: 'Unusual Transaction Amount',
            description: `${transaction.description} - ${formatAmount(amount)} is ${formatDeviation(zScore, 1)} standard deviations from your typical ${category} spending`,
            detectedAt: new Date(),
            amount,
            category,
            merchant: this.extractMerchant(transaction.description),
            suggestedAction: 'Review this transaction to ensure it\'s correct'
          });
        }
      });
    });

    return anomalies;
  }

  private detectFrequencySpikes(
    transactions: Transaction[],
    config: AnomalyDetectionConfig
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const threshold = this.THRESHOLDS[config.sensitivityLevel].frequencyIncrease;
    
    // Group by merchant
    const merchantGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const merchant = this.extractMerchant(t.description);
        const group = merchantGroups.get(merchant) || [];
        group.push(t);
        merchantGroups.set(merchant, group);
      }
    });

    // Analyze frequency patterns
    merchantGroups.forEach((merchantTransactions, merchant) => {
      if (merchantTransactions.length < 3) return;
      
      // Calculate average days between transactions
      const sortedTrans = [...merchantTransactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const intervals: number[] = [];
      for (let i = 1; i < sortedTrans.length - 1; i++) {
        const current = sortedTrans[i];
        const previous = sortedTrans[i-1];
        if (!current || !previous) continue;

        const days = differenceInDays(new Date(current.date), new Date(previous.date));
        intervals.push(days);
      }
      
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      
      // Check last interval
      const lastTransaction = sortedTrans[sortedTrans.length - 1];
      const secondLastTransaction = sortedTrans[sortedTrans.length - 2];
      if (!lastTransaction || !secondLastTransaction) return null;

      const lastInterval = differenceInDays(
        new Date(lastTransaction.date),
        new Date(secondLastTransaction.date)
      );
      
      if (lastInterval < avgInterval / threshold) {
        const recentTrans = sortedTrans.slice(-3); // Last 3 transactions
        
        anomalies.push({
          id: `frequency-spike-${merchant}-${Date.now()}`,
          type: 'frequency_spike',
          severity: lastInterval < avgInterval / (threshold * 1.5) ? 'high' : 'medium',
          transactions: recentTrans.map(t => t.id),
          title: 'Unusual Frequency Increase',
          description: `You've made ${recentTrans.length} purchases at ${merchant} in ${lastInterval} days, much more frequent than your usual ${formatInterval(avgInterval)} day interval`,
          detectedAt: new Date(),
          merchant,
          suggestedAction: 'Check for duplicate charges or subscription changes'
        });
      }
    });

    return anomalies;
  }

  private detectNewMerchants(
    recentTransactions: Transaction[],
    allTransactions: Transaction[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Get all historical merchants
    const historicalMerchants = new Set<string>();
    const sixMonthsAgo = subMonths(new Date(), 6);
    
    allTransactions
      .filter(t => new Date(t.date) < sixMonthsAgo)
      .forEach(t => {
        historicalMerchants.add(this.extractMerchant(t.description));
      });

    // Find new merchants in recent transactions
    const recentMerchantTotals = new Map<string, { amount: number; count: number; transactions: string[] }>();
    
    recentTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const merchant = this.extractMerchant(t.description);
        if (!historicalMerchants.has(merchant)) {
          const current = recentMerchantTotals.get(merchant) || { amount: 0, count: 0, transactions: [] };
          current.amount += Math.abs(t.amount);
          current.count++;
          current.transactions.push(t.id);
          recentMerchantTotals.set(merchant, current);
        }
      });

    // Create anomalies for significant new merchants
    recentMerchantTotals.forEach((data, merchant) => {
      if (data.amount > 100 || data.count > 2) { // Significant new merchant
        anomalies.push({
          id: `new-merchant-${merchant.replace(/\s+/g, '-')}`,
          type: 'new_merchant',
          severity: data.amount > 500 ? 'high' : data.amount > 200 ? 'medium' : 'low',
          transactions: data.transactions,
          title: 'New Merchant Detected',
          description: `First time purchasing from ${merchant} - ${data.count} transaction(s) totaling ${formatAmount(data.amount)}`,
          detectedAt: new Date(),
          amount: data.amount,
          merchant,
          suggestedAction: 'Verify this is a legitimate merchant and these charges are authorized'
        });
      }
    });

    return anomalies;
  }

  private detectCategoryOverspend(
    transactions: Transaction[],
    categories: Category[],
    config: AnomalyDetectionConfig
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const threshold = this.THRESHOLDS[config.sensitivityLevel].categoryOverspend;
    
    // Calculate current month spending by category
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    
    const currentMonthSpending = new Map<string, number>();
    const historicalMonthlyAvg = new Map<string, number>();
    
    // Current month
    transactions
      .filter(t => {
        const date = new Date(t.date);
        return t.type === 'expense' && 
               date >= currentMonthStart && 
               date <= currentMonthEnd;
      })
      .forEach(t => {
        const current = currentMonthSpending.get(t.category) || 0;
        currentMonthSpending.set(t.category, current + Math.abs(t.amount));
      });

    // Historical average (last 3 months)
    const categoryMonthlyTotals = new Map<string, number[]>();
    
    for (let i = 1; i <= 3; i++) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      
      const monthlyTotals = new Map<string, number>();
      
      transactions
        .filter(t => {
          const date = new Date(t.date);
          return t.type === 'expense' && 
                 date >= monthStart && 
                 date <= monthEnd;
        })
        .forEach(t => {
          const current = monthlyTotals.get(t.category) || 0;
          monthlyTotals.set(t.category, current + Math.abs(t.amount));
        });
      
      monthlyTotals.forEach((amount, category) => {
        const totals = categoryMonthlyTotals.get(category) || [];
        totals.push(amount);
        categoryMonthlyTotals.set(category, totals);
      });
    }
    
    // Calculate averages
    categoryMonthlyTotals.forEach((totals, category) => {
      const avg = totals.reduce((sum, t) => sum + t, 0) / totals.length;
      historicalMonthlyAvg.set(category, avg);
    });

    // Detect overspending
    currentMonthSpending.forEach((amount, categoryId) => {
      const historicalAvg = historicalMonthlyAvg.get(categoryId) || 0;
      
      if (historicalAvg > 0 && amount > historicalAvg * threshold) {
        const category = categories.find(c => c.id === categoryId);
        const percentOver = ((amount - historicalAvg) / historicalAvg * 100);
        
        anomalies.push({
          id: `overspend-${categoryId}-${format(now, 'yyyy-MM')}`,
          type: 'category_overspend',
          severity: percentOver > 100 ? 'high' : percentOver > 50 ? 'medium' : 'low',
          title: 'Category Overspending',
          description: `${category?.name || categoryId} spending is ${formatPercentage(percentOver, 0)} higher than your 3-month average`,
          detectedAt: new Date(),
          amount: amount,
          category: categoryId,
          suggestedAction: `Review ${category?.name || categoryId} expenses and consider adjusting your budget`
        });
      }
    });

    return anomalies;
  }

  private detectTimePatternAnomalies(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Detect unusual time patterns (e.g., midnight transactions, weekend spikes)
    const suspiciousTimeTransactions: Transaction[] = [];
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const date = new Date(t.date);
        const hour = date.getHours();

        // Suspicious if transaction between midnight and 5 AM
        if (hour >= 0 && hour < 5) {
          suspiciousTimeTransactions.push(t);
        }
      });

    if (suspiciousTimeTransactions.length > 0) {
      anomalies.push({
        id: `time-pattern-${Date.now()}`,
        type: 'time_pattern',
        severity: suspiciousTimeTransactions.length > 3 ? 'high' : 'medium',
        transactions: suspiciousTimeTransactions.map(t => t.id),
        title: 'Unusual Transaction Times',
        description: `${suspiciousTimeTransactions.length} transaction(s) occurred during unusual hours (midnight-5AM)`,
        detectedAt: new Date(),
        suggestedAction: 'Verify these late-night transactions are legitimate'
      });
    }

    return anomalies;
  }

  private detectDuplicateCharges(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Look for potential duplicates (same amount, merchant, within 3 days)
    const potentialDuplicates = new Map<string, Transaction[]>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const key = `${this.extractMerchant(t.description)}-${formatAmountKey(t.amount)}`;
        const group = potentialDuplicates.get(key) || [];
        group.push(t);
        potentialDuplicates.set(key, group);
      });

    potentialDuplicates.forEach((group) => {
      if (group.length < 2) return;
      
      // Check for transactions within 3 days of each other
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const transactionI = group[i];
          const transactionJ = group[j];
          if (!transactionI || !transactionJ) continue;

          const daysDiff = Math.abs(
            differenceInDays(new Date(transactionI.date), new Date(transactionJ.date))
          );

          if (daysDiff <= 3) {
            anomalies.push({
              id: `duplicate-${transactionI.id}-${transactionJ.id}`,
              type: 'duplicate_charge',
              severity: 'high',
              transactions: [transactionI.id, transactionJ.id],
              title: 'Possible Duplicate Charge',
              description: `Two identical charges of ${formatAmount(transactionI.amount)} at ${this.extractMerchant(transactionI.description)} within ${daysDiff} days`,
              detectedAt: new Date(),
              amount: Math.abs(transactionI.amount),
              merchant: this.extractMerchant(transactionI.description),
              suggestedAction: 'Check if one of these is a duplicate charge and contact the merchant if needed'
            });
          }
        }
      }
    });

    return anomalies;
  }

  private extractMerchant(description: string): string {
    // Simple merchant extraction - in real implementation would be more sophisticated
    const cleaned = description
      .replace(/[#*]/g, '')
      .replace(/\d{4,}/g, '') // Remove long numbers
      .replace(/\s+/g, ' ')
      .trim();
    
    // Take first few words as merchant name
    const words = cleaned.split(' ');
    return words.slice(0, 3).join(' ');
  }

  // Save detected anomalies
  saveAnomalies(anomalies: Anomaly[]): void {
    localStorage.setItem(this.ANOMALIES_KEY, JSON.stringify(anomalies));
  }

  // Get saved anomalies
  getSavedAnomalies(): Anomaly[] {
    try {
      const stored = localStorage.getItem(this.ANOMALIES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Dismiss an anomaly
  dismissAnomaly(anomalyId: string): void {
    const anomalies = this.getSavedAnomalies();
    const anomaly = anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.dismissed = true;
      this.saveAnomalies(anomalies);
    }
  }

  // Get anomaly statistics
  getAnomalyStats(anomalies: Anomaly[]): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    totalAmount: number;
  } {
    const stats = {
      total: anomalies.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      totalAmount: 0
    };

    anomalies.forEach(anomaly => {
      // By type
      stats.byType[anomaly.type] = (stats.byType[anomaly.type] || 0) + 1;
      
      // By severity
      stats.bySeverity[anomaly.severity] = (stats.bySeverity[anomaly.severity] || 0) + 1;
      
      // Total amount
      if (anomaly.amount) {
        stats.totalAmount += anomaly.amount;
      }
    });

    return stats;
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
