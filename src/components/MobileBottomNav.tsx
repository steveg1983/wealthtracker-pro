import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, WalletIcon, TrendingUpIcon, BarChart3Icon, SettingsIcon, PlusIcon, XIcon } from './icons';

interface MobileNavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

const mobileNavItems: MobileNavItem[] = [
  { to: '/', icon: HomeIcon, label: 'Home' },
  { to: '/accounts', icon: WalletIcon, label: 'Accounts' },
  { to: '/investments', icon: TrendingUpIcon, label: 'Invest' },
  { to: '/analytics', icon: BarChart3Icon, label: 'Analytics' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function MobileBottomNav(): React.JSX.Element {
  const location = useLocation();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Quick Actions Menu */}
      {showQuickActions && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowQuickActions(false)}
        >
          <div className="absolute bottom-20 right-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-2 min-w-[200px]">
            <Link
              to="/transactions?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <WalletIcon size={20} />
              <span>Add Transaction</span>
            </Link>
            <Link
              to="/accounts?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <PlusIcon size={20} />
              <span>Add Account</span>
            </Link>
            <Link
              to="/goals?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <TrendingUpIcon size={20} />
              <span>Set Goal</span>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Action Button */}
      <button
        onClick={() => setShowQuickActions(!showQuickActions)}
        className={`md:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary dark:bg-blue-600 text-white rounded-full shadow-lg z-50 flex items-center justify-center transition-transform ${
          showQuickActions ? 'rotate-45' : ''
        }`}
        aria-label="Quick actions"
      >
        {showQuickActions ? <XIcon size={24} /> : <PlusIcon size={24} />}
      </button>

      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center py-2 px-2 max-w-sm mx-auto">
        {mobileNavItems.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-2 px-1 rounded-lg transition-colors ${
                active 
                  ? 'text-primary bg-primary/10' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={22} />
                {item.badge && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1 truncate max-w-full ${
                active ? 'font-medium' : 'font-normal'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}