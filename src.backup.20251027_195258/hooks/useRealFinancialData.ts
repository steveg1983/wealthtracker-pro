/**
 * Real Financial Data Hook
 * Extracts income, spending patterns, and account balances for calculators
 * Created: 2025-09-02
 */

import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { toDecimal } from '@wealthtracker/utils';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { Account } from '../types';
import type { DecimalInstance } from '../types/decimal-types';

export interface RealFinancialData {
  // Account Information
  totalAssets: DecimalInstance;
  totalLiabilities: DecimalInstance;
  netWorth: DecimalInstance;
  availableForDownPayment: DecimalInstance;
  liquidAccounts: Account[];
  investmentAccounts: Account[];
  
  // Income Analysis
  monthlyIncome: DecimalInstance;
  annualIncome: DecimalInstance;
  incomeStability: 'stable' | 'variable' | 'irregular';
  incomeGrowthTrend: 'increasing' | 'stable' | 'decreasing';
  
  // Spending Analysis
  monthlyExpenses: DecimalInstance;
  essentialExpenses: DecimalInstance;
  discretionaryExpenses: DecimalInstance;
  savingsRate: number; // percentage
  
  // Housing Analysis
  currentHousingCosts: DecimalInstance;
  housingToIncomeRatio: number;
  suggestedMaxMortgage: DecimalInstance;
  
  // Debt Analysis
  totalMonthlyDebtPayments: DecimalInstance;
  debtToIncomeRatio: number;
  creditUtilization: number;
  
  // Data Quality
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  dataPoints: number;
  analysisStartDate: Date;
  recommendations: string[];
}

