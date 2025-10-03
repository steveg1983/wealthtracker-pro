import React, { useEffect } from 'react';
import { HomeIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface HelpToBuyResultsProps {
  propertyPrice: number;
  deposit: number;
  equityLoan: number;
  mortgage: number;
  monthlyMortgagePayment: number;
  year6Interest: number;
  totalCost: number;
  formatCurrency: (value: number) => string;
}

export const HelpToBuyResults: React.FC<HelpToBuyResultsProps> = ({
  propertyPrice,
  deposit,
  equityLoan,
  mortgage,
  monthlyMortgagePayment,
  year6Interest,
  totalCost,
  formatCurrency
}) => {
  const equityLoanPercentage = Math.round((equityLoan / propertyPrice) * 100);
  
  return (
    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <HomeIcon size={16} className="text-green-500" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Help to Buy Equity Loan</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Your Deposit:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(deposit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Government Equity Loan:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {formatCurrency(equityLoan)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Your Mortgage:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(mortgage)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Equity Loan %:</span>
              <span className="text-gray-900 dark:text-white">
                {equityLoanPercentage}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest from Year 6:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(year6Interest)}/month
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest-free period:</span>
              <span className="text-gray-900 dark:text-white">5 years</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Monthly Payments Timeline
        </h5>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Years 1-5 (mortgage only):</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(monthlyMortgagePayment)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Year 6+ (mortgage + equity loan):</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(monthlyMortgagePayment + year6Interest)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          After 5 years, you'll pay 1.75% interest on the equity loan, increasing annually by RPI + 1%
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          The equity loan must be repaid when you sell the property or remortgage
        </p>
      </div>
    </div>
  );
};

export default HelpToBuyResults;