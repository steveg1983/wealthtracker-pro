import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, WalletIcon, BarChart3Icon, CheckCircleIcon, TagIcon, TrendingUpIcon, SettingsIcon, PlusIcon, XIcon } from './icons';

interface MobileNavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

/**
 * Five slots for the things you do on a phone. Budget and Goals used to hold
 * two of them: both are desk work — you sit down to plan, you don't plan in a
 * queue — and neither is something you reach for while standing in a shop.
 * Reconcile and Review are the opposite: they are the two chores that decide
 * whether the numbers can be trusted, and they are made of small decisions
 * that suit a phone. Budget and Goals keep their places in the menu.
 *
 * Home pointed at "/" until now, which is the public welcome page — a signed-in
 * user tapping Home got the marketing pitch. It points at the dashboard, which
 * is what the desktop nav has always meant by Home.
 */
const mobileNavItems: MobileNavItem[] = [
  { to: '/dashboard', icon: HomeIcon, label: 'Home' },
  { to: '/accounts', icon: WalletIcon, label: 'Accounts' },
  { to: '/transactions', icon: BarChart3Icon, label: 'Transactions' },
  { to: '/reconciliation', icon: CheckCircleIcon, label: 'Reconcile' },
  { to: '/categorisation', icon: TagIcon, label: 'Review' },
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
              <BarChart3Icon size={20} />
              <span>Add Transaction</span>
            </Link>
            <Link
              to="/accounts?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <WalletIcon size={20} />
              <span>Add Account</span>
            </Link>
            <Link
              to="/budget?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <TrendingUpIcon size={20} />
              <span>Add Budget</span>
            </Link>
            <Link
              to="/goals?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <SettingsIcon size={20} />
              <span>Set Goal</span>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Action Button */}
      <button
        onClick={() => setShowQuickActions(!showQuickActions)}
        // Rides on top of the safe-area inset the nav below now honours,
        // rather than a bare 5rem: the nav grew by the inset, so a fixed
        // offset would have put this button through it on any notched phone.
        className={`md:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 w-14 h-14 bg-primary dark:bg-[#1a2332] text-white rounded-full shadow-lg z-50 flex items-center justify-center transition-transform ${
          showQuickActions ? 'rotate-45' : ''
        }`}
        aria-label="Quick actions"
      >
        {showQuickActions ? <XIcon size={24} /> : <PlusIcon size={24} />}
      </button>

      {/* safe-padding-bottom keeps the labels clear of the iPhone home
          indicator. The bar itself still runs to the physical bottom edge —
          padding, not margin — so the background reaches the screen edge the
          way a native tab bar does, and only the content is inset. The class
          has existed in index.css since the beginning and had never been used
          anywhere; with the status bar now translucent, the insets are ours to
          honour. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-padding-bottom"
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
                  ? 'text-primary bg-[#1a2332]/10' 
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