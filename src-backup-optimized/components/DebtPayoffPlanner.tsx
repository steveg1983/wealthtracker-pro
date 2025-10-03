/**
 * Debt Payoff Planner Component
 * Helps users plan and track debt payoff strategies using real account data
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '@clerk/clerk-react';
import { useRegionalCurrency } from '../hooks/useRegionalSettings';
import { financialPlanningService } from '../services/financialPlanningService';
import Decimal from 'decimal.js';
import {
  CreditCardIcon,
  TrendingDownIcon,
  CalendarIcon,
  DollarSignIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  CalculatorIcon,
  BarChart3Icon,
  PlayIcon,
  PauseIcon,
  RefreshCwIcon,
  TargetIcon,
  ZapIcon
} from './icons';
import type { Account } from '../types';
import type { FinancialPlan, FinancialPlanCreate } from '../types/financial-plans';

interface DebtPayoffPlannerProps {
  onDataChange: () => void;
}

interface DebtAccount {
  account: Account;
  balance: number;
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  payoffMonths: number;
  totalInterest: number;
  isSelected: boolean;
}

interface PayoffStrategy {
  type: 'avalanche' | 'snowball' | 'custom';
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  monthlyPayment: number;
  payoffOrder: string[];
  savingsVsMinimum: number;
  projections: Array<{
    month: number;
    date: Date;
    payments: Record<string, number>;
    balances: Record<string, number>;
    totalPaid: number;
    totalRemaining: number;
  }>;
}

export default function DebtPayoffPlanner({ onDataChange }: DebtPayoffPlannerProps): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { userId } = useAuth();
  const { formatCurrency } = useRegionalCurrency();
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball' | 'custom'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);
  const [savedPlan, setSavedPlan] = useState<FinancialPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showProjection, setShowProjection] = useState(false);
  const [currentProjection, setCurrentProjection] = useState<PayoffStrategy | null>(null);

  // Filter debt accounts from all accounts
  const debtAccountsFromApp = useMemo(() => {
    return accounts.filter(acc => 
      ['credit_card', 'loan', 'credit'].includes(acc.type) && 
      acc.balance < 0 // Negative balance indicates debt
    );
  }, [accounts]);

  // Calculate total debt
  const totalDebt = useMemo(() => {
    return debtAccounts
      .filter(d => d.isSelected)
      .reduce((sum, d) => sum.plus(new Decimal(d.balance)), new Decimal(0));
  }, [debtAccounts]);

  // Calculate total minimum payments
  const totalMinimumPayments = useMemo(() => {
    return debtAccounts
      .filter(d => d.isSelected)
      .reduce((sum, d) => sum + d.minimumPayment, 0);
  }, [debtAccounts]);

  // Calculate available monthly payment from transactions
  const availableMonthlyPayment = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    const income = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Estimate available for debt payment (20% of net income)
    return Math.max(0, (income - expenses) * 0.2);
  }, [transactions]);

  // Initialize debt accounts
  useEffect(() => {
    const initialDebtAccounts: DebtAccount[] = debtAccountsFromApp.map(acc => {
      const balance = Math.abs(acc.balance);
      
      // Estimate APR based on account type
      let estimatedAPR = 0.18; // Default 18% for credit cards
      if (acc.type === 'loan') {
        estimatedAPR = 0.08; // 8% for personal loans
      }
      
      // Estimate minimum payment (2% of balance or $25, whichever is greater)
      const minimumPayment = Math.max(25, balance * 0.02);
      
      return {
        account: acc,
        balance,
        apr: estimatedAPR,
        minimumPayment,
        monthlyPayment: minimumPayment,
        payoffMonths: 0,
        totalInterest: 0,
        isSelected: true
      };
    });
    
    setDebtAccounts(initialDebtAccounts);
  }, [debtAccountsFromApp]);

  // Load saved plan
  useEffect(() => {
    if (userId) {
      loadSavedPlan();
    }
  }, [userId]);

  const loadSavedPlan = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const plans = await financialPlanningService.getFinancialPlans(userId, {
        plan_type: 'investment' // Using investment for debt plans
      });
      
      if (plans && plans.length > 0) {
        const plan = plans[0];
        setSavedPlan(plan);
        
        // Load saved settings
        if (plan.data) {
          setStrategy(plan.data.strategy || 'avalanche');
          setExtraPayment(plan.data.extraPayment || 0);
        }
      }
    } catch (error) {
      console.error('Error loading debt plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate payoff projection
  const calculatePayoffProjection = (): PayoffStrategy => {
    const selectedDebts = debtAccounts.filter(d => d.isSelected);
    if (selectedDebts.length === 0) {
      return {
        type: strategy,
        totalMonths: 0,
        totalInterest: 0,
        totalPaid: 0,
        monthlyPayment: 0,
        payoffOrder: [],
        savingsVsMinimum: 0,
        projections: []
      };
    }
    
    // Sort debts based on strategy
    const sortedDebts = [...selectedDebts];
    if (strategy === 'avalanche') {
      // Highest interest rate first
      sortedDebts.sort((a, b) => b.apr - a.apr);
    } else if (strategy === 'snowball') {
      // Smallest balance first
      sortedDebts.sort((a, b) => a.balance - b.balance);
    }
    
    const payoffOrder = sortedDebts.map(d => d.account.name);
    const totalMonthlyPayment = totalMinimumPayments + extraPayment;
    
    // Simulate payoff month by month
    const projections: PayoffStrategy['projections'] = [];
    const currentBalances = Object.fromEntries(
      sortedDebts.map(d => [d.account.id, d.balance])
    );
    let month = 0;
    let totalInterestPaid = 0;
    let totalPaidAmount = 0;
    
    while (Object.values(currentBalances).some(b => b > 0) && month < 360) { // Max 30 years
      month++;
      const date = new Date();
      date.setMonth(date.getMonth() + month);
      
      const monthlyPayments: Record<string, number> = {};
      let availableExtra = extraPayment;
      
      // Pay minimums first
      sortedDebts.forEach(debt => {
        if (currentBalances[debt.account.id] > 0) {
          const interest = (currentBalances[debt.account.id] * debt.apr) / 12;
          const minPayment = Math.min(debt.minimumPayment, currentBalances[debt.account.id] + interest);
          monthlyPayments[debt.account.id] = minPayment;
          totalInterestPaid += interest;
        }
      });
      
      // Apply extra payment to priority debt
      for (const debt of sortedDebts) {
        if (currentBalances[debt.account.id] > 0 && availableExtra > 0) {
          const extraForThisDebt = Math.min(availableExtra, currentBalances[debt.account.id]);
          monthlyPayments[debt.account.id] = (monthlyPayments[debt.account.id] || 0) + extraForThisDebt;
          availableExtra -= extraForThisDebt;
        }
      }
      
      // Update balances
      sortedDebts.forEach(debt => {
        if (currentBalances[debt.account.id] > 0) {
          const interest = (currentBalances[debt.account.id] * debt.apr) / 12;
          currentBalances[debt.account.id] = Math.max(0, 
            currentBalances[debt.account.id] + interest - (monthlyPayments[debt.account.id] || 0)
          );
          totalPaidAmount += monthlyPayments[debt.account.id] || 0;
        }
      });
      
      projections.push({
        month,
        date,
        payments: { ...monthlyPayments },
        balances: { ...currentBalances },
        totalPaid: totalPaidAmount,
        totalRemaining: Object.values(currentBalances).reduce((sum, b) => sum + b, 0)
      });
    }
    
    // Calculate savings vs minimum payments only
    const minimumOnlyMonths = calculateMinimumPayoffMonths(selectedDebts);
    const minimumOnlyInterest = calculateMinimumInterest(selectedDebts);
    const savingsVsMinimum = minimumOnlyInterest - totalInterestPaid;
    
    return {
      type: strategy,
      totalMonths: month,
      totalInterest: totalInterestPaid,
      totalPaid: totalPaidAmount,
      monthlyPayment: totalMonthlyPayment,
      payoffOrder,
      savingsVsMinimum,
      projections
    };
  };

  // Calculate minimum payment only scenario
  const calculateMinimumPayoffMonths = (debts: DebtAccount[]): number => {
    let months = 0;
    const balances = Object.fromEntries(debts.map(d => [d.account.id, d.balance]));
    
    while (Object.values(balances).some(b => b > 0) && months < 360) {
      months++;
      debts.forEach(debt => {
        if (balances[debt.account.id] > 0) {
          const interest = (balances[debt.account.id] * debt.apr) / 12;
          balances[debt.account.id] = Math.max(0, 
            balances[debt.account.id] + interest - debt.minimumPayment
          );
        }
      });
    }
    
    return months;
  };

  const calculateMinimumInterest = (debts: DebtAccount[]): number => {
    let totalInterest = 0;
    const balances = Object.fromEntries(debts.map(d => [d.account.id, d.balance]));
    
    let months = 0;
    while (Object.values(balances).some(b => b > 0) && months < 360) {
      months++;
      debts.forEach(debt => {
        if (balances[debt.account.id] > 0) {
          const interest = (balances[debt.account.id] * debt.apr) / 12;
          totalInterest += interest;
          balances[debt.account.id] = Math.max(0, 
            balances[debt.account.id] + interest - debt.minimumPayment
          );
        }
      });
    }
    
    return totalInterest;
  };

  // Update debt account settings
  const updateDebtAccount = (accountId: string, updates: Partial<DebtAccount>) => {
    setDebtAccounts(prev => prev.map(debt => 
      debt.account.id === accountId 
        ? { ...debt, ...updates }
        : debt
    ));
  };

  // Toggle debt selection
  const toggleDebtSelection = (accountId: string) => {
    setDebtAccounts(prev => prev.map(debt => 
      debt.account.id === accountId 
        ? { ...debt, isSelected: !debt.isSelected }
        : debt
    ));
  };

  // Save plan
  const savePlan = async () => {
    if (!userId) return;
    
    const projection = calculatePayoffProjection();
    
    try {
      const planData: FinancialPlanCreate = {
        name: `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} Debt Payoff Plan`,
        plan_type: 'investment',
        user_id: userId,
        data: {
          strategy,
          extraPayment,
          totalDebt: totalDebt.toNumber(),
          debtAccounts: debtAccounts.map(d => ({
            accountId: d.account.id,
            accountName: d.account.name,
            balance: d.balance,
            apr: d.apr,
            minimumPayment: d.minimumPayment,
            isSelected: d.isSelected
          })),
          projection
        },
        region: 'US',
        currency: 'USD',
        is_active: true,
        is_favorite: false
      };
      
      if (savedPlan) {
        await financialPlanningService.updateFinancialPlan(
          userId,
          savedPlan.id,
          planData
        );
      } else {
        const newPlan = await financialPlanningService.createFinancialPlan(
          userId,
          planData
        );
        setSavedPlan(newPlan);
      }
      
      onDataChange();
    } catch (error) {
      console.error('Error saving debt plan:', error);
    }
  };

  // Calculate and show projection
  const handleCalculateProjection = () => {
    const projection = calculatePayoffProjection();
    setCurrentProjection(projection);
    setShowProjection(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading debt data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Debt Payoff Planner</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create a strategic plan to become debt-free faster
        </p>
      </div>

      {debtAccountsFromApp.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <CheckCircleIcon size={48} className="mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Congratulations! You're Debt-Free
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            You don't have any debt accounts. Keep up the great work!
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debt</h3>
                <CreditCardIcon size={20} className="text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalDebt.toNumber())}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Across {debtAccounts.filter(d => d.isSelected).length} accounts
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Min. Payment</h3>
                <DollarSignIcon size={20} className="text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatCurrency(totalMinimumPayments)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Monthly minimum
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Extra Payment</h3>
                <TrendingDownIcon size={20} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(extraPayment)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Accelerate payoff
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Strategy</h3>
                <TargetIcon size={20} className="text-gray-500" />
              </div>
              <p className="text-lg font-bold text-gray-600 dark:text-gray-500 capitalize">
                {strategy}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {strategy === 'avalanche' ? 'Highest APR first' : 'Smallest balance first'}
              </p>
            </div>
          </div>

          {/* Debt Accounts List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Your Debt Accounts
            </h3>
            <div className="space-y-4">
              {debtAccounts.map(debt => (
                <div 
                  key={debt.account.id} 
                  className={`border rounded-lg p-4 ${
                    debt.isSelected 
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-900/20' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={debt.isSelected}
                        onChange={() => toggleDebtSelection(debt.account.id)}
                        className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                      />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {debt.account.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {debt.account.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(debt.balance)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Balance
                      </p>
                    </div>
                  </div>
                  
                  {debt.isSelected && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          APR (%)
                        </label>
                        <input
                          type="number"
                          value={(debt.apr * 100).toFixed(2)}
                          onChange={(e) => updateDebtAccount(debt.account.id, { 
                            apr: Number(e.target.value) / 100 
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Min. Payment
                        </label>
                        <input
                          type="number"
                          value={debt.minimumPayment}
                          onChange={(e) => updateDebtAccount(debt.account.id, { 
                            minimumPayment: Number(e.target.value) 
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">
                            {Math.ceil(debt.balance / debt.minimumPayment)} months
                          </span>
                          <span className="text-xs"> at minimum</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Payoff Strategy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={() => setStrategy('avalanche')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  strategy === 'avalanche'
                    ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <ZapIcon size={24} className="mb-2 text-gray-600 dark:text-gray-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">Avalanche</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pay highest interest rate first (saves most money)
                </p>
              </button>
              
              <button
                onClick={() => setStrategy('snowball')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  strategy === 'snowball'
                    ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <TrendingDownIcon size={24} className="mb-2 text-green-600 dark:text-green-400" />
                <h4 className="font-medium text-gray-900 dark:text-white">Snowball</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pay smallest balance first (quick wins)
                </p>
              </button>
              
              <button
                onClick={() => setStrategy('custom')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  strategy === 'custom'
                    ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <CalculatorIcon size={24} className="mb-2 text-purple-600 dark:text-purple-400" />
                <h4 className="font-medium text-gray-900 dark:text-white">Custom</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Choose your own order
                </p>
              </button>
            </div>
            
            {/* Extra Payment Input */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Extra Monthly Payment
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="50"
                />
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Suggested: {formatCurrency(availableMonthlyPayment)}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Adding extra payments can significantly reduce your payoff time and interest paid
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handleCalculateProjection}
                className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <BarChart3Icon size={16} />
                Calculate Projection
              </button>
              
              <button
                onClick={savePlan}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Plan
              </button>
            </div>
          </div>

          {/* Projection Results */}
          {showProjection && currentProjection && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Payoff Projection
                </h3>
                <button
                  onClick={() => setShowProjection(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payoff Time</p>
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
                    {currentProjection.totalMonths} months
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.floor(currentProjection.totalMonths / 12)} years, {currentProjection.totalMonths % 12} months
                  </p>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(currentProjection.totalInterest)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Interest paid
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Interest Saved</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(currentProjection.savingsVsMinimum)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    vs minimum payments
                  </p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(currentProjection.monthlyPayment)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total monthly
                  </p>
                </div>
              </div>
              
              {/* Payoff Order */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Payoff Order ({strategy.charAt(0).toUpperCase() + strategy.slice(1)} Strategy)
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentProjection.payoffOrder.map((name, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg"
                    >
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Monthly Breakdown (first 12 months) */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  First Year Monthly Breakdown
                </h4>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="text-left py-2">Month</th>
                        <th className="text-right py-2">Payment</th>
                        <th className="text-right py-2">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProjection.projections.slice(0, 12).map((proj, index) => (
                        <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 text-gray-600 dark:text-gray-400">
                            {proj.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="text-right py-2 font-medium text-gray-900 dark:text-white">
                            {formatCurrency(Object.values(proj.payments).reduce((sum, p) => sum + p, 0))}
                          </td>
                          <td className="text-right py-2 text-red-600 dark:text-red-400">
                            {formatCurrency(proj.totalRemaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}