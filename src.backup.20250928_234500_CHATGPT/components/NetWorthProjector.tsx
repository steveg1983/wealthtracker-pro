/**
 * Net Worth Projector Component
 * Tracks and projects net worth using real account data
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useUser } from '@clerk/clerk-react';
import { useRegionalCurrency, useRegionalSettings } from '../hooks/useRegionalSettings';
import { financialPlanningService } from '../services/financialPlanningService';
import Decimal from 'decimal.js';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  PiggyBankIcon,
  CreditCardIcon,
  HomeIcon,
  CarIcon,
  BriefcaseIcon,
  BarChart3Icon,
  CalendarIcon,
  InfoIcon,
  PlusIcon,
  MinusIcon
} from './icons';
import type { Account, Transaction } from '../types';
import type { FinancialPlan, FinancialPlanCreate } from '../types/financial-plans';

interface NetWorthPlannerProps {
  onDataChange: () => void;
}

interface NetWorthProjection {
  currentNetWorth: number;
  projectedNetWorth: number;
  monthlyChange: number;
  yearlyChange: number;
  projectionYears: Array<{
    year: number;
    netWorth: number;
    assets: number;
    liabilities: number;
    change: number;
  }>;
  milestones: Array<{
    amount: number;
    expectedDate: Date;
    yearsAway: number;
  }>;
}

export default function NetWorthProjector({ onDataChange }: NetWorthPlannerProps): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { user } = useUser();
  const { formatCurrency, currency } = useRegionalCurrency();
  const regionalSettings = useRegionalSettings();
  const [projection, setProjection] = useState<NetWorthProjection | null>(null);
  const [projectionYears, setProjectionYears] = useState(10);
  const [assumedGrowthRate, setAssumedGrowthRate] = useState(0.06);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [showProjectionSettings, setShowProjectionSettings] = useState(false);
  const [savedPlan, setSavedPlan] = useState<FinancialPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
  const assetsBreakdown = useMemo(() => {
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

  const liabilitiesBreakdown = useMemo(() => {
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
      const plans = await financialPlanningService.getFinancialPlans(user.id, {
        plan_type: 'networth'
      });
      
      if (plans && plans.length > 0) {
        const plan = plans[0];
        if (plan) {
          setSavedPlan(plan);
        }
        
        // Load saved settings
        if (plan?.data) {
          setProjectionYears(plan.data.projectionYears || 10);
          setAssumedGrowthRate(plan.data.growthRate || 0.06);
          setMonthlySavings(plan.data.monthlySavings || monthlyTrend);
        }
      } else {
        // Use calculated monthly trend as default
        setMonthlySavings(monthlyTrend);
        setSavedPlan(null);
      }
    } catch (error) {
      console.error('Error loading net worth plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate projection
  useEffect(() => {
    calculateProjection();
  }, [currentNetWorth, projectionYears, assumedGrowthRate, monthlySavings]);

  const calculateProjection = () => {
    const netWorth = currentNetWorth.toNumber();
    const yearlyContribution = monthlySavings * 12;
    const projectionData: NetWorthProjection['projectionYears'] = [];
    
    let projectedValue = netWorth;
    
    for (let year = 1; year <= projectionYears; year++) {
      // Apply growth to existing net worth
      projectedValue = projectedValue * (1 + assumedGrowthRate) + yearlyContribution;
      
      // Estimate asset/liability split (simplified)
      const assetRatio = netWorth > 0 ? 1.1 : 0.9; // Assets grow slightly faster
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
    const milestones = [
      { amount: 10000, expectedDate: new Date(), yearsAway: 0 },
      { amount: 50000, expectedDate: new Date(), yearsAway: 0 },
      { amount: 100000, expectedDate: new Date(), yearsAway: 0 },
      { amount: 250000, expectedDate: new Date(), yearsAway: 0 },
      { amount: 500000, expectedDate: new Date(), yearsAway: 0 },
      { amount: 1000000, expectedDate: new Date(), yearsAway: 0 }
    ].map(milestone => {
      // Find when we'll hit this milestone
      let yearsToMilestone = 0;
      let currentProjection = netWorth;
      
      while (currentProjection < milestone.amount && yearsToMilestone < 50) {
        yearsToMilestone++;
        currentProjection = currentProjection * (1 + assumedGrowthRate) + yearlyContribution;
      }
      
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + yearsToMilestone);
      
      return {
        ...milestone,
        expectedDate,
        yearsAway: yearsToMilestone < 50 ? yearsToMilestone : -1
      };
    }).filter(m => m.yearsAway > 0 && m.yearsAway <= projectionYears);
    
    setProjection({
      currentNetWorth: netWorth,
      projectedNetWorth: projectedValue,
      monthlyChange: monthlySavings,
      yearlyChange: yearlyContribution,
      projectionYears: projectionData,
      milestones
    });
  };

  const savePlan = async () => {
    if (!user?.id) return;
    
    try {
      const planData: FinancialPlanCreate = {
        name: 'Net Worth Projection',
        plan_type: 'networth',
        description: 'Auto-generated net worth projection',
        data: {
          currentNetWorth: currentNetWorth.toNumber(),
          projectionYears,
          growthRate: assumedGrowthRate,
          monthlySavings,
          projection
        },
        region: regionalSettings.region,
        currency,
        is_active: true,
        is_favorite: false
      };
      
      if (savedPlan) {
        await financialPlanningService.updateFinancialPlan(user.id, savedPlan.id, planData);
      } else {
        const newPlan = await financialPlanningService.createFinancialPlan(
          user.id,
          planData
        );
        setSavedPlan(newPlan);
      }
      
      onDataChange();
    } catch (error) {
      console.error('Error saving net worth plan:', error);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking':
      case 'current':
        return DollarSignIcon;
      case 'savings':
        return PiggyBankIcon;
      case 'investment':
      case 'retirement':
        return TrendingUpIcon;
      case 'credit_card':
      case 'credit':
        return CreditCardIcon;
      case 'mortgage':
        return HomeIcon;
      case 'loan':
        return BriefcaseIcon;
      default:
        return DollarSignIcon;
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading net worth data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Net Worth Tracker</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track your net worth and project future growth
        </p>
      </div>

      {/* Current Net Worth Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Net Worth</h3>
            <BarChart3Icon size={20} className="text-gray-400" />
          </div>
          <p className={`text-2xl font-bold ${currentNetWorth.greaterThan(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(currentNetWorth.toNumber())}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Assets - Liabilities
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Change</h3>
            {monthlyTrend >= 0 ? (
              <TrendingUpIcon size={20} className="text-green-500" />
            ) : (
              <TrendingDownIcon size={20} className="text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${monthlyTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {monthlyTrend >= 0 ? '+' : ''}{formatCurrency(monthlyTrend)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Based on last 30 days
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Projected in {projectionYears} Years
            </h3>
            <CalendarIcon size={20} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
            {projection ? formatCurrency(projection.projectedNetWorth) : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            At {formatPercentage(assumedGrowthRate)} growth
          </p>
        </div>
      </div>

      {/* Assets & Liabilities Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PlusIcon size={16} className="text-green-500" />
            Assets
          </h3>
          <div className="space-y-3">
            {assetsBreakdown.map((account, index) => {
              const Icon = account.icon;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {account.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              );
            })}
            {assetsBreakdown.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No assets found</p>
            )}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-900 dark:text-white">Total Assets</p>
                <p className="font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(
                    assetsBreakdown.reduce((sum, acc) => sum + acc.balance, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MinusIcon size={16} className="text-red-500" />
            Liabilities
          </h3>
          <div className="space-y-3">
            {liabilitiesBreakdown.map((account, index) => {
              const Icon = account.icon;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {account.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    -{formatCurrency(account.balance)}
                  </p>
                </div>
              );
            })}
            {liabilitiesBreakdown.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No liabilities found</p>
            )}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-900 dark:text-white">Total Liabilities</p>
                <p className="font-bold text-red-600 dark:text-red-400">
                  -{formatCurrency(
                    liabilitiesBreakdown.reduce((sum, acc) => sum + acc.balance, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projection Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Projection Settings</h3>
          <button
            onClick={() => setShowProjectionSettings(!showProjectionSettings)}
            className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
          >
            {showProjectionSettings ? 'Hide' : 'Customize'}
          </button>
        </div>

        {showProjectionSettings && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Projection Years
              </label>
              <input
                type="number"
                value={projectionYears}
                onChange={(e) => setProjectionYears(Number(e.target.value))}
                min="1"
                max="30"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Annual Growth Rate (%)
              </label>
              <input
                type="number"
                value={(assumedGrowthRate * 100).toFixed(1)}
                onChange={(e) => setAssumedGrowthRate(Number(e.target.value) / 100)}
                min="-10"
                max="20"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monthly Savings
              </label>
              <input
                type="number"
                value={monthlySavings}
                onChange={(e) => setMonthlySavings(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        {showProjectionSettings && (
          <div className="flex justify-end">
            <button
              onClick={savePlan}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Save Projection Settings
            </button>
          </div>
        )}
      </div>

      {/* Projection Chart */}
      {projection && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Net Worth Projection
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {projection.projectionYears.map((year, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
                    {year.year}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (year.assets / (year.assets + year.liabilities)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Assets: {formatCurrency(year.assets)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Liabilities: {formatCurrency(year.liabilities)}
                  </span>
                  <span className={`text-sm font-bold ${year.netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(year.netWorth)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {projection && projection.milestones.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <InfoIcon size={16} />
            Projected Milestones
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projection.milestones.map((milestone, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <p className="text-lg font-bold text-gray-600 dark:text-gray-500">
                  {formatCurrency(milestone.amount)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Expected in {milestone.yearsAway} {milestone.yearsAway === 1 ? 'year' : 'years'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {milestone.expectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
