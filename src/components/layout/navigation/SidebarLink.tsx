import React, { useEffect, memo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon } from '../../icons';
import { NavigationBadge } from '../../ActivityBadge';
import { useLayout } from '../../../contexts/LayoutContext';
import { useRoutePrefetch } from '../../../hooks/useRoutePrefetch';
import { logger } from '../../../services/loggingService';

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  hasSubItems?: boolean;
  isSubItem?: boolean;
  onNavigate?: () => void;
}

export const SidebarLink = memo(function SidebarLink({ 
  to, 
  icon: Icon, 
  label, 
  isCollapsed, 
  hasSubItems, 
  isSubItem, 
  onNavigate 
}: SidebarLinkProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SidebarLink component initialized', {
      componentName: 'SidebarLink'
    });
  }, []);

  const location = useLocation();
  const { isWideView } = useLayout();
  const prefetch = useRoutePrefetch();
  const isActive = !isWideView && (location.pathname === to || 
    (hasSubItems && location.pathname.startsWith(to)) ||
    (to === '/accounts' && (location.pathname.startsWith('/transactions') || location.pathname.startsWith('/reconciliation'))) ||
    (to === '/forecasting' && (location.pathname.startsWith('/budget') || location.pathname.startsWith('/goals'))));

  // Preserve demo mode parameter in navigation
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  const handleLinkClick = () => {
    // For mobile menu, close it
    if (onNavigate) {
      onNavigate();
    }
  };

  // Prefetch route on hover or focus
  const handleMouseEnter = useCallback(() => {
    prefetch(to);
  }, [to, prefetch]);

  const handleFocus = useCallback(() => {
    prefetch(to);
  }, [to, prefetch]);

  const content = (
    <>
      <Icon size={18} />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-sm">{label}</span>
          {hasSubItems && (
            <ChevronRightIcon size={14} className="text-gray-400" />
          )}
        </>
      )}
    </>
  );

  const className = `flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
    isSubItem ? 'ml-5 text-xs' : ''
  } ${
    isCollapsed ? 'sidebar-link-collapsed' : ''
  } ${
    isActive
      ? isCollapsed
        ? 'text-black dark:text-white'
        : 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
      : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
  }`;

  return (
    <Link
      to={linkTo}
      className={className}
      title={isCollapsed ? label : undefined}
      onClick={handleLinkClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
      {!isCollapsed && hasSubItems && <NavigationBadge type={label === 'Accounts' ? 'account' : label === 'Budget' ? 'budget' : undefined} />}
    </Link>
  );
});