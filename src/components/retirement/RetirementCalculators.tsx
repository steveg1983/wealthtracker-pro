import React, { useEffect, memo, useState, useCallback } from 'react';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';
import StatePensionCalculator from './StatePensionCalculator';
import SocialSecurityOptimizer from './SocialSecurityOptimizer';
import Retirement401kCalculator from './Retirement401kCalculator';
import WorkplacePensionCalculator from './WorkplacePensionCalculator';
import IRAComparisonCalculator from './IRAComparisonCalculator';
import ISACalculator from './ISACalculator';
import MedicarePlanningCalculator from './MedicarePlanningCalculator';
import RMDCalculator from './RMDCalculator';
import NIYearsTracker from './NIYearsTracker';
import StateTaxCalculator from './StateTaxCalculator';
import SIPPCalculator from './SIPPCalculator';
import { logger } from '../../services/loggingService';

interface RetirementCalculatorsProps {
  onDataChange: () => void;
}

export const RetirementCalculators = memo(function RetirementCalculators({ 
  onDataChange 
}: RetirementCalculatorsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RetirementCalculators component initialized', {
      componentName: 'RetirementCalculators'
    });
  }, []);

  const { region } = useRegionalSettings();
  const [activeCalculator, setActiveCalculator] = useState<string>('overview');

  const handleCalculatorChange = useCallback((calculator: string) => {
    setActiveCalculator(calculator);
  }, []);

  // UK-specific calculators
  const ukCalculators = [
    { id: 'state-pension', label: 'State Pension', component: StatePensionCalculator },
    { id: 'workplace-pension', label: 'Workplace Pension', component: WorkplacePensionCalculator },
    { id: 'isa', label: 'ISA Calculator', component: ISACalculator },
    { id: 'ni-years', label: 'NI Years Tracker', component: NIYearsTracker },
    { id: 'sipp', label: 'SIPP Calculator', component: SIPPCalculator }
  ];

  // US-specific calculators
  const usCalculators = [
    { id: 'social-security', label: 'Social Security', component: SocialSecurityOptimizer },
    { id: '401k', label: '401(k) Calculator', component: Retirement401kCalculator },
    { id: 'ira', label: 'IRA Comparison', component: IRAComparisonCalculator },
    { id: 'medicare', label: 'Medicare Planning', component: MedicarePlanningCalculator },
    { id: 'rmd', label: 'RMD Calculator', component: RMDCalculator },
    { id: 'state-tax', label: 'State Tax Calculator', component: StateTaxCalculator }
  ];

  const availableCalculators = region === 'UK' ? ukCalculators : usCalculators;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Retirement Calculators ({region})
      </h2>

      {/* Calculator Tabs */}
      <div className="border-b dark:border-gray-700 mb-6">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Retirement calculators">
          <button
            onClick={() => handleCalculatorChange('overview')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCalculator === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          
          {availableCalculators.map((calc) => (
            <button
              key={calc.id}
              onClick={() => handleCalculatorChange(calc.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeCalculator === calc.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {calc.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Calculator Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        {activeCalculator === 'overview' ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Available Retirement Planning Tools
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a calculator from the tabs above to start planning your retirement. 
              Each tool is tailored to your region's specific retirement programs and regulations.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {availableCalculators.map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => handleCalculatorChange(calc.id)}
                  className="text-left p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {calc.label}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click to access the {calc.label.toLowerCase()} planning tool
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {availableCalculators.map((calc) => {
              if (calc.id === activeCalculator) {
                const Component = calc.component;
                return <Component key={calc.id} />;
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
});