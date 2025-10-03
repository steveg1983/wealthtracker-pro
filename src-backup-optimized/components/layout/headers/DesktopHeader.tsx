import React, { useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { SearchIcon } from '../../icons';
import EnhancedNotificationBell from '../../EnhancedNotificationBell';
import { useLogger } from '../services/ServiceProvider';

// Import if available, otherwise will be passed as prop
let RealtimeStatusDot: React.FC | undefined;
try {
  const module = require('../../RealtimeStatusDot');
  RealtimeStatusDot = module.default || module.RealtimeStatusDot;
} catch {
  // Component not available
}

interface DesktopHeaderProps {
  openSearch: () => void;
}

export function DesktopHeader({ openSearch  }: DesktopHeaderProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <>
      {/* Desktop Search Bar - Always Visible */}
      <div className="hidden md:block sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1 max-w-2xl">
            <button
              onClick={openSearch}
              className="w-full flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-left transition-colors group"
              aria-label="Search transactions, accounts, and more"
            >
              <SearchIcon size={20} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                Search transactions, accounts, budgets...
              </span>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono">
                Ctrl+K
              </span>
            </button>
          </div>
          <div className="flex items-center gap-4 ml-6">
            {/* Global Explain button */}
            <div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-explain', { detail: { route: window.location.pathname } }))}
                className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                title="Explain this page"
                aria-label="Explain this page"
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-500"><path d="M12 3a6 6 0 00-4.472 9.999c.346.4.542.912.542 1.44V16a1 1 0 001 1h6a1 1 0 001-1v-1.56c0-.528.196-1.04.542-1.44A6 6 0 0012 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <span className="text-sm font-medium">Explain</span>
                </span>
              </button>
            </div>
            <EnhancedNotificationBell />
            {RealtimeStatusDot && <RealtimeStatusDot />}
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-xl",
                  userButtonPopoverActions: "mt-2"
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Notification Bell, User Profile and Theme Switcher */}
      <div className="hidden md:flex items-center gap-3 fixed top-4 right-4 z-30" role="toolbar" aria-label="User tools">
        <EnhancedNotificationBell />
        {RealtimeStatusDot && <RealtimeStatusDot />}
        <UserButton 
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-10 h-10",
              userButtonPopoverCard: "shadow-xl",
              userButtonPopoverActions: "mt-2"
            }
          }}
        />
      </div>
    </>
  );
}