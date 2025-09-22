import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  CreditCardIcon, 
  WalletIcon, 
  TargetIcon, 
  TrendingUpIcon 
} from '../../icons';

interface QuickActionsProps {
  onAddTransaction: () => void;
  onViewAccounts: () => void;
  onSetBudget: () => void;
  onViewAnalytics: () => void;
}

/**
 * Quick actions component
 */
export const QuickActions = memo(function QuickActions({ onAddTransaction,
  onViewAccounts,
  onSetBudget,
  onViewAnalytics
 }: QuickActionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('QuickActions component initialized', {
      componentName: 'QuickActions'
    });
  }, []);

  const actions = [
    {
      id: 'transaction',
      label: 'Add Transaction',
      icon: CreditCardIcon,
      color: 'text-gray-600',
      onClick: onAddTransaction
    },
    {
      id: 'accounts',
      label: 'View Accounts',
      icon: WalletIcon,
      color: 'text-green-600',
      onClick: onViewAccounts
    },
    {
      id: 'budget',
      label: 'Set Budget',
      icon: TargetIcon,
      color: 'text-purple-600',
      onClick: onSetBudget
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUpIcon,
      color: 'text-orange-600',
      onClick: onViewAnalytics
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
          >
            <Icon size={24} className={`mx-auto mb-2 ${action.color}`} />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});