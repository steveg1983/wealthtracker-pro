import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '../icons';
import { preserveDemoParam } from '../../utils/navigation';

interface BreadcrumbItem {
  label: string;
  path: string;
}

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
  'enhanced-import': 'Enhanced Import',
  'export-manager': 'Export Manager',
  'documents': 'Documents',
  'open-banking': 'Open Banking',
  'reconciliation': 'Reconciliation',
  'ai-features': 'AI Features'
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on home page
  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', path: preserveDemoParam('/', location.search) }
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label, path: preserveDemoParam(currentPath, location.search) });
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:block">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={crumb.path} className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon 
                  size={16} 
                  className="mx-2 text-gray-400 dark:text-gray-600" 
                />
              )}
              
              {isLast ? (
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {index === 0 && <HomeIcon size={16} className="inline mr-1" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors"
                >
                  {index === 0 && <HomeIcon size={16} className="inline mr-1" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Mobile breadcrumb with back button
export function MobileBreadcrumb() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show on home page
  if (pathSegments.length === 0) {
    return null;
  }

  const currentPage = pathSegments[pathSegments.length - 1];
  const label = currentPage
    ? (routeLabels[currentPage] || currentPage.charAt(0).toUpperCase() + currentPage.slice(1))
    : 'Home';

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