import React from 'react';
import {
  PlusIcon,
  UploadIcon,
  TargetIcon,
  TrendingUpIcon,
  WalletIcon,
  CalendarIcon,
  SparklesIcon,
  RocketIcon,
  BookOpenIcon,
  ChartBarIcon,
  BankIcon,
  FileTextIcon,
  ArrowRightIcon
} from './icons';

interface EmptyStateProps {
  type: 'transactions' | 'accounts' | 'budgets' | 'goals' | 'investments' | 'recurring' | 'categories' | 'reports' | 'default';
  onAction?: () => void;
  className?: string;
}

interface EmptyStateConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  secondaryActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
  }>;
  illustration?: 'wallet' | 'chart' | 'target' | 'rocket';
}

/**
 * Empty States Component
 * Design principles:
 * 1. Helpful and actionable messaging
 * 2. Beautiful illustrations
 * 3. Quick-start actions
 * 4. Educational content
 * 5. Delightful animations
 */
export function EmptyState({ 
  type, 
  onAction,
  className = ''
}: EmptyStateProps): React.JSX.Element {
  const configs: Record<string, EmptyStateConfig> = {
    transactions: {
      icon: <WalletIcon size={48} className="text-primary" />,
      title: "No transactions yet",
      description: "Start tracking your finances by adding your first transaction. You can add them manually or import from your bank.",
      actionLabel: "Add Transaction",
      secondaryActions: [
        { label: "Import CSV", icon: <UploadIcon size={16} /> },
        { label: "Connect Bank", icon: <BankIcon size={16} /> }
      ],
      illustration: 'wallet'
    },
    accounts: {
      icon: <BankIcon size={48} className="text-primary" />,
      title: "No accounts added",
      description: "Add your bank accounts, credit cards, and investment accounts to get a complete picture of your finances.",
      actionLabel: "Add Account",
      secondaryActions: [
        { label: "Learn More", icon: <BookOpenIcon size={16} /> }
      ],
      illustration: 'wallet'
    },
    budgets: {
      icon: <ChartBarIcon size={48} className="text-primary" />,
      title: "No budgets created",
      description: "Take control of your spending by creating monthly budgets for different categories. We'll help you stay on track!",
      actionLabel: "Create Budget",
      secondaryActions: [
        { label: "Budget Templates", icon: <SparklesIcon size={16} /> },
        { label: "Budget Guide", icon: <BookOpenIcon size={16} /> }
      ],
      illustration: 'chart'
    },
    goals: {
      icon: <TargetIcon size={48} className="text-primary" />,
      title: "No financial goals set",
      description: "Whether it's saving for vacation, paying off debt, or building an emergency fund, set goals to stay motivated!",
      actionLabel: "Set First Goal",
      secondaryActions: [
        { label: "Goal Ideas", icon: <SparklesIcon size={16} /> }
      ],
      illustration: 'target'
    },
    investments: {
      icon: <TrendingUpIcon size={48} className="text-primary" />,
      title: "No investments tracked",
      description: "Add your stocks, bonds, and other investments to monitor your portfolio performance and track dividends.",
      actionLabel: "Add Investment",
      secondaryActions: [
        { label: "Import Portfolio", icon: <UploadIcon size={16} /> }
      ],
      illustration: 'rocket'
    },
    recurring: {
      icon: <CalendarIcon size={48} className="text-primary" />,
      title: "No recurring transactions",
      description: "Save time by setting up recurring transactions for regular bills, subscriptions, and income.",
      actionLabel: "Add Recurring Transaction",
      secondaryActions: [
        { label: "Common Examples", icon: <BookOpenIcon size={16} /> }
      ],
      illustration: 'wallet'
    },
    categories: {
      icon: <FileTextIcon size={48} className="text-primary" />,
      title: "No custom categories",
      description: "Organize your transactions with custom categories that match your lifestyle and spending habits.",
      actionLabel: "Create Category",
      secondaryActions: [
        { label: "Suggested Categories", icon: <SparklesIcon size={16} /> }
      ],
      illustration: 'chart'
    },
    reports: {
      icon: <ChartBarIcon size={48} className="text-primary" />,
      title: "No data for reports",
      description: "Add some transactions and we'll generate insightful reports about your spending patterns and financial health.",
      actionLabel: "Add Data",
      secondaryActions: [
        { label: "Sample Report", icon: <FileTextIcon size={16} /> }
      ],
      illustration: 'chart'
    },
    default: {
      icon: <RocketIcon size={48} className="text-primary" />,
      title: "Nothing here yet",
      description: "Get started by adding some data. We're here to help you manage your finances effectively!",
      actionLabel: "Get Started",
      illustration: 'rocket'
    }
  };

  const config = configs[type] || configs.default;

  // SVG illustrations for visual appeal
  const illustrations = {
    wallet: (
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        <rect x="40" y="70" width="120" height="80" rx="8" fill="currentColor" />
        <rect x="50" y="60" width="100" height="70" rx="6" fill="currentColor" opacity="0.7" />
        <circle cx="130" cy="95" r="8" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    chart: (
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        <rect x="40" y="120" width="20" height="40" fill="currentColor" />
        <rect x="70" y="100" width="20" height="60" fill="currentColor" />
        <rect x="100" y="80" width="20" height="80" fill="currentColor" />
        <rect x="130" y="60" width="20" height="100" fill="currentColor" />
      </svg>
    ),
    target: (
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.7" />
        <circle cx="100" cy="100" r="20" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.5" />
        <circle cx="100" cy="100" r="8" fill="currentColor" />
      </svg>
    ),
    rocket: (
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        <path d="M100 40 L80 140 L100 120 L120 140 Z" fill="currentColor" />
        <circle cx="100" cy="80" r="8" fill="currentColor" opacity="0.5" />
        <path d="M80 120 L70 150 L80 140" fill="currentColor" opacity="0.7" />
        <path d="M120 120 L130 150 L120 140" fill="currentColor" opacity="0.7" />
      </svg>
    )
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {/* Background Illustration */}
      <div className="relative w-48 h-48 mb-8">
        <div className="absolute inset-0 text-primary">
          {illustrations[config.illustration || 'rocket']}
        </div>
        <div className="absolute inset-0 flex items-center justify-center animate-fadeIn">
          <div className="p-4 bg-primary/10 rounded-2xl float-animation">
            {config.icon}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md space-y-4 animate-stagger">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          {config.title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          {config.description}
        </p>

        {/* Primary Action */}
        <div className="pt-4">
          <button
            onClick={onAction}
            className="group inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-secondary text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 button-press"
          >
            <PlusIcon size={20} />
            <span>{config.actionLabel}</span>
            <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Secondary Actions */}
        {config.secondaryActions && config.secondaryActions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {config.secondaryActions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Educational Tips */}
      <div className="mt-12 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
            <SparklesIcon size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Pro Tip
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {getProTip(type)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for contextual pro tips
function getProTip(type: string): string {
  const tips: Record<string, string> = {
    transactions: "Import transactions from your bank to save time and ensure accuracy. Most banks support CSV or QIF exports.",
    accounts: "Link all your accounts to see your complete net worth. Include assets like your home and car for the full picture.",
    budgets: "Start with a simple 50/30/20 budget: 50% needs, 30% wants, 20% savings and debt repayment.",
    goals: "Break large goals into smaller milestones. It's more motivating to hit multiple targets along the way!",
    investments: "Track your investment fees and dividends to understand your true returns over time.",
    recurring: "Set up recurring transactions for all regular bills to never miss tracking an expense.",
    categories: "Create categories that match your lifestyle. The more specific, the better your insights will be.",
    reports: "Review your reports monthly to spot trends and adjust your spending habits accordingly.",
    default: "Consistency is key! Update your finances regularly for the most accurate insights."
  };
  
  return tips[type] || tips.default;
}

// Specialized empty state for search results
export function EmptySearchResults({ 
  query,
  onClearSearch 
}: { 
  query: string;
  onClearSearch: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
        <FileTextIcon size={32} className="text-gray-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        No results found
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        We couldn't find anything matching "<span className="font-medium">{query}</span>"
      </p>
      
      <div className="space-y-3">
        <button
          onClick={onClearSearch}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
        >
          Clear Search
        </button>
        
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Try using different keywords or check your filters
        </p>
      </div>
    </div>
  );
}

// Loading skeleton for empty states
export function EmptyStateLoading(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-8 skeleton"></div>
      <div className="w-64 h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4 skeleton"></div>
      <div className="w-80 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 skeleton"></div>
      <div className="w-72 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-8 skeleton"></div>
      <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded skeleton"></div>
    </div>
  );
}