import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const { accounts } = useApp();
  const searchParams = new URLSearchParams(location.search);
  const accountId = searchParams.get('account');

  // Generate breadcrumb items based on current path
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', path: '/' }
    ];

    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 0) {
      return [];
    }

    // Map paths to breadcrumb items
    pathSegments.forEach((segment) => {
      switch (segment) {
        case 'accounts':
          breadcrumbs.push({ label: 'Accounts', path: '/accounts' });
          break;
        case 'transactions':
          // Add Accounts as parent
          if (!breadcrumbs.some(b => b.path === '/accounts')) {
            breadcrumbs.push({ label: 'Accounts', path: '/accounts' });
          }
          breadcrumbs.push({ label: 'Transactions', path: '/transactions' });
          // If filtered by account, add account name
          if (accountId) {
            const account = accounts.find(a => a.id === accountId);
            if (account) {
              breadcrumbs.push({ 
                label: account.name, 
                path: `/transactions?account=${accountId}` 
              });
            }
          }
          break;
        case 'forecasting':
          breadcrumbs.push({ label: 'Forecasting', path: '/forecasting' });
          break;
        case 'budget':
          // Add Forecasting as parent
          if (!breadcrumbs.some(b => b.path === '/forecasting')) {
            breadcrumbs.push({ label: 'Forecasting', path: '/forecasting' });
          }
          breadcrumbs.push({ label: 'Budget', path: '/budget' });
          break;
        case 'analytics':
          breadcrumbs.push({ label: 'Analytics', path: '/analytics' });
          break;
        case 'goals':
          // Add Forecasting as parent
          if (!breadcrumbs.some(b => b.path === '/forecasting')) {
            breadcrumbs.push({ label: 'Forecasting', path: '/forecasting' });
          }
          breadcrumbs.push({ label: 'Goals', path: '/goals' });
          break;
        case 'investments':
          breadcrumbs.push({ label: 'Investments', path: '/investments' });
          break;
        case 'reconciliation':
          // Add Accounts as parent
          if (!breadcrumbs.some(b => b.path === '/accounts')) {
            breadcrumbs.push({ label: 'Accounts', path: '/accounts' });
          }
          breadcrumbs.push({ label: 'Reconciliation', path: '/reconciliation' });
          break;
        case 'settings':
          breadcrumbs.push({ label: 'Settings', path: '/settings' });
          break;
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Don't show breadcrumbs on dashboard
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm mb-4">
      <Link
        to="/"
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Home size={16} />
      </Link>
      {breadcrumbs.slice(1).map((crumb, index) => (
        <div key={crumb.path} className="flex items-center space-x-2">
          <ChevronRight className="text-gray-400" size={16} />
          {index === breadcrumbs.length - 2 ? (
            <span className="text-gray-900 dark:text-white font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}