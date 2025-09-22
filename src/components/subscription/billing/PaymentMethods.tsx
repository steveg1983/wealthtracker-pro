import { memo, useEffect } from 'react';
import { CreditCardIcon, EditIcon, TrashIcon } from '../../icons';
import { BillingDashboardService } from '../../../services/billingDashboardService';
import type { PaymentMethod } from '../../../types/subscription';
import { useLogger } from '../services/ServiceProvider';

interface PaymentMethodsProps {
  paymentMethods: PaymentMethod[];
}

export const PaymentMethods = memo(function PaymentMethods({ paymentMethods
 }: PaymentMethodsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PaymentMethods component initialized', {
      componentName: 'PaymentMethods'
    });
  }, []);

  if (paymentMethods.length === 0) return <></>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Payment Methods
      </h3>
      
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <PaymentMethodCard key={method.id} method={method} />
        ))}
      </div>
    </div>
  );
});

const PaymentMethodCard = memo(function PaymentMethodCard({ 
  method 
}: { 
  method: PaymentMethod 
}) {
  const logger = useLogger();
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center gap-3">
        <CreditCardIcon size={20} className="text-gray-600 dark:text-gray-400" />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {BillingDashboardService.formatCardDisplay(method)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {BillingDashboardService.formatCardExpiry(method)}
          </p>
        </div>
        {method.isDefault && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            Default
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <EditIcon size={16} />
        </button>
        <button className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
});