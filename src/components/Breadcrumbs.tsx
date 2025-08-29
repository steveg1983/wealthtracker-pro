import { ChevronRight, Home } from './icons';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { preserveDemoParam } from '../utils/navigation';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const { accounts } = useApp();
  const searchParams = new URLSearchParams(location.search);
  const accountId = searchParams.get('account');
  const isDemoMode = searchParams.get('demo') === 'true';

  // Generate breadcrumb items based on current path
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', path: preserveDemoParam('/', location.search) }
    ];

    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 0) {
      return [];
    }

    // Map paths to breadcrumb items
    pathSegments.forEach((segment) => {
      switch (segment) {
        case 'accounts':
          breadcrumbs.push({ label: 'Accounts', path: preserveDemoParam('/accounts', location.search) });
          break;
        case 'transactions':
          // Add Accounts as parent
          if (!breadcrumbs.some(b => b.path.includes('/accounts'))) {
            breadcrumbs.push({ label: 'Accounts', path: preserveDemoParam('/accounts', location.search) });
          }
          breadcrumbs.push({ label: 'Transactions', path: preserveDemoParam('/transactions', location.search) });
          // If filtered by account, add account name
          if (accountId) {
            const account = accounts.find(a => a.id === accountId);
            if (account) {
              breadcrumbs.push({ 
                label: account.name, 
                path: preserveDemoParam(`/transactions?account=${accountId}`, location.search) 
              });
            }
          }
          break;
        case 'forecasting':
          breadcrumbs.push({ label: 'Forecasting', path: preserveDemoParam('/forecasting', location.search) });
          break;
        case 'budget':
          // Add Forecasting as parent
          if (!breadcrumbs.some(b => b.path.includes('/forecasting'))) {
            breadcrumbs.push({ label: 'Forecasting', path: preserveDemoParam('/forecasting', location.search) });
          }
          breadcrumbs.push({ label: 'Budget', path: preserveDemoParam('/budget', location.search) });
          break;
        case 'analytics':
          breadcrumbs.push({ label: 'Analytics', path: preserveDemoParam('/analytics', location.search) });
          break;
        case 'goals':
          // Add Forecasting as parent
          if (!breadcrumbs.some(b => b.path.includes('/forecasting'))) {
            breadcrumbs.push({ label: 'Forecasting', path: preserveDemoParam('/forecasting', location.search) });
          }
          breadcrumbs.push({ label: 'Goals', path: preserveDemoParam('/goals', location.search) });
          break;
        case 'investments':
          breadcrumbs.push({ label: 'Investments', path: preserveDemoParam('/investments', location.search) });
          break;
        case 'reconciliation':
          // Add Accounts as parent
          if (!breadcrumbs.some(b => b.path.includes('/accounts'))) {
            breadcrumbs.push({ label: 'Accounts', path: preserveDemoParam('/accounts', location.search) });
          }
          breadcrumbs.push({ label: 'Reconciliation', path: preserveDemoParam('/reconciliation', location.search) });
          break;
        case 'settings':
          breadcrumbs.push({ label: 'Settings', path: preserveDemoParam('/settings', location.search) });
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
        to={preserveDemoParam('/', location.search)}
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