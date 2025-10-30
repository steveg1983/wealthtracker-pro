import React from 'react';

export const HELP_CONTENT = {
  reconciliation: {
    title: 'Account Reconciliation',
    content:
      'Match your account balance with bank statements. Mark transactions as cleared when they appear on your statement. This helps identify missing or duplicate transactions.',
  },
  budgetCategories: {
    title: 'Budget Categories',
    content:
      'Organize expenses into categories and subcategories. Set monthly limits for each category to track spending. Categories can be nested up to 3 levels deep.',
  },
  recurringTransactions: {
    title: 'Recurring Transactions',
    content:
      'Set up automatic transaction entries for regular bills and income. Choose frequency (daily, weekly, monthly, etc.) and the system will create transactions automatically.',
  },
  goals: {
    title: 'Financial Goals',
    content:
      'Set savings targets with deadlines. Track progress automatically as you save. Goals can be linked to specific accounts for automatic progress tracking.',
  },
  tags: {
    title: 'Transaction Tags',
    content:
      'Add multiple tags to transactions for flexible organization. Use tags for projects, tax categories, or any custom grouping you need.',
  },
  investmentTracking: {
    title: 'Investment Tracking',
    content:
      'Track portfolio performance, holdings, and returns. Add individual stocks or funds to investment accounts. View allocation charts and performance over time.',
  },
  currencyConversion: {
    title: 'Multi-Currency Support',
    content:
      'Each account can have its own currency. Transactions are automatically converted to your base currency for net worth calculations using current exchange rates.',
  },
  importExport: {
    title: 'Data Import/Export',
    content:
      'Import transactions from CSV, QIF, or OFX files. Export your data anytime for backup or analysis in other tools. Supports custom field mapping.',
  },
  offlineMode: {
    title: 'Offline Mode',
    content:
      'Continue working without internet. Changes sync automatically when you reconnect. Conflicts are resolved with a merge strategy that preserves all data.',
  },
  bulkEdit: {
    title: 'Bulk Operations',
    content:
      'Select multiple transactions to edit or delete at once. Use filters to find transactions, then apply changes to all selected items simultaneously.',
  },
  advancedFilters: {
    title: 'Advanced Filtering',
    content:
      'Combine multiple filters: date range, amount range, categories, accounts, and search text. Save filter combinations for quick access later.',
  },
  netWorthTracking: {
    title: 'Net Worth Calculation',
    content: (
      <div>
        <p className="mb-2">Your total assets minus total liabilities:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Assets: Cash, investments, property</li>
          <li>Liabilities: Loans, credit cards, mortgages</li>
        </ul>
        <p className="mt-2">Updated in real-time as you add transactions.</p>
      </div>
    ),
  },
  attachments: {
    title: 'Document Attachments',
    content:
      'Attach receipts, invoices, or documents to transactions. Supports images and PDFs. Files are securely stored and can be viewed anytime.',
  },
  aiCategorization: {
    title: 'Smart Categorization',
    content:
      'AI learns from your categorization patterns. New transactions are automatically categorized based on description, amount, and past behavior.',
  },
  reports: {
    title: 'Financial Reports',
    content:
      'Generate detailed reports: income/expense, cash flow, category breakdown, and trends. Export reports as PDF or CSV for sharing or archiving.',
  },
} as const;

export type HelpContentKey = keyof typeof HELP_CONTENT;
