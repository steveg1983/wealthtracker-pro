import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  category: string;
  sequence?: boolean; // For two-key shortcuts like 'g h'
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement || 
          event.target instanceof HTMLSelectElement) {
        return;
      }

      // Don't trigger shortcuts when modal or dialog is open
      if (document.querySelector('[role="dialog"]') || 
          document.querySelector('.modal-open')) {
        return;
      }

      const matchingShortcut = shortcuts.find(shortcut => {
        const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatches = Boolean(shortcut.ctrlKey) === event.ctrlKey;
        const altMatches = Boolean(shortcut.altKey) === event.altKey;
        const shiftMatches = Boolean(shortcut.shiftKey) === event.shiftKey;
        const metaMatches = Boolean(shortcut.metaKey) === event.metaKey;

        return keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches;
      });

      if (matchingShortcut) {
        event.preventDefault();
        event.stopPropagation();
        matchingShortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

interface UseGlobalKeyboardShortcutsReturn {
  shortcuts: KeyboardShortcut[];
  activeSequence: string | null;
}

export function useGlobalKeyboardShortcuts(onHelpOpen?: () => void): UseGlobalKeyboardShortcutsReturn {
  const navigate = useNavigate();
  const sequenceRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);

  // Handle two-key sequences
  const handleSequence = useCallback((firstKey: string, secondKey: string) => {
    if (firstKey === 'g') {
      // Go to shortcuts
      switch (secondKey) {
        case 'h': navigate('/'); break;
        case 'd': navigate('/dashboard'); break;
        case 'a': navigate('/accounts'); break;
        case 't': navigate('/transactions'); break;
        case 'i': navigate('/investments'); break;
        case 'b': navigate('/budget'); break;
        case 'g': navigate('/goals'); break;
        case 'r': navigate('/analytics'); break;
        case 's': navigate('/settings'); break;
      }
    } else if (firstKey === 'n') {
      // New shortcuts
      switch (secondKey) {
        case 't': navigate('/transactions?action=add'); break;
        case 'a': navigate('/accounts?action=add'); break;
        case 'g': navigate('/goals?action=add'); break;
        case 'b': navigate('/budget?action=add'); break;
      }
    }
  }, [navigate]);

  const shortcuts: KeyboardShortcut[] = [
    // Two-key navigation shortcuts
    {
      key: 'g',
      description: 'Go to... (press another key)',
      action: () => {
        sequenceRef.current = 'g';
        setActiveSequence('g');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          sequenceRef.current = null;
          setActiveSequence(null);
        }, 2000);
      },
      category: 'Navigation',
      sequence: true,
    },
    {
      key: 'n',
      description: 'New... (press another key)',
      action: () => {
        sequenceRef.current = 'n';
        setActiveSequence('n');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          sequenceRef.current = null;
          setActiveSequence(null);
        }, 2000);
      },
      category: 'Quick Actions',
      sequence: true,
    },
    // Single key shortcuts (keeping existing Alt shortcuts for compatibility)
    {
      key: 'h',
      altKey: true,
      description: 'Go to Home',
      action: () => navigate('/'),
      category: 'Navigation',
    },
    {
      key: 'd',
      altKey: true,
      description: 'Go to Dashboard',
      action: () => navigate('/dashboard'),
      category: 'Navigation',
    },
    {
      key: 'a',
      altKey: true,
      description: 'Go to Accounts',
      action: () => navigate('/accounts'),
      category: 'Navigation',
    },
    {
      key: 't',
      altKey: true,
      description: 'Go to Transactions',
      action: () => navigate('/transactions'),
      category: 'Navigation',
    },
    {
      key: 'b',
      altKey: true,
      description: 'Go to Budget',
      action: () => navigate('/budget'),
      category: 'Navigation',
    },
    {
      key: 'g',
      altKey: true,
      description: 'Go to Goals',
      action: () => navigate('/goals'),
      category: 'Navigation',
    },
    {
      key: 'i',
      altKey: true,
      description: 'Go to Investments',
      action: () => navigate('/investments'),
      category: 'Navigation',
    },
    {
      key: 'r',
      altKey: true,
      description: 'Go to Analytics',
      action: () => navigate('/analytics'),
      category: 'Navigation',
    },
    {
      key: 'comma',
      altKey: true,
      description: 'Go to Settings',
      action: () => navigate('/settings'),
      category: 'Navigation',
    },

    // Quick actions
    {
      key: 'n',
      ctrlKey: true,
      shiftKey: true,
      description: 'New Transaction',
      action: () => navigate('/transactions?action=add'),
      category: 'Quick Actions',
    },
    {
      key: 'n',
      ctrlKey: true,
      altKey: true,
      description: 'New Account',
      action: () => navigate('/accounts?action=add'),
      category: 'Quick Actions',
    },

    // Utility shortcuts
    {
      key: 'r',
      ctrlKey: true,
      description: 'Refresh Data',
      action: () => window.location.reload(),
      category: 'Utility',
    },
    {
      key: 'p',
      ctrlKey: true,
      description: 'Print Current Page',
      action: () => window.print(),
      category: 'Utility',
    },
  ];

  // Custom handler for sequences
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement || 
          event.target instanceof HTMLSelectElement) {
        return;
      }

      // Handle sequence continuation
      if (sequenceRef.current) {
        event.preventDefault();
        handleSequence(sequenceRef.current, event.key);
        sequenceRef.current = null;
        setActiveSequence(null);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Handle '/' for search focus
      if (event.key === '/' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
      
      // Handle '?' for help
      if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        if (onHelpOpen) {
          onHelpOpen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleSequence, onHelpOpen]);

  useKeyboardShortcuts(shortcuts);

  return { shortcuts, activeSequence };
}

