import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useAuth } from '@clerk/clerk-react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { financialPlanningService } from '../../services/financialPlanningService';
import Decimal from 'decimal.js';
import { logger } from '../../services/loggingService';
import type { FinancialPlan } from '../../types/financial-plans';
import type {
  NetWorthProjection,
  AccountBreakdown,
  ProjectionSettings
} from './types';
import {
  DEFAULT_PROJECTION_SETTINGS,
  MILESTONE_AMOUNTS
} from './types';
// Icons are referenced by string identifiers for proper separation of concerns

function getAccountIcon(type: string): string | null {
  switch (type) {
    case 'savings':
      return 'piggy-bank';
    case 'investment':
    case 'retirement':
      return 'briefcase';
    case 'credit_card':
    case 'credit':
      return 'credit-card';
    case 'mortgage':
      return 'home';
    case 'loan':
      return 'car';
    default:
      return null;
  }
}

export function useNetWorthProjector(onDataChange: () => void) {
  const { accounts, transactions } = useApp();
  const { userId, user } = useAuth() as any;
  const { formatCurrency } = useRegionalCurrency();
  
  const [projection, setProjection] = useState<NetWorthProjection | null>(null);
  const [settings, setSettings] = useState<ProjectionSettings>(DEFAULT_PROJECTION_SETTINGS);
  const [showProjectionSettings, setShowProjectionSettings] = useState(false);
  const [savedPlan, setSavedPlan] = useState<FinancialPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate current net worth from real accounts
  const currentNetWorth = useMemo(() => {
    const assets = accounts
      .filter(acc => ['checking', 'savings', 'investment', 'retirement', 'current'].includes(acc.type))
      .reduce((sum, acc) => sum.plus(new Decimal(acc.balance)), new Decimal(0));
    
    const liabilities = accounts
      .filter(acc => ['credit_card', 'loan', 'mortgage', 'credit'].includes(acc.type))
      .reduce((sum, acc) => sum.plus(new Decimal(Math.abs(acc.balance))), new Decimal(0));
    
    return assets.minus(liabilities);
  }, [accounts]);

  // Calculate assets and liabilities breakdown
  const assetsBreakdown: AccountBreakdown[] = useMemo(() => {
    return accounts
      .filter(acc => ['checking', 'savings', 'investment', 'retirement', 'current'].includes(acc.type))
      .map(acc => ({
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        icon: getAccountIcon(acc.type)
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  const liabilitiesBreakdown: AccountBreakdown[] = useMemo(() => {
    return accounts
      .filter(acc => ['credit_card', 'loan', 'mortgage', 'credit'].includes(acc.type))
      .map(acc => ({
        name: acc.name,
        type: acc.type,
        balance: Math.abs(acc.balance),
        icon: getAccountIcon(acc.type)
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  // Calculate monthly trends from transactions
  const monthlyTrend = useMemo(() => {
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
    
    return income - expenses;
  }, [transactions]);

  // Load saved net worth plan
  useEffect(() => {
    if (user?.id) {
      loadSavedPlan();
    }
  }, [user?.id]);

  const loadSavedPlan = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const plans = await financialPlanningService.getFinancialPlans(user.id, {});
      
      if (plans && plans.length > 0) {
        const plan = plans[0];
        setSavedPlan(plan);
        
        // Load saved settings
        if (plan.data) {
          setSettings({
            projectionYears: plan.data.projectionYears || 10,
            assumedGrowthRate: plan.data.growthRate || 0.06,
            monthlySavings: plan.data.monthlySavings || monthlyTrend,
            inflationRate: plan.data.inflationRate || 0.02
          });
        }
      } else {
        // Use calculated monthly trend as default
        setSettings(prev => ({ ...prev, monthlySavings: monthlyTrend }));
      }
    } catch (error) {
      logger.error('Error loading net worth plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate projection
  useEffect(() => {
    calculateProjection();
  }, [currentNetWorth, settings]);

  const calculateProjection = () => {
    const netWorth = currentNetWorth.toNumber();
    const yearlyContribution = settings.monthlySavings * 12;
    const projectionData: NetWorthProjection['projectionYears'] = [];
    
    let projectedValue = netWorth;
    
    for (let year = 1; year <= settings.projectionYears; year++) {
      // Apply growth to existing net worth
      projectedValue = projectedValue * (1 + settings.assumedGrowthRate) + yearlyContribution;
      
      // Estimate asset/liability split (simplified)
      const assetRatio = netWorth > 0 ? 1.1 : 0.9;
      const assets = projectedValue > 0 ? projectedValue * assetRatio : Math.abs(projectedValue) * 0.3;
      const liabilities = projectedValue > 0 ? assets - projectedValue : Math.abs(projectedValue) * 0.7;
      
      projectionData.push({
        year: new Date().getFullYear() + year,
        netWorth: projectedValue,
        assets,
        liabilities,
        change: yearlyContribution + (projectedValue - netWorth - yearlyContribution * year)
      });
    }
    
    // Calculate milestones
    const milestones = MILESTONE_AMOUNTS.map(amount => {
      let yearsToMilestone = 0;
      let currentProjection = netWorth;
      
      while (currentProjection < amount && yearsToMilestone < 50) {
        yearsToMilestone++;
        currentProjection = currentProjection * (1 + settings.assumedGrowthRate) + yearlyContribution;
      }
      
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + yearsToMilestone);
      
      return {
        amount,
        expectedDate,
        yearsAway: yearsToMilestone < 50 ? yearsToMilestone : -1
      };
    }).filter(m => m.yearsAway > 0 && m.yearsAway <= settings.projectionYears);
    
    setProjection({
      currentNetWorth: netWorth,
      projectedNetWorth: projectedValue,
      monthlyChange: settings.monthlySavings,
      yearlyChange: yearlyContribution,
      projectionYears: projectionData,
      milestones
    });
  };

  const savePlan = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const planData = {
        user_id: user.id,
        name: 'Net Worth Projection',
        plan_type: 'networth' as const,
        is_active: true,
        is_favorite: false,
        region: 'US',
        currency: 'USD',
        data: {
          currentNetWorth: currentNetWorth.toNumber(),
          ...settings,
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
      logger.error('Error saving net worth plan:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (updates: Partial<ProjectionSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return {
    currentNetWorth,
    assetsBreakdown,
    liabilitiesBreakdown,
    monthlyTrend,
    projection,
    settings,
    showProjectionSettings,
    savedPlan,
    isLoading,
    isSaving,
    formatCurrency,
    setShowProjectionSettings,
    updateSettings,
    savePlan,
    loadSavedPlan
  };
}