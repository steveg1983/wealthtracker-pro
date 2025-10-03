/**
 * @component ConfigurationSection
 * @description Configuration inputs for state tax calculation
 */

import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface State {
  code: string;
  name: string;
}

interface ConfigurationSectionProps {
  filingStatus: 'single' | 'married';
  age: number;
  selectedState: string;
  states: State[];
  onFilingStatusChange: (status: 'single' | 'married') => void;
  onAgeChange: (age: number) => void;
  onStateChange: (state: string) => void;
}

export const ConfigurationSection = memo(function ConfigurationSection({ filingStatus,
  age,
  selectedState,
  states,
  onFilingStatusChange,
  onAgeChange,
  onStateChange
 }: ConfigurationSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ConfigurationSection component initialized', {
      componentName: 'ConfigurationSection'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filing Status
        </label>
        <select
          value={filingStatus}
          onChange={(e) => onFilingStatusChange(e.target.value as 'single' | 'married')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        >
          <option value="single">Single</option>
          <option value="married">Married Filing Jointly</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Age
        </label>
        <input
          type="number"
          value={age}
          onChange={(e) => onAgeChange(parseInt(e.target.value) || 65)}
          min="50"
          max="100"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          State
        </label>
        <select
          value={selectedState}
          onChange={(e) => onStateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        >
          {states.map(state => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});