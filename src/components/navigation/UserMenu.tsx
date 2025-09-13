import React, { useState, useRef, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { UserCircleIcon, ChevronDownIcon, CogIcon } from '@heroicons/react/24/outline';
import { logger } from '../../services/loggingService';

interface UserMenuProps {
  userName?: string;
  onSignOut: () => void;
  t: (key: string) => string;
}

export const UserMenu = memo(function UserMenu({ userName, onSignOut, t }: UserMenuProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('UserMenu component initialized', {
        userName: userName || 'anonymous',
        componentName: 'UserMenu'
      });
    } catch (error) {
      logger.error('UserMenu initialization failed:', error, 'UserMenu');
    }
  }, [userName]);

  const [showMenu, setShowMenu] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [menuPositions, setMenuPositions] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (menuRef.current && showMenu) {
      const positions: number[] = [];
      const items = menuRef.current.querySelectorAll('[data-user-menu-item]');
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const parentRect = menuRef.current!.getBoundingClientRect();
        positions.push(rect.top - parentRect.top);
      });
      setMenuPositions(positions);
    }
  }, [showMenu]);

  const handleMouseEnter = () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      logger.debug('User menu opened', { componentName: 'UserMenu' });
      setShowMenu(true);
    } catch (error) {
      logger.error('Failed to handle mouse enter:', error, 'UserMenu');
    }
  };

  const handleMouseLeave = () => {
    try {
      timeoutRef.current = setTimeout(() => {
        try {
          logger.debug('User menu closed', { componentName: 'UserMenu' });
          setShowMenu(false);
          setHoveredIndex(null);
        } catch (timeoutError) {
          logger.error('Failed to close menu in timeout:', timeoutError, 'UserMenu');
        }
      }, 100);
    } catch (error) {
      logger.error('Failed to handle mouse leave:', error, 'UserMenu');
    }
  };

  try {
    return (
      <div 
        className="user-menu-container relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
      <button
        className="flex items-center space-x-2 p-2 bg-secondary text-white hover:bg-secondary/80 rounded-lg transition-all duration-200 hover:scale-105"
      >
        <UserCircleIcon className="w-5 h-5" />
        <span className="text-sm font-medium">{userName || t('navigation.account')}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {showMenu && (
        <div 
          ref={menuRef}
          className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-[9999] overflow-visible"
        >
          {/* Floating Highlight */}
          <div
            className="absolute left-2 right-2 h-8 transition-all duration-200 ease-out pointer-events-none"
            style={{
              transform: hoveredIndex !== null && menuPositions[hoveredIndex] !== undefined
                ? `translateY(${menuPositions[hoveredIndex] - 4}px) scale(1.02)` 
                : 'translateY(-40px) scale(0.95)',
              opacity: hoveredIndex !== null ? 1 : 0,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
              boxShadow: hoveredIndex !== null 
                ? '0 6px 16px rgba(59, 130, 246, 0.15), 0 2px 6px rgba(59, 130, 246, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
                : 'none',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              zIndex: 0
            }}
          />
          
          <Link
            to="/settings"
            data-user-menu-item
            className="relative flex items-center px-4 py-2 text-sm transition-all duration-200 z-10"
            style={{
              color: hoveredIndex === 0 ? 'rgb(59, 130, 246)' : '',
              transform: hoveredIndex === 0 ? 'translateX(2px)' : 'translateX(0)',
            }}
            onMouseEnter={() => setHoveredIndex(0)}
            onClick={() => {
              setShowMenu(false);
              setHoveredIndex(null);
            }}
          >
            <CogIcon className={`w-4 h-4 mr-2 transition-all duration-200 ${hoveredIndex === 0 ? 'scale-110' : 'scale-100'}`} />
            <span className={`font-medium transition-all duration-200 ${
              hoveredIndex === 0 
                ? 'text-gray-600 dark:text-gray-500' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {t('navigation.settings')}
            </span>
          </Link>
          
          <Link
            to="/subscription"
            data-user-menu-item
            className="relative flex items-center px-4 py-2 text-sm transition-all duration-200 z-10"
            style={{
              color: hoveredIndex === 1 ? 'rgb(59, 130, 246)' : '',
              transform: hoveredIndex === 1 ? 'translateX(2px)' : 'translateX(0)',
            }}
            onMouseEnter={() => setHoveredIndex(1)}
            onClick={() => {
              setShowMenu(false);
              setHoveredIndex(null);
            }}
          >
            <span className={`font-medium transition-all duration-200 ${
              hoveredIndex === 1 
                ? 'text-gray-600 dark:text-gray-500' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {t('navigation.subscription')}
            </span>
          </Link>
          
          <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
          
          <button
            data-user-menu-item
            onClick={onSignOut}
            className="relative flex items-center w-full text-left px-4 py-2 text-sm transition-all duration-200 z-10"
            style={{
              transform: hoveredIndex === 2 ? 'translateX(2px)' : 'translateX(0)',
            }}
            onMouseEnter={() => setHoveredIndex(2)}
          >
            <span className={`font-medium transition-all duration-200 ${
              hoveredIndex === 2 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {t('navigation.signOut')}
            </span>
          </button>
        </div>
      )}
    </div>
    );
  } catch (error) {
    logger.error('Failed to render UserMenu:', error, 'UserMenu');
    return (
      <div className="user-menu-container relative">
        <button
          className="flex items-center space-x-2 p-2 bg-red-500 text-white rounded-lg"
          onClick={() => {
            try {
              onSignOut();
            } catch (signOutError) {
              logger.error('Failed to sign out from error state:', signOutError, 'UserMenu');
            }
          }}
        >
          <span className="text-sm">Menu Error</span>
        </button>
      </div>
    );
  }
});