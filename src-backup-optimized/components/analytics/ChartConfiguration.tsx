import React, { useEffect, memo, useState } from 'react';
import { getChartByType } from './chartCatalog';
import type { ChartType, ChartOptions } from './chartCatalog';
import { useLogger } from '../services/ServiceProvider';

interface ChartConfigurationProps {
  chartType: ChartType | null;
  onUpdateOptions: (options: ChartOptions) => void;
  onUpdateTitle: (title: string) => void;
  defaultTitle?: string;
}

export const ChartConfiguration = memo(function ChartConfiguration({ chartType,
  onUpdateOptions,
  onUpdateTitle,
  defaultTitle = ''
 }: ChartConfigurationProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('ChartConfiguration component initialized', {
      componentName: 'ChartConfiguration'
    });
  }, []);

  const [title, setTitle] = useState(defaultTitle);
  const [options, setOptions] = useState<ChartOptions>({});
  
  if (!chartType) {
    return null;
  }

  const chartConfig = getChartByType(chartType);
  if (!chartConfig) {
    return null;
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    onUpdateTitle(e.target.value);
  };

  const handleOptionChange = (key: keyof ChartOptions, value: unknown) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    onUpdateOptions(newOptions);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Chart Title
        </label>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={`${chartConfig.name} Analysis`}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
        />
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Chart Options
        </h4>

        {/* Show Legend */}
        {chartConfig.defaultOptions.showLegend !== undefined && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showLegend ?? chartConfig.defaultOptions.showLegend}
              onChange={(e) => handleOptionChange('showLegend', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Show Legend</span>
          </label>
        )}

        {/* Show Grid */}
        {chartConfig.defaultOptions.showGrid !== undefined && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showGrid ?? chartConfig.defaultOptions.showGrid}
              onChange={(e) => handleOptionChange('showGrid', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Show Grid</span>
          </label>
        )}

        {/* Show Values */}
        {chartConfig.defaultOptions.showValues !== undefined && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showValues ?? chartConfig.defaultOptions.showValues}
              onChange={(e) => handleOptionChange('showValues', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Show Values</span>
          </label>
        )}

        {/* Show Percentages */}
        {chartConfig.defaultOptions.showPercentages !== undefined && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showPercentages ?? chartConfig.defaultOptions.showPercentages}
              onChange={(e) => handleOptionChange('showPercentages', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Show Percentages</span>
          </label>
        )}

        {/* Fill Opacity */}
        {chartConfig.defaultOptions.fillOpacity !== undefined && (
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Fill Opacity: {options.fillOpacity ?? chartConfig.defaultOptions.fillOpacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={options.fillOpacity ?? chartConfig.defaultOptions.fillOpacity}
              onChange={(e) => handleOptionChange('fillOpacity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {/* Bar Mode */}
        {chartConfig.defaultOptions.barMode && (
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Bar Mode
            </label>
            <select
              value={options.barMode ?? chartConfig.defaultOptions.barMode}
              onChange={(e) => handleOptionChange('barMode', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            >
              <option value="group">Grouped</option>
              <option value="stack">Stacked</option>
              <option value="relative">Relative</option>
            </select>
          </div>
        )}

        {/* Color Scale */}
        {chartConfig.defaultOptions.colorScale && (
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Color Scale
            </label>
            <select
              value={options.colorScale ?? chartConfig.defaultOptions.colorScale}
              onChange={(e) => handleOptionChange('colorScale', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            >
              <option value="Viridis">Viridis</option>
              <option value="Blues">Blues</option>
              <option value="Reds">Reds</option>
              <option value="Greens">Greens</option>
              <option value="Portland">Portland</option>
              <option value="Jet">Jet</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
});
