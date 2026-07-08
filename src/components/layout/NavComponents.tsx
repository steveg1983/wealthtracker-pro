import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, ChevronDownIcon } from '../icons';
import { NavigationBadge } from '../ActivityBadge';
import { isDemoModeRuntimeAllowed } from '../../utils/runtimeMode';

// --- Sidebar Link (used in mobile menu) ---

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  hasSubItems?: boolean;
  isSubItem?: boolean;
  onNavigate?: () => void;
}

export function SidebarLink({ to, icon: Icon, label, isCollapsed, hasSubItems, isSubItem, onNavigate }: SidebarLinkProps): React.JSX.Element {
  const location = useLocation();
  const isActive = location.pathname === to ||
    (hasSubItems && location.pathname.startsWith(to));

  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  const className = `flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
    isSubItem ? 'ml-5 text-xs' : ''
  } ${
    isCollapsed ? 'sidebar-link-collapsed' : ''
  } ${
    isActive
      ? isCollapsed
        ? 'text-white font-medium'
        : 'bg-white/20 text-white font-medium'
      : 'text-white/70 hover:text-white hover:bg-white/10'
  }`;

  return (
    <Link
      to={linkTo}
      className={className}
      title={isCollapsed ? label : undefined}
      onClick={handleLinkClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={isCollapsed ? 24 : 18} />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-sm">{label}</span>
          {hasSubItems && <ChevronRightIcon size={14} className="text-gray-400" />}
        </>
      )}
      {!isCollapsed && hasSubItems && <NavigationBadge type={label === 'Accounts' ? 'account' : label === 'Budget' ? 'budget' : undefined} />}
    </Link>
  );
}

// --- Top Navigation Item ---

export function TopNavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }): React.JSX.Element {
  const location = useLocation();
  const isActive = location.pathname === to;
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  return (
    <Link
      to={linkTo}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-white/20 text-white font-medium'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={16} />
      <span>{label}</span>
    </Link>
  );
}

// --- Top Navigation Dropdown ---

export interface DropdownItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

export function TopNavDropdown({
  label,
  icon: Icon,
  items,
  activePaths,
  openDropdown,
  setOpenDropdown
}: {
  label: string;
  icon: React.ElementType;
  items: DropdownItem[];
  activePaths?: string[];
  openDropdown: string | null;
  setOpenDropdown: (name: string | null) => void;
}): React.JSX.Element {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const isOpen = openDropdown === label;

  const isActive = activePaths
    ? activePaths.some(p => location.pathname === p || location.pathname.startsWith(p))
    : false;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setOpenDropdown]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenDropdown(isOpen ? null : label)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isActive || isOpen
            ? 'bg-white/20 text-white font-medium'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="true"
      >
        <Icon size={16} />
        <span>{label}</span>
        <ChevronDownIcon size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50">
          {items.map(item => {
            const itemTo = isDemoMode ? `${item.to}?demo=true` : item.to;
            const itemActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={itemTo}
                className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  itemActive
                    ? 'bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-white font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setOpenDropdown(null)}
                aria-current={itemActive ? 'page' : undefined}
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
