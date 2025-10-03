import React, { useState, useEffect } from 'react';
import { XMarkIcon, LightBulbIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface Tip {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface PageTipsConfig {
  [key: string]: Tip[];
}

const pageTips: PageTipsConfig = {
  '/dashboard': [
    {
      id: 'dashboard-welcome',
      title: 'Welcome to your Dashboard',
      content: 'This is your financial command center. You can see all your accounts, recent transactions, and key metrics at a glance.',
      position: 'bottom'
    },
    {
      id: 'dashboard-widgets',
      title: 'Customizable Widgets',
      content: 'Each widget can be customized or rearranged. Click the settings icon on any widget to configure it.',
      target: '.widget-container',
      position: 'right'
    },
    {
      id: 'dashboard-quickadd',
      title: 'Quick Add Transactions',
      content: 'Use the + button to quickly add new transactions without leaving the dashboard.',
      target: '.quick-add-button',
      position: 'left'
    }
  ],
  '/accounts': [
    {
      id: 'accounts-overview',
      title: 'Account Management',
      content: 'View all your accounts in one place. Click on any account to see detailed transactions.',
      position: 'bottom'
    },
    {
      id: 'accounts-add',
      title: 'Add New Accounts',
      content: 'Click "Add Account" to connect bank accounts or create manual accounts.',
      target: '.add-account-button',
      position: 'left'
    }
  ],
  '/transactions': [
    {
      id: 'transactions-filter',
      title: 'Filter & Search',
      content: 'Use the search bar and filters to find specific transactions quickly.',
      target: '.search-bar',
      position: 'bottom'
    },
    {
      id: 'transactions-bulk',
      title: 'Bulk Actions',
      content: 'Select multiple transactions to categorize, delete, or export them in bulk.',
      target: '.bulk-select',
      position: 'right'
    },
    {
      id: 'transactions-categorize',
      title: 'Smart Categorization',
      content: 'WealthTracker learns from your categorization patterns to auto-categorize future transactions.',
      position: 'top'
    }
  ],
  '/budget': [
    {
      id: 'budget-setup',
      title: 'Budget Setup',
      content: 'Create budgets for different categories and track your spending against them.',
      position: 'bottom'
    },
    {
      id: 'budget-alerts',
      title: 'Budget Alerts',
      content: 'Set up alerts when you\'re approaching or exceeding your budget limits.',
      target: '.budget-alerts',
      position: 'right'
    }
  ]
};

interface PageTipsProps {
  page: string;
  onClose: () => void;
}

export default function PageTips({ page, onClose }: PageTipsProps): React.JSX.Element {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const tips = pageTips[page] || [];
  const currentTip = tips[currentTipIndex];

  useEffect(() => {
    if (currentTip?.target) {
      const element = document.querySelector(currentTip.target) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.classList.add('tip-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('tip-highlight');
      }
    };
  }, [currentTip, highlightedElement]);

  const handleNext = () => {
    if (currentTipIndex < tips.length - 1) {
      setCurrentTipIndex(currentTipIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentTipIndex > 0) {
      setCurrentTipIndex(currentTipIndex - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (tips.length === 0 || !currentTip) {
    return <></>;
  }

  const getPositionStyles = () => {
    if (!highlightedElement || !currentTip.target) {
      // Center the tip if no target element
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const rect = highlightedElement.getBoundingClientRect();
    const position = currentTip.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - rect.top + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          right: `${window.innerWidth - rect.left + 10}px`,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 10}px`,
          transform: 'translateY(-50%)'
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleSkip}>
        {highlightedElement && (
          <div
            className="absolute bg-transparent border-4 border-blue-500 rounded-lg pointer-events-none"
            style={{
              top: highlightedElement.getBoundingClientRect().top - 4,
              left: highlightedElement.getBoundingClientRect().left - 4,
              width: highlightedElement.getBoundingClientRect().width + 8,
              height: highlightedElement.getBoundingClientRect().height + 8
            }}
          />
        )}
      </div>

      {/* Tip Card */}
      <div
        className="fixed z-50 bg-amber-50 dark:bg-amber-900/20 rounded-lg shadow-2xl p-6 max-w-md border-l-4 border-amber-400 dark:border-amber-600"
        style={getPositionStyles()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <LightBulbIcon className="w-6 h-6 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentTip.title}
            </h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-700 dark:text-gray-200 mb-6">
          {currentTip.content}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {tips.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentTipIndex
                    ? 'bg-blue-600'
                    : index < currentTipIndex
                    ? 'bg-blue-300'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="flex space-x-2">
            {currentTipIndex > 0 && (
              <button
                onClick={handlePrevious}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleSkip}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Skip all
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center space-x-1"
            >
              <span>{currentTipIndex < tips.length - 1 ? 'Next' : 'Done'}</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Add CSS for highlight animation
const style = document.createElement('style');
style.textContent = `
  .tip-highlight {
    position: relative;
    z-index: 41;
    animation: pulse-highlight 2s infinite;
  }

  @keyframes pulse-highlight {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }
`;
document.head.appendChild(style);