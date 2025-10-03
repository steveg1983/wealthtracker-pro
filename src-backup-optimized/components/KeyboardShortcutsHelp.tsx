/**
 * KeyboardShortcutsHelp Component - Shows keyboard shortcuts help modal
 *
 * Features:
 * - Display available keyboard shortcuts
 * - Keyboard shortcut to open/close (?)
 * - Categorized shortcuts display
 */

import React, { useState, useEffect } from 'react';
import { useKeyboardShortcutsHelp } from '../hooks/useKeyboardShortcutsHelp';

interface ShortcutCategory {
  name: string;
  shortcuts: Array<{
    key: string;
    description: string;
  }>;
}

const shortcuts: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { key: '⌘K', description: 'Open global search' },
      { key: 'G + D', description: 'Go to Dashboard' },
      { key: 'G + A', description: 'Go to Accounts' },
      { key: 'G + T', description: 'Go to Transactions' },
      { key: 'G + B', description: 'Go to Budgets' },
      { key: 'G + G', description: 'Go to Goals' },
      { key: 'G + S', description: 'Go to Settings' }
    ]
  },
  {
    name: 'Actions',
    shortcuts: [
      { key: 'N', description: 'Add new transaction' },
      { key: '⌘N', description: 'Add new account' },
      { key: 'E', description: 'Edit selected item' },
      { key: 'Delete', description: 'Delete selected item' },
      { key: '⌘S', description: 'Save current form' },
      { key: 'Escape', description: 'Close modal or cancel' }
    ]
  },
  {
    name: 'General',
    shortcuts: [
      { key: '?', description: 'Show this help' },
      { key: '⌘/', description: 'Show this help' },
      { key: 'F', description: 'Toggle fullscreen' },
      { key: '⌘⇧D', description: 'Toggle dark mode' }
    ]
  }
];

// Hook for keyboard shortcuts help dialog
export function useKeyboardShortcutsHelp() {
  return { isOpen: false, toggle: () => {} };
}

export default function KeyboardShortcutsHelp(): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const { isHelpVisible, toggleHelp } = useKeyboardShortcutsHelp();

  // Sync with hook state
  useEffect(() => {
    setIsVisible(isHelpVisible);
  }, [isHelpVisible]);

  const handleClose = () => {
    toggleHelp();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isVisible) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {shortcuts.map((category) => (
              <div key={category.name}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {category.name}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer tip */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">Pro tip:</span> Press{' '}
              <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded text-xs">
                ?
              </kbd>{' '}
              anytime to access this help menu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}