export function useRealFinancialData(): RealFinancialData | null {
  const { accounts, transactions } = useApp();
  
  return useMemo(() => {
    if (!accounts || !transactions || accounts.length === 0 || transactions.length === 0) {
      return null;
    }

    const today = new Date();
    const sixMonthsAgo = subMonths(today, 6);
    const recentTransactions = transactions.filter(t => new Date(t.date) >= sixMonthsAgo);
    
    // Account Analysis
    const assetAccounts = accounts.filter(a => 
      ['checking', 'savings', 'investment', 'current', 'asset'].includes(a.type)
    );
    const liabilityAccounts = accounts.filter(a => 
      ['credit', 'loan', 'mortgage'].includes(a.type)
    );
    
    const totalAssets = assetAccounts.reduce(
      (sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), 
      toDecimal(0)
    );
    
    const totalLiabilities = liabilityAccounts.reduce(
      (sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), 
      toDecimal(0)
    );
    
    const netWorth = totalAssets.minus(totalLiabilities);
    
    // Available for down payment (liquid accounts)
    const liquidAccounts = accounts.filter(a => 
      ['checking', 'savings', 'current'].includes(a.type) && a.balance > 0
    );
    
    const investmentAccounts = accounts.filter(a => 
      a.type === 'investment' && a.balance > 0
    );
    
    const availableForDownPayment = liquidAccounts.reduce(
      (sum, acc) => sum.plus(toDecimal(acc.balance * 0.8)), // Keep 20% buffer
      toDecimal(0)
    );
    
    // Income Analysis
    const incomeTransactions = recentTransactions.filter(t => t.type === 'income');
    const monthlyIncomes: DecimalInstance[] = [];
    
    // Group by month to calculate monthly income
    for (let i = 0; i < 6; i++) {
      const monthStart = startOfMonth(subMonths(today, i));
      const monthEnd = endOfMonth(monthStart);
      
      const monthIncome = incomeTransactions
        .filter(t => {
          const date = new Date(t.date);
          return date >= monthStart && date <= monthEnd;
        })
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
      
      if (monthIncome.greaterThan(0)) {
        monthlyIncomes.push(monthIncome);
      }
    }
    
    const monthlyIncome = monthlyIncomes.length > 0 
      ? monthlyIncomes.reduce((sum, income) => sum.plus(income), toDecimal(0))
          .dividedBy(monthlyIncomes.length)
      : toDecimal(0);
    
    const annualIncome = monthlyIncome.times(12);
    
    // Income stability analysis
    let incomeStability: 'stable' | 'variable' | 'irregular' = 'stable';
    if (monthlyIncomes.length >= 3) {
      const mean = monthlyIncome;
      const variance = monthlyIncomes
        .reduce((sum, income) => sum.plus(income.minus(mean).pow(2)), toDecimal(0))
        .dividedBy(monthlyIncomes.length);
      const stdDev = variance.sqrt();
      const coefficientOfVariation = mean.greaterThan(0) 
        ? stdDev.dividedBy(mean).toNumber() 
        : 0;
      
      if (coefficientOfVariation > 0.3) {
        incomeStability = 'irregular';
      } else if (coefficientOfVariation > 0.15) {
        incomeStability = 'variable';
      }
    }
    
    // Income growth trend
    let incomeGrowthTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (monthlyIncomes.length >= 4) {
      const firstHalf = monthlyIncomes.slice(0, Math.floor(monthlyIncomes.length / 2))
        .reduce((sum, income) => sum.plus(income), toDecimal(0))
        .dividedBy(Math.floor(monthlyIncomes.length / 2));
      
      const secondHalf = monthlyIncomes.slice(Math.floor(monthlyIncomes.length / 2))
        .reduce((sum, income) => sum.plus(income), toDecimal(0))
        .dividedBy(monthlyIncomes.length - Math.floor(monthlyIncomes.length / 2));
      
      const growthRate = secondHalf.minus(firstHalf).dividedBy(firstHalf).toNumber();
      
      if (growthRate > 0.05) {
        incomeGrowthTrend = 'increasing';
      } else if (growthRate < -0.05) {
        incomeGrowthTrend = 'decreasing';
      }
    }
    
    // Expense Analysis
    const expenseTransactions = recentTransactions.filter(t => t.type === 'expense');
    const monthlyExpenses = expenseTransactions.length > 0
      ? expenseTransactions
          .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0))
          .dividedBy(6) // 6 months of data
      : toDecimal(0);
    
    // Essential vs Discretionary (simplified categorization)
    const essentialCategories = [
      'housing', 'utilities', 'groceries', 'transport', 'insurance', 
      'healthcare', 'childcare', 'debt payments'
    ];
    
    const essentialExpenses = expenseTransactions
      .filter(t => t.category && essentialCategories.some(cat => 
        t.category!.toLowerCase().includes(cat.toLowerCase())
      ))
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0))
      .dividedBy(6);
    
    const discretionaryExpenses = monthlyExpenses.minus(essentialExpenses);
    
    // Savings Rate
    const savingsRate = monthlyIncome.greaterThan(0)
      ? monthlyIncome.minus(monthlyExpenses).dividedBy(monthlyIncome).times(100).toNumber()
      : 0;
    
    // Housing Analysis
    const housingTransactions = expenseTransactions.filter(t => 
      t.category && (
        t.category.toLowerCase().includes('rent') ||
        t.category.toLowerCase().includes('mortgage') ||
        t.category.toLowerCase().includes('housing')
      )
    );
    
    const currentHousingCosts = housingTransactions.length > 0
      ? housingTransactions
          .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0))
          .dividedBy(6)
      : toDecimal(0);
    
    const housingToIncomeRatio = monthlyIncome.greaterThan(0)
      ? currentHousingCosts.dividedBy(monthlyIncome).toNumber()
      : 0;
    
    // Suggested max mortgage (28% of gross income rule)
    const suggestedMaxMortgage = monthlyIncome.times(0.28);
    
    // Debt Analysis
    const debtTransactions = expenseTransactions.filter(t =>
      t.category && (
        t.category.toLowerCase().includes('loan') ||
        t.category.toLowerCase().includes('credit') ||
        t.category.toLowerCase().includes('debt')
      )
    );
    
    const totalMonthlyDebtPayments = debtTransactions.length > 0
      ? debtTransactions
          .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0))
          .dividedBy(6)
      : toDecimal(0);
    
    const debtToIncomeRatio = monthlyIncome.greaterThan(0)
      ? totalMonthlyDebtPayments.dividedBy(monthlyIncome).toNumber()
      : 0;
    
    // Credit utilization (simplified - based on credit account balances)
    const creditAccounts = liabilityAccounts.filter(a => a.type === 'credit');
    const totalCreditBalance = creditAccounts.reduce(
      (sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), 
      toDecimal(0)
    );
    // Assume credit limit is 3x current balance (simplified)
    const estimatedCreditLimit = totalCreditBalance.times(3);
    const creditUtilization = estimatedCreditLimit.greaterThan(0)
      ? totalCreditBalance.dividedBy(estimatedCreditLimit).times(100).toNumber()
      : 0;
    
    // Data Quality Assessment
    let dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    const dataPoints = recentTransactions.length;
    
    if (dataPoints >= 200 && monthlyIncomes.length >= 5) {
      dataQuality = 'excellent';
    } else if (dataPoints >= 100 && monthlyIncomes.length >= 3) {
      dataQuality = 'good';
    } else if (dataPoints >= 50 && monthlyIncomes.length >= 2) {
      dataQuality = 'fair';
    }
    
    // Recommendations
    const recommendations: string[] = [];
    
    if (savingsRate < 10) {
      recommendations.push('Consider increasing your savings rate to at least 10%');
    }
    
    if (housingToIncomeRatio > 0.33) {
      recommendations.push('Housing costs are high - consider refinancing or downsizing');
    }
    
    if (debtToIncomeRatio > 0.4) {
      recommendations.push('Debt-to-income ratio is high - focus on debt reduction');
    }
    
    if (creditUtilization > 30) {
      recommendations.push('Credit utilization is high - consider paying down credit cards');
    }
    
    if (availableForDownPayment.lessThan(annualIncome.times(0.2))) {
      recommendations.push('Build emergency fund before considering major purchases');
    }

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      availableForDownPayment,
      liquidAccounts,
      investmentAccounts,
      
      monthlyIncome,
      annualIncome,
      incomeStability,
      incomeGrowthTrend,
      
      monthlyExpenses,
      essentialExpenses,
      discretionaryExpenses,
      savingsRate,
      
      currentHousingCosts,
      housingToIncomeRatio,
      suggestedMaxMortgage,
      
      totalMonthlyDebtPayments,
      debtToIncomeRatio,
      creditUtilization,
      
      dataQuality,
      dataPoints,
      analysisStartDate: sixMonthsAgo,
      recommendations
    };
  }, [accounts, transactions]);
}

export default useRealFinancialData;
