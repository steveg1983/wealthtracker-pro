import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CreditCardIcon, TargetIcon, GoalIcon, WalletIcon, XIcon } from './icons';

interface ActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  color: string;
}

export default function FloatingActionButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const actions: ActionItem[] = [
    {
      id: 'add-transaction',
      label: 'Add Transaction',
      icon: CreditCardIcon,
      action: () => {
        navigate('/transactions?action=add');
        setIsExpanded(false);
      },
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'add-account',
      label: 'Add Account',
      icon: WalletIcon,
      action: () => {
        navigate('/accounts?action=add');
        setIsExpanded(false);
      },
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      id: 'add-budget',
      label: 'Add Budget',
      icon: TargetIcon,
      action: () => {
        navigate('/budget?action=add');
        setIsExpanded(false);
      },
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'add-goal',
      label: 'Add Goal',
      icon: GoalIcon,
      action: () => {
        navigate('/goals?action=add');
        setIsExpanded(false);
      },
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="fixed bottom-20 right-6 z-30">
      {/* Action Items */}
      <div className={`space-y-3 mb-4 transition-all duration-300 ${
        isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              className={`flex items-center transform transition-all duration-300 delay-${index * 50}`}
              style={{ 
                transform: isExpanded 
                  ? 'translateY(0) scale(1)' 
                  : 'translateY(20px) scale(0.8)',
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 mr-3 shadow-lg border border-gray-200 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {action.label}
                </span>
              </div>
              <button
                onClick={action.action}
                className={`w-12 h-12 rounded-full ${action.color} text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2`}
                aria-label={action.label}
              >
                <Icon size={20} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main FAB */}
      <button
        onClick={toggleExpanded}
        className={`w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 ${
          isExpanded
            ? 'bg-red-500 hover:bg-red-600 rotate-45'
            : 'bg-[var(--color-primary)] hover:bg-[var(--color-secondary)]'
        } text-white`}
        aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <XIcon size={24} className="transform rotate-45" />
        ) : (
          <PlusIcon size={24} />
        )}
      </button>

      {/* Overlay for mobile */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-[-1] md:hidden"
          onClick={toggleExpanded}
        />
      )}
    </div>
  );
}