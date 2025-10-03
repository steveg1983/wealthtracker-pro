/**
 * UsageLimitWarning Component - Display usage limits and upgrade prompts
 * 
 * Features:
 * - Usage progress bars
 * - Limit warnings
 * - Upgrade prompts
 * - Real-time usage updates
 */

import React from 'react';
import { useSubscription, useUsageLimit } from '../../contexts/SubscriptionContext';
import { AlertTriangleIcon, ArrowUpIcon, CheckIcon } from '../icons';

interface UsageLimitWarningProps {
  feature: 'accounts' | 'transactions' | 'budgets' | 'goals';
  showProgressBar?: boolean;
  className?: string;
}

export default function UsageLimitWarning({
  feature,
  showProgressBar = true,
  className = ''
}: UsageLimitWarningProps): React.JSX.Element | null {
  const { tier } = useSubscription();
  const { canAdd, remaining, limit, isUnlimited, currentUsage, percentUsed } = useUsageLimit(feature);

  // Don't show anything for unlimited plans
  if (isUnlimited || tier !== 'free') {
    return null;
  }

  // Don't show if well under limit
  if (percentUsed < 70) {
    return null;
  }

  const getWarningLevel = () => {
    if (percentUsed >= 100) return 'critical';
    if (percentUsed >= 90) return 'warning';
    return 'info';
  };

  const getWarningStyles = () => {
    const level = getWarningLevel();
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          progress: 'bg-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-800 dark:text-orange-200',
          progress: 'bg-orange-500'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          progress: 'bg-blue-500'
        };
    }
  };

  const styles = getWarningStyles();
  const level = getWarningLevel();

  const getMessage = () => {
    const featureName = feature.charAt(0).toUpperCase() + feature.slice(1);
    
    if (level === 'critical') {
      return {
        title: `${featureName} Limit Reached`,
        description: `You've reached your limit of ${limit} ${feature}. Upgrade to Premium for unlimited ${feature}.`
      };
    }
    
    if (level === 'warning') {
      return {
        title: `Approaching ${featureName} Limit`,
        description: `You're using ${currentUsage} of ${limit} ${feature}. Consider upgrading to avoid hitting limits.`
      };
    }
    
    return {
      title: `${featureName} Usage`,
      description: `You're using ${currentUsage} of ${limit} ${feature} in your free plan.`
    };
  };

  const { title, description } = getMessage();

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangleIcon 
          size={20} 
          className={`${styles.text} flex-shrink-0 mt-0.5`}
        />
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium ${styles.text} mb-1`}>
            {title}
          </h4>
          
          <p className={`text-sm ${styles.text} mb-3`}>
            {description}
          </p>

          {showProgressBar && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs ${styles.text}`}>
                  {currentUsage} / {limit} used
                </span>
                <span className={`text-xs ${styles.text}`}>
                  {Math.round(percentUsed)}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${styles.progress}`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => window.location.href = '/subscription'}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <ArrowUpIcon size={14} />
              Upgrade to Premium
            </button>
            
            <button
              onClick={() => window.location.href = '/subscription'}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm underline"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for showing upgrade benefits
interface UpgradeBenefitsProps {
  feature: string;
  className?: string;
}

export function UpgradeBenefits({ feature, className = '' }: UpgradeBenefitsProps): React.JSX.Element {
  const benefits = {
    accounts: [
      'Unlimited bank accounts',
      'Unlimited investment accounts',
      'Advanced account categorization',
      'Account performance tracking'
    ],
    transactions: [
      'Unlimited transactions per month',
      'Advanced transaction search',
      'Bulk transaction operations',
      'Transaction analytics'
    ],
    budgets: [
      'Unlimited budget categories',
      'Advanced budget templates',
      'Budget forecasting',
      'Budget performance analytics'
    ],
    goals: [
      'Unlimited financial goals',
      'Advanced goal tracking',
      'Goal achievement analytics',
      'Goal milestone notifications'
    ]
  };

  const featureBenefits = benefits[feature as keyof typeof benefits] || [];

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Unlock Premium Features
      </h3>
      
      <div className="grid grid-cols-1 gap-3 mb-6">
        {featureBenefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-3">
            <CheckIcon size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-gray-700 dark:text-gray-300 text-sm">
              {benefit}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => window.location.href = '/subscription'}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
        >
          Start Free Trial
        </button>
        
        <button
          onClick={() => window.location.href = '/subscription'}
          className="px-6 py-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
        >
          Compare Plans
        </button>
      </div>
    </div>
  );
}