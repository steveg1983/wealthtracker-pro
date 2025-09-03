import React from 'react';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';
import { taxDataService, UKTaxYear } from '../../services/taxDataService';

interface TaxYearSelectorProps {
  value?: UKTaxYear;
  onChange?: (year: UKTaxYear) => void;
  className?: string;
}

export default function TaxYearSelector({ value, onChange, className = '' }: TaxYearSelectorProps): React.JSX.Element {
  const { region } = useRegionalSettings();
  
  // Only show for UK users
  if (region !== 'UK') {
    return <></>;
  }
  
  const currentYear = taxDataService.getCurrentUKTaxYear();
  const priorYear = taxDataService.getPriorUKTaxYear();
  const selectedYear = value || taxDataService.getSelectedUKTaxYear();
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const year = e.target.value as UKTaxYear;
    taxDataService.setUKTaxYear(year);
    onChange?.(year);
  };
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label htmlFor="tax-year-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Tax Year:
      </label>
      <div className="relative">
        <select
          id="tax-year-select"
          value={selectedYear}
          onChange={handleChange}
          className="px-2 pr-6 py-0 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
          style={{ height: '28px' }}
        >
          <option value={currentYear}>Current Tax Year ({currentYear})</option>
          <option value={priorYear}>Prior Tax Year ({priorYear})</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        (Updates automatically after April 6th)
      </span>
    </div>
  );
}