import React, { useState } from 'react';
import { InfoIcon, XIcon } from './icons';

interface HelpTooltipProps {
  title: string;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  iconSize?: number;
  showOnHover?: boolean;
}

export default function HelpTooltip({ 
  title, 
  content, 
  position = 'top',
  className = '',
  iconSize = 16,
  showOnHover = true
}: HelpTooltipProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 -mt-1';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 -mb-1 rotate-180';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 -ml-1 -rotate-90';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 -mr-1 rotate-90';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 -mt-1';
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
        onMouseEnter={() => showOnHover && setIsVisible(true)}
        onMouseLeave={() => showOnHover && setIsVisible(false)}
        onClick={() => !showOnHover && setIsVisible(!isVisible)}
        aria-label={`Help: ${title}`}
      >
        <InfoIcon size={iconSize} />
      </button>
      
      {isVisible && (
        <div 
          className={`absolute z-50 ${getPositionClasses()} pointer-events-none`}
          style={{ minWidth: '250px', maxWidth: '350px' }}
        >
          <div className="bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl p-3 pointer-events-auto border-l-4 border-amber-400 dark:border-amber-600">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm">{title}</h4>
              {!showOnHover && (
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close help tooltip"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
              {content}
            </div>
            {/* Arrow */}
            <div className={`absolute ${getArrowClasses()}`}>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-amber-50 dark:border-t-amber-900/20" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Collection of help content for common features
export const HelpContent = {
  reconciliation: {
    title: "Account Reconciliation",
    content: "Match your account balance with bank statements. Mark transactions as cleared when they appear on your statement. This helps identify missing or duplicate transactions."
  },
  
  budgetCategories: {
    title: "Budget Categories",
    content: "Organize expenses into categories and subcategories. Set monthly limits for each category to track spending. Categories can be nested up to 3 levels deep."
  },
  
  recurringTransactions: {
    title: "Recurring Transactions",
    content: "Set up automatic transaction entries for regular bills and income. Choose frequency (daily, weekly, monthly, etc.) and the system will create transactions automatically."
  },
  
  goals: {
    title: "Financial Goals",
    content: "Set savings targets with deadlines. Track progress automatically as you save. Goals can be linked to specific accounts for automatic progress tracking."
  },
  
  tags: {
    title: "Transaction Tags",
    content: "Add multiple tags to transactions for flexible organization. Use tags for projects, tax categories, or any custom grouping you need."
  },
  
  investmentTracking: {
    title: "Investment Tracking",
    content: "Track portfolio performance, holdings, and returns. Add individual stocks or funds to investment accounts. View allocation charts and performance over time."
  },
  
  currencyConversion: {
    title: "Multi-Currency Support",
    content: "Each account can have its own currency. Transactions are automatically converted to your base currency for net worth calculations using current exchange rates."
  },
  
  importExport: {
    title: "Data Import/Export",
    content: "Import transactions from CSV, QIF, or OFX files. Export your data anytime for backup or analysis in other tools. Supports custom field mapping."
  },
  
  offlineMode: {
    title: "Offline Mode",
    content: "Continue working without internet. Changes sync automatically when you reconnect. Conflicts are resolved with a merge strategy that preserves all data."
  },
  
  bulkEdit: {
    title: "Bulk Operations",
    content: "Select multiple transactions to edit or delete at once. Use filters to find transactions, then apply changes to all selected items simultaneously."
  },
  
  advancedFilters: {
    title: "Advanced Filtering",
    content: "Combine multiple filters: date range, amount range, categories, accounts, and search text. Save filter combinations for quick access later."
  },
  
  netWorthTracking: {
    title: "Net Worth Calculation",
    content: (
      <div>
        <p className="mb-2">Your total assets minus total liabilities:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Assets: Cash, investments, property</li>
          <li>Liabilities: Loans, credit cards, mortgages</li>
        </ul>
        <p className="mt-2">Updated in real-time as you add transactions.</p>
      </div>
    )
  },
  
  attachments: {
    title: "Document Attachments",
    content: "Attach receipts, invoices, or documents to transactions. Supports images and PDFs. Files are securely stored and can be viewed anytime."
  },
  
  aiCategorization: {
    title: "Smart Categorization",
    content: "AI learns from your categorization patterns. New transactions are automatically categorized based on description, amount, and past behavior."
  },
  
  reports: {
    title: "Financial Reports",
    content: "Generate detailed reports: income/expense, cash flow, category breakdown, and trends. Export reports as PDF or CSV for sharing or archiving."
  }
};

// Wrapper component for inline help icons next to labels
interface InlineHelpProps {
  helpKey: keyof typeof HelpContent;
  label: string;
  className?: string;
}

export function InlineHelp({ helpKey, label, className = '' }: InlineHelpProps): React.JSX.Element {
  const help = HelpContent[helpKey];
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span>{label}</span>
      <HelpTooltip
        title={help.title}
        content={help.content}
        iconSize={14}
        position="top"
      />
    </div>
  );
}