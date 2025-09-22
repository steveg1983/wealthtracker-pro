import { memo, useEffect } from 'react';
import { CreditCardIcon, WalletIcon, TargetIcon, TrendingUpIcon } from '../../icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { preserveDemoParam } from '../../../utils/navigation';
import { useLogger } from '../services/ServiceProvider';

interface QuickActionsGridProps {
  onAddTransaction: () => void;
}

/**
 * Quick actions grid component
 * Provides quick access buttons to common actions
 */
export const QuickActionsGrid = memo(function QuickActionsGrid({ onAddTransaction
 }: QuickActionsGridProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('QuickActionsGrid component initialized', {
      componentName: 'QuickActionsGrid'
    });
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button 
        onClick={onAddTransaction}
        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
      >
        <CreditCardIcon size={24} className="mx-auto mb-2 text-gray-600" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Add Transaction
        </span>
      </button>
      
      <button 
        onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
      >
        <WalletIcon size={24} className="mx-auto mb-2 text-green-600" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          View Accounts
        </span>
      </button>
      
      <button 
        onClick={() => navigate(preserveDemoParam('/budget', location.search))}
        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
      >
        <TargetIcon size={24} className="mx-auto mb-2 text-purple-600" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Set Budget
        </span>
      </button>
      
      <button 
        onClick={() => navigate(preserveDemoParam('/analytics', location.search))}
        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
      >
        <TrendingUpIcon size={24} className="mx-auto mb-2 text-orange-600" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Analytics
        </span>
      </button>
    </div>
  );
});