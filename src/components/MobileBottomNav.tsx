import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, WalletIcon, TrendingUpIcon, BarChart3Icon, SettingsIcon } from './icons';

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

export default function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
      <div className="flex justify-around items-center py-2 px-2 max-w-sm mx-auto">
        {mobileNavItems.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 rounded-lg transition-colors ${
                active 
                  ? 'text-primary bg-primary/10' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="relative">
                <Icon size={20} />
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
  );
}