import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { preserveDemoParam } from '../../utils/navigation';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  accounts: 'Accounts',
  budget: 'Budget',
  goals: 'Goals',
  investments: 'Investments',
  'enhanced-investments': 'Investment Analytics',
  analytics: 'Analytics',
  'ai-analytics': 'AI Analytics',
  'custom-reports': 'Custom Reports',
  'tax-planning': 'Tax Planning',
  household: 'Household',
  'business-features': 'Business Features',
  'financial-planning': 'Financial Planning',
  'data-intelligence': 'Data Intelligence',
  summaries: 'Summaries',
  settings: 'Settings',
  'app': 'App Settings',
  'data': 'Data Management',
  'categories': 'Categories',
  'tags': 'Tags',
  'security': 'Security',
  'enhanced-import': 'Import Data',
  'export-manager': 'Export Data',
  'documents': 'Documents',
  'open-banking': 'Open Banking',
  'reconciliation': 'Reconciliation'
};

// Mobile-only back link to the parent route. Deliberately not a breadcrumb
// trail — the trail was removed app-wide as it crowded narrow viewports.
export function MobileBreadcrumb() {
  const location = useLocation();
  const { accounts } = useApp();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show on home page
  if (pathSegments.length === 0) {
    return null;
  }

  const currentPage = pathSegments[pathSegments.length - 1];
  const matchedAccount = accounts.find(a => a.id === currentPage);
  const label = matchedAccount
    ? matchedAccount.name
    : routeLabels[currentPage] || currentPage.charAt(0).toUpperCase() + currentPage.slice(1);

  // Determine parent path
  const parentPath = pathSegments.length > 1 
    ? `/${pathSegments.slice(0, -1).join('/')}`
    : '/';

  return (
    <div className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <Link
        to={preserveDemoParam(parentPath, location.search)}
        className="flex items-center gap-2 text-primary dark:text-primary-light"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </div>
  );
}
