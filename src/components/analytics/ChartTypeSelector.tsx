import React, { useEffect, memo } from 'react';
import { CHART_CATALOG } from './chartCatalog';
import type { ChartType, ChartConfig } from './chartCatalog';
import { logger } from '../../services/loggingService';

interface ChartTypeSelectorProps {
  selectedChart: ChartType | null;
  onSelectChart: (type: ChartType) => void;
  dataShape?: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
}

export const ChartTypeSelector = memo(function ChartTypeSelector({
  selectedChart,
  onSelectChart,
  dataShape
}: ChartTypeSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ChartTypeSelector component initialized', {
      componentName: 'ChartTypeSelector'
    });
  }, []);

  // Filter charts based on data shape compatibility
  const availableCharts = dataShape 
    ? CHART_CATALOG.filter(chart => chart.requiredDataShape === dataShape)
    : CHART_CATALOG;

  // Group charts by category
  const chartGroups = {
    'Trend Analysis': availableCharts.filter(c => 
      ['line', 'multi-line', 'area', 'stacked-area'].includes(c.type)
    ),
    'Comparison': availableCharts.filter(c => 
      ['bar', 'grouped-bar', 'stacked-bar', 'horizontal-bar'].includes(c.type)
    ),
    'Composition': availableCharts.filter(c => 
      ['pie', 'donut', 'sunburst', 'treemap'].includes(c.type)
    ),
    'Distribution': availableCharts.filter(c => 
      ['scatter', 'bubble', 'heatmap'].includes(c.type)
    ),
    'Flow': availableCharts.filter(c => 
      ['waterfall', 'funnel', 'sankey'].includes(c.type)
    )
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Select Chart Type
      </h3>
      
      {Object.entries(chartGroups).map(([category, charts]) => {
        if (charts.length === 0) return null;
        
        return (
          <div key={category} className="space-y-3">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {category}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {charts.map(chart => {
                const Icon = chart.icon;
                const isSelected = selectedChart === chart.type;
                
                return (
                  <button
                    key={chart.type}
                    onClick={() => onSelectChart(chart.type)}
                    className={`
                      p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }
                    `}
                  >
                    <Icon size={24} className={`mx-auto mb-2 ${
                      isSelected ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                    }`}>
                      {chart.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {chart.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
