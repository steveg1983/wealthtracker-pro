import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useUser } from '@clerk/clerk-react';
import { financialPlanningService } from '../services/financialPlanningService';
import Decimal from 'decimal.js';
import type { Account } from '../types';
import type { FinancialPlan } from '../services/financialPlanningService';
import type { DebtAccount } from '../components/debt/DebtAccountsList';
import type { PayoffStrategy } from '../components/debt/PayoffProjection';

export function useDebtPayoff(onDataChange: () => void) {
  const { accounts, transactions } = useApp();
  const { user } = useUser();
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball' | 'custom'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);
  const [savedPlan, setSavedPlan] = useState<FinancialPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (user?.id) {
      loadSavedPlan();
    }
  }, [user?.id]);

  const loadSavedPlan = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const plans = await financialPlanningService.getFinancialPlans(user.id, {
        plan_type: 'debt'
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
  const calculatePayoffProjection = useCallback((): PayoffStrategy => {
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
  }, [debtAccounts, strategy, extraPayment, totalMinimumPayments]);

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
  const updateDebtAccount = useCallback((accountId: string, updates: Partial<DebtAccount>) => {
    setDebtAccounts(prev => prev.map(debt => 
      debt.account.id === accountId 
        ? { ...debt, ...updates }
        : debt
    ));
  }, []);

  // Toggle debt selection
  const toggleDebtSelection = useCallback((accountId: string) => {
    setDebtAccounts(prev => prev.map(debt => 
      debt.account.id === accountId 
        ? { ...debt, isSelected: !debt.isSelected }
        : debt
    ));
  }, []);

  // Save plan
  const savePlan = useCallback(async () => {
    if (!user?.id) return;
    
    const projection = calculatePayoffProjection();
    
    try {
      const planData = {
        user_id: user.id,
        name: `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} Debt Payoff Plan`,
        plan_type: 'debt' as const,
        description: `Debt payoff plan using ${strategy} strategy`,
        region: 'US',
        currency: 'USD',
        is_active: true,
        is_favorite: false,
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
        }
      };
      
      if (savedPlan) {
        await financialPlanningService.updateFinancialPlan(
          user.id,
          savedPlan.id,
          planData
        );
      } else {
        const newPlan = await financialPlanningService.createFinancialPlan(
          user.id,
          planData
        );
        setSavedPlan(newPlan);
      }
      
      onDataChange();
    } catch (error) {
      console.error('Error saving debt plan:', error);
    }
  }, [user?.id, strategy, extraPayment, totalDebt, debtAccounts, savedPlan, calculatePayoffProjection, onDataChange]);

  return {
    debtAccounts,
    debtAccountsFromApp,
    strategy,
    setStrategy,
    extraPayment,
    setExtraPayment,
    totalDebt,
    totalMinimumPayments,
    availableMonthlyPayment,
    isLoading,
    calculatePayoffProjection,
    updateDebtAccount,
    toggleDebtSelection,
    savePlan
  };
}