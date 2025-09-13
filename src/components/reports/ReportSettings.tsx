import React, { useEffect, memo } from 'react';
import { Settings } from '../icons';
import { logger } from '../../services/loggingService';

export type CategoryLevel = 'type' | 'sub' | 'detail';
export type TimePeriod = '1month' | '12months' | '24months' | 'custom';

export interface ReportSettings {
  showSettings: boolean;
  categoryLevel: CategoryLevel;
  timePeriod: TimePeriod;
  customStartDate: string;
  customEndDate: string;
  showCategoryModal: boolean;
  excludedCategories: string[];
}

interface ReportSettingsProps {
  settings: ReportSettings;
  onSettingsChange: (settings: ReportSettings | ((prev: ReportSettings) => ReportSettings)) => void;
  isModal?: boolean;
}

export const ReportSettingsPanel = memo(function ReportSettingsPanel({
  settings,
  onSettingsChange,
  isModal = false
}: ReportSettingsProps) {
  const toggleSettings = () => {
    onSettingsChange(prev => ({ ...prev, showSettings: !prev.showSettings }));
  };

  const setCategoryLevel = (level: CategoryLevel) => {
    onSettingsChange(prev => ({ ...prev, categoryLevel: level }));
  };

  const setTimePeriod = (period: TimePeriod) => {
    onSettingsChange(prev => ({ ...prev, timePeriod: period }));
  };

  const setCustomDates = (startDate: string, endDate: string) => {
    onSettingsChange(prev => ({ 
      ...prev, 
      customStartDate: startDate,
      customEndDate: endDate,
      timePeriod: 'custom'
    }));
  };

  const toggleCategoryExclusion = (categoryId: string) => {
    onSettingsChange(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(categoryId)
        ? prev.excludedCategories.filter(id => id !== categoryId)
        : [...prev.excludedCategories, categoryId]
    }));
  };

  return (
    <>
      {/* Settings Toggle */}
      <div className={`flex items-center gap-3 ${isModal ? 'w-full justify-between' : ''}`}>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
          {settings.timePeriod === '1month' ? 'Last month' :
           settings.timePeriod === '12months' ? 'Last 12 months' :
           settings.timePeriod === '24months' ? 'Last 24 months' :
           'Custom period'} • {settings.categoryLevel === 'type' ? 'Type level' : 
           settings.categoryLevel === 'sub' ? 'Sub-category level' : 'Detail level'}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSettings();
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Report settings"
        >
          <Settings size={18} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Settings Panel */}
      {settings.showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
          {/* Category Level */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Category Level
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryLevel('type')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'type'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Income/Expense Only
              </button>
              <button
                onClick={() => setCategoryLevel('sub')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'sub'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Sub-Categories
              </button>
              <button
                onClick={() => setCategoryLevel('detail')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'detail'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Detailed Categories
              </button>
            </div>
          </div>

          {/* Time Period */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Time Period
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTimePeriod('1month')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '1month'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past Month
              </button>
              <button
                onClick={() => setTimePeriod('12months')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '12months'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past 12 Months
              </button>
              <button
                onClick={() => setTimePeriod('24months')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '24months'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past 24 Months
              </button>
              <button
                onClick={() => setTimePeriod('custom')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === 'custom'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          {settings.timePeriod === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={settings.customStartDate}
                  onChange={(e) => setCustomDates(e.target.value, settings.customEndDate)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  End Date
                </label>
                <input
                  type="date"
                  value={settings.customEndDate}
                  onChange={(e) => setCustomDates(settings.customStartDate, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Exclude Categories Button */}
          <div>
            <button
              onClick={() => onSettingsChange(prev => ({ ...prev, showCategoryModal: true }))}
              className="text-sm text-primary hover:underline"
            >
              Manage Excluded Categories ({settings.excludedCategories.length})
            </button>
          </div>
        </div>
      )}
    </>
  );
});