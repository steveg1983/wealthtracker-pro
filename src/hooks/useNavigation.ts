import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useApp } from '../contexts/AppContextSupabase';
import type { MenuItem } from '../components/navigation/NavigationDropdown';
import {
  HomeIcon,
  ChartBarIcon,
  CurrencyPoundIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  BanknotesIcon,
  CalculatorIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

export function useNavigation() {
  const location = useLocation();
  const { isSignedIn, signOut } = useAuth();
  const appContext = useApp();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [dropdownTimeouts, setDropdownTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(dropdownTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [dropdownTimeouts]);

  // Navigation items configuration
  const navigationItems: MenuItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: 'home'
    },
    {
      label: 'Accounts',
      icon: 'credit-card',
      children: [
        { label: 'All Accounts', path: '/accounts' },
        { label: 'Transactions', path: '/transactions' },
        { label: 'Transfer Center', path: '/transfer-center' },
        { label: '', divider: true },
        { label: 'Import Data', path: '/import' },
        { label: 'Export Data', path: '/export' }
      ]
    },
    {
      label: 'Budgets',
      icon: 'banknotes',
      children: [
        { label: 'Budget Overview', path: '/budgets' },
        { label: 'Zero-Based Budget', path: '/zero-based' },
        { label: 'Spending Trends', path: '/analytics' },
        { label: '', divider: true },
        { label: 'Budget Templates', path: '/budget-templates' },
        { label: 'Shared Budgets', path: '/shared-budgets' }
      ]
    },
    {
      label: 'Goals',
      path: '/goals',
      icon: 'trending-up'
    },
    {
      label: 'Investments',
      icon: 'chart-bar',
      children: [
        { label: 'Portfolio', path: '/investments' },
        { label: 'Performance', path: '/performance' },
        { label: 'Rebalancer', path: '/rebalancer' },
        { label: '', divider: true },
        { label: 'Dividend Tracker', path: '/dividends' },
        { label: 'Tax Lots', path: '/tax-lots' }
      ]
    },
    {
      label: 'Reports',
      icon: 'document-text',
      children: [
        { label: 'Financial Reports', path: '/reports' },
        { label: 'Custom Reports', path: '/custom-reports' },
        { label: 'Scheduled Reports', path: '/scheduled-reports' },
        { label: '', divider: true },
        { label: 'Tax Reports', path: '/tax-reports' },
        { label: 'Year-End Summary', path: '/year-end' }
      ]
    },
    {
      label: 'Planning',
      icon: 'calculator',
      children: [
        { label: 'Retirement Planner', path: '/retirement' },
        { label: 'Debt Payoff', path: '/debt-payoff' },
        { label: 'Mortgage Calculator', path: '/mortgage' },
        { label: '', divider: true },
        { label: 'Tax Calculator', path: '/tax-calculator' },
        { label: 'Emergency Fund', path: '/emergency-fund' }
      ]
    }
  ];

  // Add demo mode indicator if applicable
  // Check for demo mode from URL params or other source
  const urlParams = new URLSearchParams(window.location.search);
  const demoMode = urlParams.get('demo') === 'true';
  
  if (demoMode) {
    navigationItems.push({
      label: 'Demo Mode',
      path: '/demo',
      icon: 'beaker'
    });
  }

  // Dropdown management
  const handleMouseEnterDropdown = useCallback((label: string) => {
    // Clear any existing timeout for this dropdown
    if (dropdownTimeouts[label]) {
      clearTimeout(dropdownTimeouts[label]);
    }
    setActiveDropdown(label);
  }, [dropdownTimeouts]);

  const handleMouseLeaveDropdown = useCallback((label: string) => {
    const timeout = setTimeout(() => {
      setActiveDropdown(prev => prev === label ? null : prev);
    }, 100);
    
    setDropdownTimeouts(prev => ({ ...prev, [label]: timeout }));
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setActiveDropdown(null);
    setShowNotifications(false);
    setShowHelp(false);
  }, []);

  // Check if a path is active
  const isPathActive = useCallback((path: string) => {
    return location.pathname === path || 
           location.pathname.startsWith(path + '/') ||
           hoveredPath === path;
  }, [location.pathname, hoveredPath]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      // Additional cleanup if needed
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [signOut]);

  // Toggle functions
  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
    setShowHelp(false);
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
    setShowNotifications(false);
  }, []);

  return {
    // State
    navigationItems,
    activeDropdown,
    showNotifications,
    showHelp,
    isSignedIn,
    currentPath: location.pathname,
    
    // Actions
    handleMouseEnterDropdown,
    handleMouseLeaveDropdown,
    closeAllDropdowns,
    isPathActive,
    handleSignOut,
    toggleNotifications,
    toggleHelp,
    setHoveredPath
  };
}