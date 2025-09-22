import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface LoanType {
  type: string;
  minDown: number;
  rate: number;
  pmi: boolean;
  pros: string[];
  cons: string[];
  requirements: string[];
}

interface LoanTypesComparisonProps {
  loanAmount: number;
  homePrice: number;
  loanTypes: LoanType[];
  formatCurrency: (value: number) => string;
}

export const LoanTypesComparison: React.FC<LoanTypesComparisonProps> = ({
  loanAmount,
  homePrice,
  loanTypes,
  formatCurrency
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Loan Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Min Down
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Typical Rate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              PMI Required
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Best For
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {loanTypes.map((type) => (
            <tr key={type.type} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {type.type}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {type.minDown}%
                <div className="text-xs text-gray-500">
                  ({formatCurrency(homePrice * type.minDown / 100)})
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {(type.rate * 100).toFixed(2)}%
              </td>
              <td className="px-4 py-3 text-sm">
                {type.pmi ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    No
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="space-y-1">
                  {type.pros.slice(0, 2).map((pro, i) => (
                    <div key={i} className="text-green-600 dark:text-green-400 text-xs">
                      + {pro}
                    </div>
                  ))}
                  {type.cons.slice(0, 1).map((con, i) => (
                    <div key={i} className="text-red-600 dark:text-red-400 text-xs">
                      - {con}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* US Loan Types Detailed Information */}
      <div className="mt-4 space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            US Loan Types Detailed Comparison
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loanTypes.map((type) => (
              <div key={type.type} className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {type.type}
                </h6>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Requirements:</p>
                    <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-0.5">
                      {type.requirements.map((req, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-gray-400 mr-1">•</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Min down: <span className="font-medium">{type.minDown}%</span>
                      {type.pmi && <span className="ml-2 text-orange-600 dark:text-orange-400">PMI required</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PMI Information */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Understanding PMI (Private Mortgage Insurance)
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <p className="mb-2">
                <strong>When is PMI required?</strong>
              </p>
              <ul className="space-y-1">
                <li>• Conventional loans with less than 20% down</li>
                <li>• FHA loans (called MIP) for the life of the loan</li>
                <li>• USDA loans (as a guarantee fee)</li>
              </ul>
            </div>
            <div>
              <p className="mb-2">
                <strong>How to remove PMI:</strong>
              </p>
              <ul className="space-y-1">
                <li>• Reach 20% equity (automatic at 22%)</li>
                <li>• Refinance to a new loan</li>
                <li>• Request removal with home appreciation</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              PMI typically costs 0.5% to 1% of the loan amount annually ({formatCurrency(loanAmount * 0.005 / 12)} to {formatCurrency(loanAmount * 0.01 / 12)}/month)
            </p>
          </div>
        </div>

        {/* Loan Limits */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            2025 Loan Limits
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Conventional</p>
              <p className="font-semibold text-gray-900 dark:text-white">$766,550</p>
              <p className="text-gray-500">Most areas</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">FHA</p>
              <p className="font-semibold text-gray-900 dark:text-white">$498,257</p>
              <p className="text-gray-500">Low-cost areas</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">VA</p>
              <p className="font-semibold text-gray-900 dark:text-white">No limit*</p>
              <p className="text-gray-500">*With full entitlement</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Jumbo</p>
              <p className="font-semibold text-gray-900 dark:text-white">&gt;$766,550</p>
              <p className="text-gray-500">Above conforming</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanTypesComparison;