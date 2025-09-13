import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { 
  CheckCircleIcon,
  EditIcon,
  DeleteIcon,
  DollarSignIcon,
  InfoIcon
} from '../icons';
import type { Bill } from './types';
import type { Account, Category } from '../../types';
import { billUtils } from './billUtils';
import { logger } from '../../services/loggingService';

interface BillCardProps {
  bill: Bill;
  accounts: Account[];
  categories: Category[];
  onPay: (billId: string) => void;
  onEdit: (bill: Bill) => void;
  onToggleActive: (billId: string) => void;
  onDelete: (billId: string) => void;
  onViewDetails: (billId: string) => void;
}

export const BillCard = memo(function BillCard({
  bill,
  accounts,
  categories,
  onPay,
  onEdit,
  onToggleActive,
  onDelete,
  onViewDetails
}: BillCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BillCard component initialized', {
      componentName: 'BillCard'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  const account = accounts.find(a => a.id === bill.accountId);
  const category = categories.find(c => c.id === bill.category);
  const statusColor = billUtils.getStatusColor(bill);
  const statusText = billUtils.getStatusText(bill);
  const daysUntilDue = billUtils.getDaysUntilDue(bill.nextDueDate);
  
  return (
    <div
      className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 hover:shadow-xl transition-all ${
        daysUntilDue < 0 ? 'border-red-200 dark:border-red-800' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {bill.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <DollarSignIcon size={16} />
            <span className="font-medium">{formatCurrency(bill.amount)}</span>
            {bill.isAutoPay && (
              <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                Auto-pay
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(bill)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Edit bill"
          >
            <EditIcon size={16} />
          </button>
          <button
            onClick={() => onToggleActive(bill.id)}
            className={`p-2 ${bill.isActive ? 'text-green-600' : 'text-gray-400'} hover:text-green-700`}
            title={bill.isActive ? 'Active' : 'Inactive'}
          >
            <CheckCircleIcon size={16} />
          </button>
          <button
            onClick={() => onDelete(bill.id)}
            className="p-2 text-gray-400 hover:text-red-500"
            title="Delete bill"
          >
            <DeleteIcon size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {new Date(bill.nextDueDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Status:</span>
          <span className={`font-medium ${statusColor}`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Account:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {account?.name || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
          <span className="font-medium text-gray-900 dark:text-white capitalize">
            {bill.frequency.replace('-', ' ')}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onPay(bill.id)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <CheckCircleIcon size={16} />
          Pay Now
        </button>
        <button
          onClick={() => onViewDetails(bill.id)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <InfoIcon size={16} />
          Details
        </button>
      </div>
    </div>
  );
});