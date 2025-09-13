import React, { useEffect } from 'react';
import { HomeIcon, TrendingUpIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface StaircasingOption {
  percentage: number;
  year: number;
  additionalCost: number;
  newMonthlyPayment: number;
  stampDuty: number;
}

interface SharedOwnershipResultsProps {
  propertyPrice: number;
  sharePercentage: number;
  monthlyRent: number;
  monthlyMortgage: number;
  totalMonthlyPayment: number;
  staircasingOptions: StaircasingOption[];
  formatCurrency: (value: number) => string;
}

export const SharedOwnershipResults: React.FC<SharedOwnershipResultsProps> = ({
  propertyPrice,
  sharePercentage,
  monthlyRent,
  monthlyMortgage,
  totalMonthlyPayment,
  staircasingOptions,
  formatCurrency
}) => {
  const shareValue = propertyPrice * sharePercentage;
  const remainingShare = (1 - sharePercentage) * 100;
  
  return (
    <div className="mt-6 space-y-4">
      {/* Main Shared Ownership Details */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <HomeIcon size={16} className="text-purple-500" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Shared Ownership Details</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Your Share:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {(sharePercentage * 100).toFixed(0)}% ({formatCurrency(shareValue)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Housing Association Share:</span>
                <span className="text-gray-900 dark:text-white">
                  {remainingShare.toFixed(0)}% ({formatCurrency(propertyPrice - shareValue)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Property Value:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(propertyPrice)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monthly Mortgage:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(monthlyMortgage)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monthly Rent:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(monthlyRent)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Total Monthly:</span>
                <span className="text-purple-600 dark:text-purple-400">
                  {formatCurrency(totalMonthlyPayment)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs text-gray-600 dark:text-gray-400">
          <p>Rent is typically 2.75% per year of the housing association's share</p>
          <p className="mt-1">Service charges and ground rent may apply in addition</p>
        </div>
      </div>

      {/* Staircasing Options */}
      {staircasingOptions && staircasingOptions.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUpIcon size={16} className="text-blue-500" />
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Staircasing Options</h4>
          </div>
          
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Buy additional shares over time to increase your ownership
          </p>
          
          <div className="space-y-3">
            {staircasingOptions.map((option, index) => (
              <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Buy additional {option.percentage}% in Year {option.year}
                  </span>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {formatCurrency(option.additionalCost)}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">New Ownership:</span>
                    <span className="ml-1 text-gray-900 dark:text-white font-medium">
                      {(sharePercentage * 100 + option.percentage).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">New Monthly:</span>
                    <span className="ml-1 text-gray-900 dark:text-white font-medium">
                      {formatCurrency(option.newMonthlyPayment)}
                    </span>
                  </div>
                  {option.stampDuty > 0 && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Stamp Duty:</span>
                      <span className="ml-1 text-gray-900 dark:text-white font-medium">
                        {formatCurrency(option.stampDuty)}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mt-2 text-xs">
                  {option.newMonthlyPayment < totalMonthlyPayment ? (
                    <span className="text-green-600 dark:text-green-400">
                      Saves {formatCurrency(totalMonthlyPayment - option.newMonthlyPayment)}/month
                    </span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400">
                      Increases by {formatCurrency(option.newMonthlyPayment - totalMonthlyPayment)}/month
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Minimum purchase is usually 10% additional share</li>
              <li>Property will be revalued before each staircasing</li>
              <li>Legal and valuation fees will apply (typically £1,500-£2,500)</li>
              <li>Once you own 100%, no more rent is payable</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedOwnershipResults;