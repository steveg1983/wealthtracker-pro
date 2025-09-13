import React, { useEffect, memo } from 'react';
import { SettingsIcon } from '../icons';
import type { ProjectionSettings as Settings } from './types';
import { logger } from '../../services/loggingService';

interface ProjectionSettingsProps {
  settings: Settings;
  showSettings: boolean;
  onToggleSettings: () => void;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  monthlyTrend: number;
  formatCurrency: (value: number) => string;
}

export const ProjectionSettings = memo(function ProjectionSettings({
  settings,
  showSettings,
  onToggleSettings,
  onUpdateSettings,
  monthlyTrend,
  formatCurrency
}: ProjectionSettingsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ProjectionSettings component initialized', {
      componentName: 'ProjectionSettings'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggleSettings}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SettingsIcon size={20} />
          <span className="font-medium text-gray-900 dark:text-white">
            Projection Settings
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {showSettings ? 'Hide' : 'Show'}
        </span>
      </button>

      {showSettings && (
        <div className="p-6 pt-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Projection Period (Years)
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={settings.projectionYears}
              onChange={(e) => onUpdateSettings({ projectionYears: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 year</span>
              <span className="font-medium">{settings.projectionYears} years</span>
              <span>30 years</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Monthly Savings/Investment
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={settings.monthlySavings}
                onChange={(e) => onUpdateSettings({ monthlySavings: Number(e.target.value) })}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                step="100"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Based on recent trend: {formatCurrency(monthlyTrend)}/month
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected Annual Return (%)
            </label>
            <input
              type="number"
              value={(settings.assumedGrowthRate * 100).toFixed(1)}
              onChange={(e) => onUpdateSettings({ assumedGrowthRate: Number(e.target.value) / 100 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.5"
              min="-10"
              max="20"
            />
            <p className="text-xs text-gray-500 mt-1">
              Historical S&P 500 average: ~7-10% per year
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Inflation Rate (%)
            </label>
            <input
              type="number"
              value={(settings.inflationRate * 100).toFixed(1)}
              onChange={(e) => onUpdateSettings({ inflationRate: Number(e.target.value) / 100 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.1"
              min="0"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Typical range: 2-3% per year
            </p>
          </div>
        </div>
      )}
    </div>
  );
});