// Export all available shortcuts for help dialog
export function getAllShortcuts(): KeyboardShortcut[] {
  return [
    // Navigation (g + key)
    { key: 'g h', description: 'Go to Home', category: 'Navigation', action: () => {} },
    { key: 'g d', description: 'Go to Dashboard', category: 'Navigation', action: () => {} },
    { key: 'g a', description: 'Go to Accounts', category: 'Navigation', action: () => {} },
    { key: 'g t', description: 'Go to Transactions', category: 'Navigation', action: () => {} },
    { key: 'g i', description: 'Go to Investments', category: 'Navigation', action: () => {} },
    { key: 'g b', description: 'Go to Budget', category: 'Navigation', action: () => {} },
    { key: 'g g', description: 'Go to Goals', category: 'Navigation', action: () => {} },
    { key: 'g r', description: 'Go to Analytics', category: 'Navigation', action: () => {} },
    { key: 'g s', description: 'Go to Settings', category: 'Navigation', action: () => {} },
    
    // Quick Actions (n + key)
    { key: 'n t', description: 'New Transaction', category: 'Quick Actions', action: () => {} },
    { key: 'n a', description: 'New Account', category: 'Quick Actions', action: () => {} },
    { key: 'n g', description: 'New Goal', category: 'Quick Actions', action: () => {} },
    { key: 'n b', description: 'New Budget', category: 'Quick Actions', action: () => {} },
    
    // Global shortcuts
    { key: 'Ctrl+K', description: 'Open global search', category: 'Global', action: () => {}, ctrlKey: true },
    { key: '/', description: 'Focus search input', category: 'Global', action: () => {} },
    { key: '?', description: 'Show keyboard shortcuts', category: 'Global', action: () => {} },
    { key: 'Escape', description: 'Close modal/dialog', category: 'Global', action: () => {} },
    
    // Utility
    { key: 'Ctrl+R', description: 'Refresh data', category: 'Utility', action: () => {}, ctrlKey: true },
    { key: 'Ctrl+P', description: 'Print', category: 'Utility', action: () => {}, ctrlKey: true },
  ];
}