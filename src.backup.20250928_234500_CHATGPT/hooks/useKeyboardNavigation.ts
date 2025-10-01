import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  cmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'navigation' | 'actions' | 'search' | 'view';
  action: () => void;
  enabled?: boolean;
}

interface KeyboardNavigationOptions {
  enableVimMode?: boolean;
  enableGlobalShortcuts?: boolean;
  enableFocusIndicator?: boolean;
  customShortcuts?: KeyboardShortcut[];
}

/**
 * Advanced Keyboard Navigation Hook
 * Design principles:
 * 1. Global keyboard shortcuts for common actions
 * 2. Vim-style navigation for power users
 * 3. Focus management and tab order
 * 4. Visual keyboard hints
 * 5. Customizable shortcuts
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enableVimMode = false,
    enableGlobalShortcuts = true,
    enableFocusIndicator = true,
    customShortcuts = []
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const { 
    transactions, 
    accounts,
    categories
    // showToast not available in current AppContext
  } = useApp();
  
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Define default shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: 'd',
      description: 'Go to Dashboard',
      category: 'navigation',
      action: () => navigate('/dashboard')
    },
    {
      key: 't',
      description: 'Go to Transactions',
      category: 'navigation',
      action: () => navigate('/transactions')
    },
    {
      key: 'a',
      description: 'Go to Accounts',
      category: 'navigation',
      action: () => navigate('/accounts')
    },
    {
      key: 'b',
      description: 'Go to Budgets',
      category: 'navigation',
      action: () => navigate('/budgets')
    },
    {
      key: 'i',
      description: 'Go to Investments',
      category: 'navigation',
      action: () => navigate('/investments')
    },
    {
      key: 'g',
      description: 'Go to Goals',
      category: 'navigation',
      action: () => navigate('/goals')
    },
    
    // Action shortcuts
    {
      key: 'n',
      ctrl: true,
      cmd: true,
      description: 'New Transaction (Quick Entry)',
      category: 'actions',
      action: () => {
        // Trigger FAB click
        const fab = document.querySelector('[data-fab="true"]') as HTMLElement;
        if (fab) fab.click();
      }
    },
    {
      key: 'e',
      ctrl: true,
      cmd: true,
      description: 'Export Data',
      category: 'actions',
      action: () => {
        const exportBtn = document.querySelector('[data-action="export"]') as HTMLElement;
        if (exportBtn) exportBtn.click();
      }
    },
    {
      key: 'i',
      ctrl: true,
      cmd: true,
      description: 'Import Data',
      category: 'actions',
      action: () => {
        const importBtn = document.querySelector('[data-action="import"]') as HTMLElement;
        if (importBtn) importBtn.click();
      }
    },
    {
      key: 's',
      ctrl: true,
      cmd: true,
      description: 'Save/Sync',
      category: 'actions',
      action: () => {
        window.dispatchEvent(new CustomEvent('app-sync-request'));
      }
    },
    
    // Search shortcuts
    {
      key: '/',
      description: 'Focus Search',
      category: 'search',
      action: () => {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          setIsSearchFocused(true);
        }
      }
    },
    {
      key: 'Escape',
      description: 'Clear Search / Close Modal',
      category: 'search',
      action: () => {
        // Check for open modals first
        const modal = document.querySelector('[role="dialog"]') as HTMLElement;
        if (modal) {
          const closeBtn = modal.querySelector('[aria-label="Close"]') as HTMLElement;
          if (closeBtn) closeBtn.click();
        } else if (isSearchFocused) {
          // Clear search
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
            setIsSearchFocused(false);
          }
        }
      }
    },
    
    // View shortcuts
    {
      key: '?',
      shift: true,
      description: 'Show Keyboard Shortcuts',
      category: 'view',
      action: () => setShowShortcutHelp(prev => !prev)
    },
    {
      key: 'h',
      alt: true,
      description: 'Toggle Sidebar',
      category: 'view',
      action: () => {
        const sidebar = document.querySelector('[data-sidebar="true"]') as HTMLElement;
        if (sidebar) {
          sidebar.classList.toggle('hidden');
        }
      }
    },
    {
      key: 'f',
      alt: true,
      description: 'Toggle Filters',
      category: 'view',
      action: () => {
        const filters = document.querySelector('[data-filters="true"]') as HTMLElement;
        if (filters) {
          filters.classList.toggle('hidden');
        }
      }
    }
  ];

  // Vim mode navigation
  const vimShortcuts: KeyboardShortcut[] = enableVimMode ? [
    {
      key: 'j',
      description: 'Move down',
      category: 'navigation',
      action: () => {
        setSelectedIndex(prev => Math.min(prev + 1, transactions.length - 1));
        scrollToSelected();
      }
    },
    {
      key: 'k',
      description: 'Move up',
      category: 'navigation',
      action: () => {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        scrollToSelected();
      }
    },
    {
      key: 'g',
      description: 'Go to top',
      category: 'navigation',
      action: () => {
        if (commandBuffer === 'g') {
          setSelectedIndex(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setCommandBuffer('');
        } else {
          setCommandBuffer('g');
          setTimeout(() => setCommandBuffer(''), 1000);
        }
      }
    },
    {
      key: 'G',
      shift: true,
      description: 'Go to bottom',
      category: 'navigation',
      action: () => {
        setSelectedIndex(transactions.length - 1);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    },
    {
      key: 'Enter',
      description: 'Open selected item',
      category: 'actions',
      action: () => {
        const selected = document.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
        if (selected) selected.click();
      }
    },
    {
      key: 'x',
      description: 'Select/deselect item',
      category: 'actions',
      action: () => {
        const checkbox = document.querySelector(`[data-index="${selectedIndex}"] input[type="checkbox"]`) as HTMLInputElement;
        if (checkbox) checkbox.click();
      }
    },
    {
      key: 'dd',
      description: 'Delete selected',
      category: 'actions',
      action: () => {
        if (commandBuffer === 'd') {
          const deleteBtn = document.querySelector(`[data-index="${selectedIndex}"] [data-action="delete"]`) as HTMLElement;
          if (deleteBtn) deleteBtn.click();
          setCommandBuffer('');
        } else {
          setCommandBuffer('d');
          setTimeout(() => setCommandBuffer(''), 1000);
        }
      }
    }
  ] : [];

  // Combine all shortcuts
  const allShortcuts = [...defaultShortcuts, ...vimShortcuts, ...customShortcuts];

  // Scroll to selected item
  const scrollToSelected = useCallback(() => {
    const selected = document.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selected.focus();
    }
  }, [selectedIndex]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true') {
      if (e.key === 'Escape') {
        target.blur();
        e.preventDefault();
      }
      return;
    }

    // Check for matching shortcuts
    const matchingShortcut = allShortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !shortcut.cmd || true;
      const cmdMatch = shortcut.cmd ? (e.metaKey || e.ctrlKey) : !shortcut.ctrl || true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      
      return keyMatch && ctrlMatch && cmdMatch && shiftMatch && altMatch;
    });

    if (matchingShortcut && matchingShortcut.enabled !== false) {
      e.preventDefault();
      matchingShortcut.action();
    }

    // Tab navigation enhancement
    if (e.key === 'Tab') {
      // Store last focused element
      lastFocusedElement.current = document.activeElement as HTMLElement;
      
      // Add visual focus indicator
      if (enableFocusIndicator) {
        document.body.classList.add('keyboard-navigation');
      }
    }
  }, [allShortcuts, enableFocusIndicator]);

  // Handle mouse click (disable keyboard navigation indicators)
  const handleMouseClick = useCallback(() => {
    if (enableFocusIndicator) {
      document.body.classList.remove('keyboard-navigation');
    }
  }, [enableFocusIndicator]);

  // Setup event listeners
  useEffect(() => {
    if (enableGlobalShortcuts) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleMouseClick);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleMouseClick);
      };
    }
  }, [enableGlobalShortcuts, handleKeyDown, handleMouseClick]);

  // Focus management for route changes
  useEffect(() => {
    // Focus main content area on route change
    const mainContent = document.querySelector('main, [role="main"]') as HTMLElement;
    if (mainContent) {
      mainContent.tabIndex = -1;
      mainContent.focus();
      
      // Announce page change to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = `Navigated to ${location.pathname.slice(1) || 'dashboard'} page`;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, [location]);

  // Return helper functions and state
  return {
    shortcuts: allShortcuts,
    showShortcutHelp,
    setShowShortcutHelp,
    isCommandMode,
    selectedIndex,
    registerShortcut: (shortcut: KeyboardShortcut) => {
      customShortcuts.push(shortcut);
    },
    focusSearch: () => {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
    focusMain: () => {
      const mainContent = document.querySelector('main, [role="main"]') as HTMLElement;
      if (mainContent) mainContent.focus();
    },
    navigateByIndex: (direction: 'up' | 'down' | 'first' | 'last') => {
      switch (direction) {
        case 'up':
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'down':
          setSelectedIndex(prev => Math.min(prev + 1, transactions.length - 1));
          break;
        case 'first':
          setSelectedIndex(0);
          break;
        case 'last':
          setSelectedIndex(transactions.length - 1);
          break;
      }
      scrollToSelected();
    }
  };
}
