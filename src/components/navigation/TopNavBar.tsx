import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import AddAccountModal from '../AddAccountModal';
import AddTransactionModal from '../AddTransactionModal';
import CategoryCreationModal from '../CategoryCreationModal';
import AddInvestmentModal from '../AddInvestmentModal';
import { 
  HomeIcon, 
  ChartBarIcon, 
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  BellIcon,
  UserCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CalculatorIcon,
  ChartPieIcon,
  FlagIcon,
  SparklesIcon,
  DocumentChartBarIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  PlusCircleIcon,
  BanknotesIcon as TransactionIcon,
  FolderPlusIcon,
  TagIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

interface MenuItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  divider?: boolean;
  action?: () => void;
}

// Navigation items will be populated with translations in the component
const getNavigationItems = (t: (key: string) => string): MenuItem[] => [
  {
    label: t('navigation.dashboard'),
    path: '/dashboard',
    icon: <HomeIcon className="w-4 h-4" />
  },
  {
    label: t('navigation.money'),
    icon: <CurrencyDollarIcon className="w-4 h-4" />,
    children: [
      { label: t('navigation.accounts'), path: '/accounts', icon: <BuildingLibraryIcon className="w-4 h-4" /> },
      { label: t('navigation.transactions'), path: '/transactions', icon: <BanknotesIcon className="w-4 h-4" /> },
      { label: t('navigation.transferCenter'), path: '/transfer-center', icon: <ArrowTrendingUpIcon className="w-4 h-4" /> },
      { label: '', divider: true },
      { label: t('navigation.bankConnections'), path: '/settings/bank-connections', icon: <CreditCardIcon className="w-4 h-4" /> },
      { label: t('navigation.importData'), path: '/import', icon: <DocumentTextIcon className="w-4 h-4" /> },
      { label: t('navigation.exportData'), path: '/export', icon: <DocumentChartBarIcon className="w-4 h-4" /> }
    ]
  },
  {
    label: t('navigation.planning'),
    icon: <ChartBarIcon className="w-4 h-4" />,
    children: [
      { label: t('navigation.budget'), path: '/budget', icon: <CalculatorIcon className="w-4 h-4" /> },
      { label: t('navigation.goals'), path: '/goals', icon: <FlagIcon className="w-4 h-4" /> },
      { label: t('navigation.financialPlanning'), path: '/financial-planning', icon: <ChartPieIcon className="w-4 h-4" /> },
      { label: '', divider: true },
      { label: t('navigation.forecasting'), path: '/forecasting', icon: <ArrowTrendingUpIcon className="w-4 h-4" /> },
      { label: t('navigation.scenarios'), path: '/scenarios', icon: <SparklesIcon className="w-4 h-4" /> }
    ]
  },
  {
    label: t('navigation.analytics'),
    icon: <ChartPieIcon className="w-4 h-4" />,
    children: [
      { label: t('navigation.reports'), path: '/analytics', icon: <DocumentChartBarIcon className="w-4 h-4" /> },
      { label: t('navigation.customReports'), path: '/custom-reports', icon: <DocumentTextIcon className="w-4 h-4" /> },
      { label: t('navigation.advancedAnalytics'), path: '/advanced-analytics', icon: <ChartBarIcon className="w-4 h-4" /> },
      { label: '', divider: true },
      { label: t('navigation.cashFlow'), path: '/cash-flow', icon: <BanknotesIcon className="w-4 h-4" /> },
      { label: t('navigation.netWorth'), path: '/net-worth', icon: <CurrencyDollarIcon className="w-4 h-4" /> }
    ]
  },
  {
    label: t('navigation.investments'),
    path: '/investments',
    icon: <ArrowTrendingUpIcon className="w-4 h-4" />
  }
];

