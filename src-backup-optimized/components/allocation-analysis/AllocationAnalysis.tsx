import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useAllocationAnalysis } from './useAllocationAnalysis';
import { ChartControls } from './ChartControls';
import { AllocationStats } from './AllocationStats';
import { AllocationPieChart } from './AllocationPieChart';
import { AllocationBarChart } from './AllocationBarChart';
import { AllocationTreemap } from './AllocationTreemap';
import type { AllocationAnalysisProps } from './types';
import { useLogger } from '../services/ServiceProvider';

const AllocationAnalysis = memo(function AllocationAnalysis({ accountId  }: AllocationAnalysisProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationAnalysis component initialized', {
      componentName: 'AllocationAnalysis'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  const {
    allocations,
    viewMode,
    setViewMode,
    groupBy,
    setGroupBy,
    showTargets,
    setShowTargets,
    totalValue,
    largestHolding,
    exportData
  } = useAllocationAnalysis(accountId);

  if (allocations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Allocation Analysis
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No investment data available. Add investments to see allocation analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Allocation Analysis
      </h2>

      <AllocationStats
        totalValue={totalValue}
        largestHolding={largestHolding}
        allocationsCount={allocations.length}
        formatCurrency={formatCurrency}
      />

      <ChartControls
        viewMode={viewMode}
        groupBy={groupBy}
        showTargets={showTargets}
        onViewModeChange={setViewMode}
        onGroupByChange={setGroupBy}
        onToggleTargets={() => setShowTargets(!showTargets)}
        onExport={exportData}
      />

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        {viewMode === 'pie' && (
          <AllocationPieChart
            allocations={allocations}
            showTargets={showTargets}
            formatCurrency={formatCurrency}
          />
        )}
        
        {viewMode === 'bar' && (
          <AllocationBarChart
            allocations={allocations}
            showTargets={showTargets}
            formatCurrency={formatCurrency}
          />
        )}
        
        {viewMode === 'treemap' && (
          <AllocationTreemap
            allocations={allocations}
            formatCurrency={formatCurrency}
          />
        )}
      </div>
    </div>
  );
});

export default AllocationAnalysis;