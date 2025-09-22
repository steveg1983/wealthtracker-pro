import React, { useEffect, memo } from 'react';
import { toDecimal } from '../../utils/decimal';
import type { BenchmarkComparison } from '../../services/investmentEnhancementService';
import { useLogger } from '../services/ServiceProvider';

interface BenchmarksTabProps {
  benchmarkData: BenchmarkComparison | null;
  formatCurrency: (value: number) => string;
  getReturnColorClass: (value: number) => string;
}

const BenchmarksTab = memo(function BenchmarksTab({ benchmarkData,
  formatCurrency,
  getReturnColorClass
 }: BenchmarksTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BenchmarksTab component initialized', {
      componentName: 'BenchmarksTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Benchmark Comparison</h3>
        <p className="text-sm text-orange-700 dark:text-orange-200">
          Compare your portfolio performance against market indices.
        </p>
      </div>

      {benchmarkData && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Portfolio Performance</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricDisplay
                label="Total Return"
                value={`${benchmarkData.portfolio.return >= 0 ? '+' : ''}${toDecimal(benchmarkData.portfolio.return).toFixed(2)}%`}
                colorClass={getReturnColorClass(benchmarkData.portfolio.return)}
              />
              <MetricDisplay
                label="Annualized"
                value={`${benchmarkData.portfolio.annualizedReturn >= 0 ? '+' : ''}${toDecimal(benchmarkData.portfolio.annualizedReturn).toFixed(2)}%`}
                colorClass={getReturnColorClass(benchmarkData.portfolio.annualizedReturn)}
              />
              <MetricDisplay
                label="Current Value"
                value={formatCurrency(Number((benchmarkData.portfolio as any).totalValue?.toNumber ? (benchmarkData.portfolio as any).totalValue.toNumber() : benchmarkData.portfolio.totalValue))}
                colorClass="text-gray-900 dark:text-white"
              />
              <MetricDisplay
                label="Start Value"
                value={formatCurrency(Number((benchmarkData.portfolio as any).startValue?.toNumber ? (benchmarkData.portfolio as any).startValue.toNumber() : benchmarkData.portfolio.startValue))}
                colorClass="text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-3">
            {benchmarkData.benchmarks.map((benchmark, index) => (
              <BenchmarkCard
                key={index}
                benchmark={benchmark}
                getReturnColorClass={getReturnColorClass}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

const MetricDisplay = memo(function MetricDisplay({
  label,
  value,
  colorClass
}: {
  label: string;
  value: string;
  colorClass: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
});

const BenchmarkCard = memo(function BenchmarkCard({
  benchmark,
  getReturnColorClass
}: {
  benchmark: BenchmarkComparison['benchmarks'][0];
  getReturnColorClass: (value: number) => string;
}): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{benchmark.name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{benchmark.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {toDecimal(benchmark.annualizedReturn).toFixed(2)}%
          </p>
          <p className={`text-sm font-medium ${getReturnColorClass(benchmark.outperformance)}`}>
            {benchmark.outperformance >= 0 ? 'Outperforming' : 'Underperforming'} by{' '}
            {toDecimal(benchmark.outperformance).abs().toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
});

export default BenchmarksTab;