export default function TopNavBar(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, signOut, user } = useAuth() as any;
  const { t } = useTranslation();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [preSelectedAccountId, setPreSelectedAccountId] = useState<string | undefined>();
  const [hoveredDropdownIndex, setHoveredDropdownIndex] = useState<number | null>(null);
  const [hoveredUserMenuIndex, setHoveredUserMenuIndex] = useState<number | null>(null);
  const [dropdownItemPositions, setDropdownItemPositions] = useState<{ [key: string]: number[] }>({});
  const [userMenuPositions, setUserMenuPositions] = useState<number[]>([]);
  const dropdownItemRefs = useRef<{ [key: string]: (HTMLElement | null)[] }>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
      if (!target.closest('.help-menu-container')) {
        setShowHelp(false);
      }
      if (!target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setActiveDropdown(label);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 100);
  };

  const isActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return item.children.some(child => child.path === location.pathname);
    }
    return false;
  };

  // Get context for the Add button based on current route
  const getAddContext = (): { type: string; label: string; icon: React.ReactNode; accountId?: string } => {
    const path = location.pathname;
    
    // Extract account ID from path if on account detail page
    const accountMatch = path.match(/\/accounts\/([^/]+)/);
    const accountId = accountMatch ? accountMatch[1] : undefined;
    
    if (path === '/accounts') return { 
      type: 'account', 
      label: t('actions.addAccount'),
      icon: <BuildingLibraryIcon className="w-4 h-4" />
    };
    
    if (path.startsWith('/accounts/')) return { 
      type: 'transaction', 
      label: t('actions.addTransaction'),
      icon: <TransactionIcon className="w-4 h-4" />,
      accountId // Pass the account ID for pre-selection
    };
    
    if (path === '/transactions') return { 
      type: 'transaction', 
      label: t('actions.addTransaction'),
      icon: <TransactionIcon className="w-4 h-4" />
    };
    
    if (path.includes('/categories')) return { 
      type: 'category', 
      label: t('actions.addCategory'),
      icon: <TagIcon className="w-4 h-4" />
    };
    
    if (path === '/investments') return { 
      type: 'investment', 
      label: t('actions.addInvestment'),
      icon: <ArrowTrendingUpIcon className="w-4 h-4" />
    };
    
    if (path === '/budget') return { 
      type: 'budget', 
      label: t('actions.addBudgetItem'),
      icon: <CalculatorIcon className="w-4 h-4" />
    };
    
    if (path === '/goals') return { 
      type: 'goal', 
      label: t('actions.addGoal'),
      icon: <TrophyIcon className="w-4 h-4" />
    };
    
    // Default to transaction for most pages
    return { 
      type: 'transaction', 
      label: t('navigation.add'),
      icon: <PlusIcon className="w-4 h-4" />
    };
  };

  // Handle Add button click based on context
  const handleAddClick = (): void => {
    const context = getAddContext();
    
    switch (context.type) {
      case 'account':
        setShowAddAccountModal(true);
        break;
      case 'transaction':
        // Set pre-selected account if we're on an account detail page
        if (context.accountId) {
          setPreSelectedAccountId(context.accountId);
        }
        setShowAddTransactionModal(true);
        break;
      case 'category':
        setShowCategoryModal(true);
        break;
      case 'investment':
        setShowInvestmentModal(true);
        break;
      case 'budget':
      case 'goal':
        // For now, default to transaction modal until specific modals are created
        setShowAddTransactionModal(true);
        break;
      default:
        setShowAddTransactionModal(true);
    }
  };

  const addContext = getAddContext();
  
  // Keyboard shortcut for context-aware add
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleAddClick();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [location.pathname]); // Re-bind when route changes

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="w-full px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                WealthTracker
              </span>
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="flex items-center space-x-1">
            {getNavigationItems(t).map((item) => (
              <div
                key={item.label}
                className="dropdown-container relative"
                onMouseEnter={() => item.children && handleMouseEnter(item.label)}
                onMouseLeave={() => {
                  handleMouseLeave();
                  setHoveredDropdownIndex(null);
                }}
              >
                {item.path ? (
                  <Link
                    to={item.path}
                    className={`
                      flex items-center px-4 py-2 text-sm font-medium rounded-lg
                      transition-all duration-200 hover:scale-105
                      ${isActive(item)
                        ? 'bg-secondary text-white'
                        : 'bg-secondary text-white hover:bg-secondary/80'
                      }
                    `}
                  >
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    className={`
                      flex items-center px-4 py-2 text-sm font-medium rounded-lg
                      transition-all duration-200 hover:scale-105
                      ${isActive(item)
                        ? 'bg-secondary text-white'
                        : 'bg-secondary text-white hover:bg-secondary/80'
                      }
                    `}
                  >
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                    {item.children && (
                      <ChevronDownIcon className={`ml-1 w-4 h-4 transition-transform ${
                        activeDropdown === item.label ? 'rotate-180' : ''
                      }`} />
                    )}
                  </button>
                )}

                {/* Dropdown Menu */}
                {item.children && activeDropdown === item.label && (
                  <div
                    ref={(el) => {
                      dropdownRefs.current[item.label] = el;
                      // Calculate positions after render
                      if (el) {
                        setTimeout(() => {
                          const positions: number[] = [];
                          const items = el.querySelectorAll('[data-menu-item]');
                          items.forEach((item) => {
                            const rect = item.getBoundingClientRect();
                            const parentRect = el.getBoundingClientRect();
                            positions.push(rect.top - parentRect.top);
                          });
                          setDropdownItemPositions(prev => ({ ...prev, [item.label]: positions }));
                        }, 0);
                      }
                    }}
                    className="absolute z-[9999] mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 overflow-visible"
                  >
                    {/* Floating Highlight - Enhanced Bubble Effect */}
                    <div
                      className="absolute left-2 right-2 h-8 transition-all duration-200 ease-out pointer-events-none"
                      style={{
                        transform: hoveredDropdownIndex !== null && dropdownItemPositions[item.label]
                          ? `translateY(${dropdownItemPositions[item.label][hoveredDropdownIndex] - 4}px) scale(1.02)` 
                          : 'translateY(-40px) scale(0.95)',
                        opacity: hoveredDropdownIndex !== null ? 1 : 0,
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
                        boxShadow: hoveredDropdownIndex !== null 
                          ? '0 6px 16px rgba(59, 130, 246, 0.15), 0 2px 6px rgba(59, 130, 246, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
                          : 'none',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(59, 130, 246, 0.1)',
                        zIndex: 0
                      }}
                    />
                    
                    {/* Menu Items */}
                    {item.children?.map((child, index) => {
                      // Track the actual item index (skip dividers)
                      const itemIndex = item.children?.slice(0, index).filter(c => !c.divider).length || 0;
                      
                      return (
                        <React.Fragment key={index}>
                          {child.divider ? (
                            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                          ) : (
                            <Link
                              to={child.path!}
                              data-menu-item
                              className="relative flex items-center px-4 py-2 text-sm transition-all duration-200 z-10"
                              style={{
                                color: hoveredDropdownIndex === itemIndex 
                                  ? 'rgb(59, 130, 246)' 
                                  : '',
                                transform: hoveredDropdownIndex === itemIndex 
                                  ? 'translateX(2px)' 
                                  : 'translateX(0)',
                              }}
                              onMouseEnter={() => setHoveredDropdownIndex(itemIndex)}
                              onClick={() => {
                                setActiveDropdown(null);
                                setHoveredDropdownIndex(null);
                              }}
                            >
                              <div className={`transition-all duration-200 ${hoveredDropdownIndex === itemIndex ? 'scale-110' : 'scale-100'}`}>
                                {child.icon}
                              </div>
                              <span className={`ml-3 font-medium transition-all duration-200 ${
                                hoveredDropdownIndex === itemIndex 
                                  ? 'text-gray-600 dark:text-gray-500' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {child.label}
                              </span>
                            </Link>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* Context-Aware Add Button */}
            <button 
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white hover:bg-secondary/80 transition-all duration-200 hover:scale-105"
              title={`${addContext.label} (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+N)`}
            >
              <span className="transition-all duration-200">
                {addContext.icon}
              </span>
              <span className="text-sm transition-all duration-200">{addContext.label}</span>
            </button>

            {/* Help Menu */}
            <div className="help-menu-container relative">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white hover:bg-secondary/80 rounded-lg transition-all duration-200 hover:scale-105"
              >
                <QuestionMarkCircleIcon className="w-4 h-4" />
                <span className="text-sm">{t('navigation.help')}</span>
              </button>
              
              {showHelp && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-[9999]">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('help.getHelp')}</h3>
                  
                  <div className="space-y-3">
                    <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.showPageTips')}</span>
                        <div className="w-12 h-6 bg-gray-200 dark:bg-gray-600 rounded-full relative">
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div>
                        </div>
                      </div>
                    </button>
                    
                    <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.keyboardShortcuts')}</span>
                    </button>
                    
                    <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.visitHelpCenter')}</span>
                    </button>
                    
                    <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.contactSupport')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="notifications-container relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white hover:bg-secondary/80 rounded-lg transition-all duration-200 hover:scale-105 relative"
              >
                <BellIcon className="w-4 h-4" />
                <span className="text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {unreadCount} unread
                          </span>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={() => markAllAsRead()}
                            className="text-xs text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map((notification) => (
                        <div 
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-blue-50/50 dark:bg-gray-900/10' : ''
                          }`}
                          onClick={() => {
                            if (!notification.read) {
                              markAsRead(notification.id);
                            }
                            if (notification.action) {
                              notification.action.onClick();
                              setShowNotifications(false);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="flex-shrink-0">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                notification.type === 'success' ? 'bg-green-500' :
                                notification.type === 'warning' ? 'bg-yellow-500' :
                                notification.type === 'error' ? 'bg-red-500' :
                                'bg-gray-500'
                              }`}></div>
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm ${!notification.read ? 'font-semibold' : ''} text-gray-900 dark:text-white`}>
                                {notification.title}
                              </p>
                              {notification.message && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {notification.message}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                              </p>
                              {notification.action && (
                                <button className="text-xs text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mt-2 font-medium">
                                  {notification.action.label}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <BellIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No notifications yet
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          You'll see budget alerts, transaction updates, and goal achievements here
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                      <button 
                        onClick={() => clearAll()}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Clear all
                      </button>
                      <Link 
                        to="/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium"
                      >
                        View all
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div 
              className="user-menu-container relative"
              onMouseEnter={() => {
                if (userMenuTimeoutRef.current) {
                  clearTimeout(userMenuTimeoutRef.current);
                }
                setShowUserMenu(true);
              }}
              onMouseLeave={() => {
                userMenuTimeoutRef.current = setTimeout(() => {
                  setShowUserMenu(false);
                  setHoveredUserMenuIndex(null);
                }, 100);
              }}
            >
              <button
                className="flex items-center space-x-2 p-2 bg-secondary text-white hover:bg-secondary/80 rounded-lg transition-all duration-200 hover:scale-105"
              >
                <UserCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">{user?.firstName || t('navigation.account')}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div 
                  ref={(el) => {
                    if (el) {
                      setTimeout(() => {
                        const positions: number[] = [];
                        const items = el.querySelectorAll('[data-user-menu-item]');
                        items.forEach((item) => {
                          const rect = item.getBoundingClientRect();
                          const parentRect = el.getBoundingClientRect();
                          positions.push(rect.top - parentRect.top);
                        });
                        setUserMenuPositions(positions);
                      }, 0);
                    }
                  }}
                  className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-[9999] overflow-visible"
                >
                  {/* Floating Highlight - Enhanced Bubble Effect */}
                  <div
                    className="absolute left-2 right-2 h-8 transition-all duration-200 ease-out pointer-events-none"
                    style={{
                      transform: hoveredUserMenuIndex !== null && userMenuPositions[hoveredUserMenuIndex] !== undefined
                        ? `translateY(${userMenuPositions[hoveredUserMenuIndex] - 4}px) scale(1.02)` 
                        : 'translateY(-40px) scale(0.95)',
                      opacity: hoveredUserMenuIndex !== null ? 1 : 0,
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
                      boxShadow: hoveredUserMenuIndex !== null 
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
                      color: hoveredUserMenuIndex === 0 ? 'rgb(59, 130, 246)' : '',
                      transform: hoveredUserMenuIndex === 0 ? 'translateX(2px)' : 'translateX(0)',
                    }}
                    onMouseEnter={() => setHoveredUserMenuIndex(0)}
                    onClick={() => {
                      setShowUserMenu(false);
                      setHoveredUserMenuIndex(null);
                    }}
                  >
                    <CogIcon className={`w-4 h-4 mr-2 transition-all duration-200 ${hoveredUserMenuIndex === 0 ? 'scale-110' : 'scale-100'}`} />
                    <span className={`font-medium transition-all duration-200 ${
                      hoveredUserMenuIndex === 0 
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
                      color: hoveredUserMenuIndex === 1 ? 'rgb(59, 130, 246)' : '',
                      transform: hoveredUserMenuIndex === 1 ? 'translateX(2px)' : 'translateX(0)',
                    }}
                    onMouseEnter={() => setHoveredUserMenuIndex(1)}
                    onClick={() => {
                      setShowUserMenu(false);
                      setHoveredUserMenuIndex(null);
                    }}
                  >
                    <span className={`font-medium transition-all duration-200 ${
                      hoveredUserMenuIndex === 1 
                        ? 'text-gray-600 dark:text-gray-500' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {t('navigation.subscription')}
                    </span>
                  </Link>
                  <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                  <button
                    data-user-menu-item
                    onClick={() => signOut()}
                    className="relative flex items-center w-full text-left px-4 py-2 text-sm transition-all duration-200 z-10"
                    style={{
                      transform: hoveredUserMenuIndex === 2 ? 'translateX(2px)' : 'translateX(0)',
                    }}
                    onMouseEnter={() => setHoveredUserMenuIndex(2)}
                  >
                    <span className={`font-medium transition-all duration-200 ${
                      hoveredUserMenuIndex === 2 
                        ? 'text-red-700 dark:text-red-300' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {t('navigation.signOut')}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>

    {/* Context-aware modals */}
    <AddAccountModal 
      isOpen={showAddAccountModal} 
      onClose={() => setShowAddAccountModal(false)} 
    />

    <AddTransactionModal 
      isOpen={showAddTransactionModal} 
      onClose={() => {
        setShowAddTransactionModal(false);
        setPreSelectedAccountId(undefined); // Clear pre-selection after closing
      }}
    />

    <CategoryCreationModal
      isOpen={showCategoryModal}
      onClose={() => setShowCategoryModal(false)}
    />

    {showInvestmentModal && (
      <AddInvestmentModal
        isOpen={showInvestmentModal}
        onClose={() => setShowInvestmentModal(false)}
        accountId=""
      />
    )}
    </>
  );
}