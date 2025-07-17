import { useEffect } from 'react';
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
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
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

export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
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

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}