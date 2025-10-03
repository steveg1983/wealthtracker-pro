/**
 * Loan Type Information Component
 * Displays detailed information about loan types
 */

import React, { useEffect, memo } from 'react';
import { usMortgageFormService } from '../../../services/usMortgageFormService';
import { useLogger } from '../services/ServiceProvider';

interface LoanTypeInfoProps {
  loanType: string;
  downPaymentPercent: number;
}

export const LoanTypeInfo = memo(function LoanTypeInfo({ loanType, 
  downPaymentPercent 
 }: LoanTypeInfoProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('LoanTypeInfo component initialized', {
      componentName: 'LoanTypeInfo'
    });
  }, []);

  const info = usMortgageFormService.getLoanTypeInfo(loanType, downPaymentPercent);
  
  if (!info) return <></>;

  return (
    <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {loanType.toUpperCase()} Loan Information
      </h4>
      
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {info.description}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Benefits</h5>
          <ul className="space-y-1">
            {info.benefits.map((benefit, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
                <span className="text-green-500 mr-1">•</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements</h5>
          <ul className="space-y-1">
            {info.requirements.map((req, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
                <span className="text-yellow-500 mr-1">•</span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="pt-3 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          Minimum down payment: <span className="font-medium">{info.minDown}%</span>
        </span>
        {info.pmi && (
          <span className="text-orange-600 dark:text-orange-400">
            PMI/MIP Required
          </span>
        )}
      </div>
    </div>
  );
});