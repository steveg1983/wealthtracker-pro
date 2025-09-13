import { memo, useState, useEffect } from 'react';
import { CalculatorIcon, ChevronUpIcon, ChevronDownIcon, InfoIcon } from '../../icons';
import type { DrawdownScenario } from '../../../services/sippCalculatorService';
import { logger } from '../../../services/loggingService';

interface SIPPDrawdownScenariosProps {
  drawdownScenarios: DrawdownScenario[] | null;
  remainingForDrawdown: number;
  formatCurrency: (amount: number) => string;
}

/**
 * SIPP drawdown scenarios component
 */
export const SIPPDrawdownScenarios = memo(function SIPPDrawdownScenarios({
  drawdownScenarios,
  remainingForDrawdown,
  formatCurrency
}: SIPPDrawdownScenariosProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SIPPDrawdownScenarios component initialized', {
      componentName: 'SIPPDrawdownScenarios'
    });
  }, []);

  const [showDrawdown, setShowDrawdown] = useState(false);

  if (!drawdownScenarios) return <></>;

  return (
    <div>
      <button
        onClick={() => setShowDrawdown(!showDrawdown)}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-3"
      >
        <CalculatorIcon size={14} />
        {showDrawdown ? 'Hide' : 'Show'} Drawdown Scenarios
        {showDrawdown ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
      </button>

      {showDrawdown && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Pension Drawdown Options (After 25% Tax-Free Lump Sum)
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Remaining for drawdown: {formatCurrency(remainingForDrawdown)}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drawdownScenarios.map((scenario) => (
              <div
                key={scenario.rate}
                className={`p-3 rounded-lg border ${
                  scenario.rate === 4
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {scenario.rate}% Withdrawal Rate
                  </span>
                  {scenario.rate === 4 && (
                    <span className="text-xs text-green-600 dark:text-green-400">Recommended</span>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Annual Income:</span>
                    <span className="font-medium">{formatCurrency(scenario.annualDrawdown)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Monthly Income:</span>
                    <span className="font-medium">{formatCurrency(scenario.monthlyIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Lasts Until:</span>
                    <span className="font-medium">
                      Age {scenario.sustainableToAge > 100 ? '100+' : scenario.sustainableToAge}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DrawdownTaxInfo />
        </div>
      )}
    </div>
  );
});

/**
 * Drawdown tax information component
 */
const DrawdownTaxInfo = memo(function DrawdownTaxInfo() {
  return (
    <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <div className="flex gap-2">
        <InfoIcon size={14} className="text-gray-600 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-900 dark:text-blue-100">
          <p className="font-medium mb-1">Drawdown Tax Implications:</p>
          <ul className="space-y-0.5">
            <li>• 25% can be taken tax-free as a lump sum</li>
            <li>• Remaining 75% is taxed as income when withdrawn</li>
            <li>• Consider your tax band when planning withdrawals</li>
            <li>• Unused funds can be passed on inheritance tax-free</li>
          </ul>
        </div>
      </div>
    </div>
  );
});