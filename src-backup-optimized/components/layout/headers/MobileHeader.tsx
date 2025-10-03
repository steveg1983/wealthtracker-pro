import React, { useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { MenuIcon, XIcon, SearchIcon } from '../../icons';
import EnhancedNotificationBell from '../../EnhancedNotificationBell';
import { useLogger } from '../services/ServiceProvider';

interface MobileHeaderProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  openSearch: () => void;
}

export function MobileHeader({ isMobileMenuOpen, toggleMobileMenu, openSearch  }: MobileHeaderProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-md" role="banner">
      <div className="flex items-center justify-between p-4">
        <button
          onClick={toggleMobileMenu}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
          title={isMobileMenuOpen ? 'Close menu (Escape)' : 'Open menu (Alt+M)'}
        >
          {isMobileMenuOpen ? <XIcon size={24} className="text-gray-700 dark:text-gray-200" /> : <MenuIcon size={24} className="text-gray-700 dark:text-gray-200" />}
        </button>
        
        <h1 className="text-lg font-bold text-gray-900 dark:text-white" id="mobile-app-title">Wealth Tracker</h1>
        
        <div className="flex items-center gap-2">
          <EnhancedNotificationBell />
          <button
            onClick={openSearch}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Search"
          >
            <SearchIcon size={20} className="text-gray-700 dark:text-gray-200" />
          </button>
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
    </header>
  );
}