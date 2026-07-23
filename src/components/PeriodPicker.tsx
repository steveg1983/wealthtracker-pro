import React from 'react';
import { PERIOD_LABELS, type PeriodKey, type UsePeriodResult } from '../hooks/usePeriod';

const ORDER: PeriodKey[] = ['this-month', 'last-month', 'tax-year', 'last-12-months', 'all', 'custom'];

/**
 * The shared reporting-period control (pair with usePeriod). Same segmented
 * style as the Accounts page toolbar, so every reporting surface reads the
 * same and MEANS the same.
 */
export default function PeriodPicker({ picker }: { picker: UsePeriodResult }): React.JSX.Element {
  const { period, setPeriod, customStart, customEnd, setCustomStart, setCustomEnd } = picker;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
        {ORDER.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            // The selection is styling alone otherwise — assistive technology
            // (and tests) need it stated.
            aria-pressed={period === key}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              period === key
                ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            aria-label="Custom period start date"
            className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            aria-label="Custom period end date"
            className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}
