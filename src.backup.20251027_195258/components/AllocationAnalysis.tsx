import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { portfolioRebalanceService } from '../services/portfolioRebalanceService';
import type { AssetAllocation } from '../services/portfolioRebalanceService';
import type { Investment } from '../types';
import { toDecimal, formatPercentageValue, formatSignedPercentageValue, type DecimalInstance } from '@wealthtracker/utils';
import { formatChartNumber } from './charts/optimizedChartHelpers';
import {
  PieChartIcon,
  BarChart3Icon,
  TrendingUpIcon,
  InfoIcon,
  TargetIcon,
  DownloadIcon
} from './icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Treemap
} from 'recharts';

interface AllocationAnalysisProps {
  accountId?: string;
}

const formatDecimalForCsv = (value: DecimalInstance | number, decimals: number = 2): string => {
  const decimalValue = toDecimal(value).toDecimalPlaces(decimals);
  if (decimals === 0) {
    return decimalValue.toString();
  }

  const [integerPart, fractionalPart = ''] = decimalValue.toString().split('.');
  const paddedFraction = fractionalPart.padEnd(decimals, '0');
  return `${integerPart}.${paddedFraction.slice(0, decimals)}`;
};

export default function AllocationAnalysis({ accountId }: AllocationAnalysisProps) {
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [viewMode, setViewMode] = useState<'pie' | 'bar' | 'treemap'>('pie');
  const [groupBy, setGroupBy] = useState<'assetClass' | 'account' | 'symbol'>('assetClass');
  const [showTargets, setShowTargets] = useState(true);

  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  // Extract investments from accounts with holdings
  const investments = useMemo(() => {
    const allInvestments: Investment[] = [];
    accounts.forEach(account => {
      if (account.type === 'investment' && account.holdings) {
        account.holdings.forEach(holding => {
          allInvestments.push({
            id: `${account.id}-${holding.ticker}`,
            accountId: account.id,
            symbol: holding.ticker,
            name: holding.name,
            quantity: holding.shares,
            purchasePrice: holding.averageCost || 0,
            purchaseDate: new Date(),
            currentPrice: holding.currentPrice,
            currentValue: holding.marketValue || holding.value,
            averageCost: holding.averageCost || 0,
            createdAt: new Date()
          } as Investment);
        });
      }
    });
    return allInvestments;
  }, [accounts]);

  const analyzeAllocations = useCallback(() => {
    if (groupBy === 'assetClass') {
      // Use the portfolio rebalance service for asset class allocation
      const holdings = investments
        .filter(inv => !accountId || inv.accountId === accountId)
        .map(inv => ({
          symbol: inv.symbol,
          value: inv.currentValue,
          shares: inv.quantity
        }));

      const allocs = portfolioRebalanceService.calculateCurrentAllocation(holdings);
      setAllocations(allocs);
    } else if (groupBy === 'account') {
      // Group by account
      const byAccount: Record<string, DecimalInstance> = {};
      const totalValue = investments.reduce(
        (sum, inv) => sum.plus(toDecimal(inv.currentValue)),
        toDecimal(0)
      );

      investments.forEach(inv => {
        const account = accounts.find(a => a.id === inv.accountId);
        const accountName = account?.name || 'Unknown';
        if (!byAccount[accountName]) {
          byAccount[accountName] = toDecimal(0);
        }
        byAccount[accountName] = byAccount[accountName].plus(toDecimal(inv.currentValue));
      });

      const accountAllocations: AssetAllocation[] = Object.entries(byAccount).map(([name, value]) => {
        const currentPercent = totalValue.isZero()
          ? 0
          : value.dividedBy(totalValue).times(100).toNumber();
        return {
          assetClass: name,
          currentPercent,
          currentValue: value,
          targetPercent: 0,
          targetValue: toDecimal(0),
          difference: toDecimal(0),
          differencePercent: 0
        };
      });

      setAllocations(accountAllocations);
    } else {
      // Group by symbol
      const bySymbol: Record<string, { value: DecimalInstance; name: string }> = {};
      const totalValue = investments.reduce(
        (sum, inv) => sum.plus(toDecimal(inv.currentValue)),
        toDecimal(0)
      );

      investments.forEach(inv => {
        if (!bySymbol[inv.symbol]) {
          bySymbol[inv.symbol] = { value: toDecimal(0), name: inv.name };
        }
        const entry = bySymbol[inv.symbol];
        if (entry) {
          entry.value = entry.value.plus(toDecimal(inv.currentValue));
        }
      });

      const symbolAllocations: AssetAllocation[] = Object.entries(bySymbol).map(([symbol, data]) => {
        const currentPercent = totalValue.isZero()
          ? 0
          : data.value.dividedBy(totalValue).times(100).toNumber();
        return {
          assetClass: `${symbol} - ${data.name}`,
          currentPercent,
          currentValue: data.value,
          targetPercent: 0,
          targetValue: toDecimal(0),
          difference: toDecimal(0),
          differencePercent: 0
        };
      });

      setAllocations(symbolAllocations.sort((a, b) => b.currentPercent - a.currentPercent));
    }
  }, [accountId, accounts, groupBy, investments]);

  useEffect(() => {
    analyzeAllocations();
  }, [analyzeAllocations]);

  const exportData = () => {
    const data = allocations.map(alloc => ({
      Category: alloc.assetClass,
      'Current %': formatDecimalForCsv(alloc.currentPercent, 2),
      'Current Value': formatDecimalForCsv(alloc.currentValue, 2),
      'Target %': formatDecimalForCsv(alloc.targetPercent, 2),
      'Difference %': formatDecimalForCsv(alloc.differencePercent, 2)
    }));

    if (data.length === 0) return;

    const firstRow = data[0];
    if (!firstRow) return;

    const csv = [
      Object.keys(firstRow).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allocation-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const chartData = allocations.map(alloc => ({
    name: alloc.assetClass,
    value: alloc.currentValue.toNumber(),
    percent: alloc.currentPercent,
    target: alloc.targetPercent
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6', '#F97316', '#6366F1'];

  const totalValueDecimal = allocations.reduce(
    (sum, alloc) => sum.plus(alloc.currentValue),
    toDecimal(0)
  );
  const largestAllocation = allocations[0];
  const topThreePercent = allocations.slice(0, 3).reduce(
    (sum, alloc) => sum.plus(toDecimal(alloc.currentPercent)),
    toDecimal(0)
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <select
            value={groupBy}
            onChange={(e) => {
              const nextGroup = e.target.value as 'assetClass' | 'account' | 'symbol';
              setGroupBy(nextGroup);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="assetClass">By Asset Class</option>
            <option value="account">By Account</option>
            <option value="symbol">By Symbol</option>
          </select>
          
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => setViewMode('pie')}
              className={`px-3 py-1.5 rounded-l-lg transition-colors ${
                viewMode === 'pie' ? 'bg-gray-600 text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Pie Chart"
            >
              <PieChartIcon size={20} />
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === 'bar' ? 'bg-gray-600 text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Bar Chart"
            >
              <BarChart3Icon size={20} />
            </button>
            <button
              onClick={() => setViewMode('treemap')}
              className={`px-3 py-1.5 rounded-r-lg transition-colors ${
                viewMode === 'treemap' ? 'bg-gray-600 text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Treemap"
            >
              <TrendingUpIcon size={20} />
            </button>
          </div>

          {groupBy === 'assetClass' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTargets}
                onChange={(e) => setShowTargets(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show Targets</span>
            </label>
          )}
        </div>
        
        <button
          onClick={exportData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <DownloadIcon size={20} />
          Export
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValueDecimal)}</p>
            </div>
            <PieChartIcon size={32} className="text-gray-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-2xl font-bold">{allocations.length}</p>
            </div>
            <TargetIcon size={32} className="text-green-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Largest Holding</p>
              <p className="text-lg font-bold">
                {largestAllocation?.assetClass || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {largestAllocation ? formatPercentageValue(largestAllocation.currentPercent, 1) : '0.0%'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Concentration</p>
              <p className="text-lg font-bold">
                Top 3: {formatPercentageValue(topThreePercent, 1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Allocation Visualization</h3>
        
        {viewMode === 'pie' && (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => {
                  if (percent === undefined) {
                    return `${name}: 0%`;
                  }
                  const percentValue = toDecimal(percent).times(100);
                  return `${name}: ${formatPercentageValue(percentValue, 1)}`;
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        )}
        
        {viewMode === 'bar' && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ left: 50, right: 20, top: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100}
              />
              <YAxis tickFormatter={(value) => formatPercentageValue(value as number, 0)} />
              <Tooltip formatter={(value) => formatPercentageValue(value as number, 2)} />
              <Legend />
              <Bar dataKey="percent" fill="#3B82F6" name="Current %" />
              {showTargets && groupBy === 'assetClass' && (
                <Bar dataKey="target" fill="#10B981" name="Target %" />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
        
        {viewMode === 'treemap' && (
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={chartData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#3B82F6"
            >
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-300 dark:border-gray-600 rounded shadow">
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm">{formatCurrency(data.value)}</p>
                        <p className="text-xs text-gray-500">{formatChartNumber(data.value)}</p>
                        <p className="text-sm">{formatPercentageValue(data.percent ?? 0, 1)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Allocation Details</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-2">Category</th>
                <th className="text-right py-2">Current %</th>
                <th className="text-right py-2">Value</th>
                {showTargets && groupBy === 'assetClass' && (
                  <>
                    <th className="text-right py-2">Target %</th>
                    <th className="text-right py-2">Difference</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc, index) => {
                const differenceMagnitude = Math.abs(alloc.differencePercent);
                const differenceClass = differenceMagnitude < 2
                  ? 'text-green-600'
                  : differenceMagnitude < 5
                  ? 'text-yellow-600'
                  : 'text-red-600';

                return (
                  <tr key={index} className="border-b dark:border-gray-700">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{alloc.assetClass}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatPercentageValue(alloc.currentPercent, 2)}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(alloc.currentValue)}
                    </td>
                    {showTargets && groupBy === 'assetClass' && (
                      <>
                        <td className="py-2 text-right">
                          {formatPercentageValue(alloc.targetPercent, 2)}
                        </td>
                        <td className={`py-2 text-right font-medium ${differenceClass}`}>
                          {formatSignedPercentageValue(alloc.differencePercent, 2)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-start gap-3">
          <InfoIcon size={24} className="text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Allocation Insights
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {allocations.length > 0 && allocations[0] && (
                <>
                  <li>• Your portfolio is spread across {allocations.length} different {groupBy === 'assetClass' ? 'asset classes' : groupBy === 'account' ? 'accounts' : 'securities'}</li>
                  <li>• The top holding ({allocations[0].assetClass}) represents {formatPercentageValue(allocations[0].currentPercent, 1)} of your portfolio</li>
                  {allocations[0].currentPercent > 30 && (
                    <li className="text-orange-700 dark:text-orange-400">• Consider diversifying - your largest position exceeds 30% of the portfolio</li>
                  )}
                  {groupBy === 'assetClass' && allocations.some(a => Math.abs(a.differencePercent) > 5) && (
                    <li className="text-orange-700 dark:text-orange-400">• Some asset classes are significantly off target - consider rebalancing</li>
                  )}
                  {allocations.filter(a => a.currentPercent < 5).length > 5 && (
                    <li>• You have {allocations.filter(a => a.currentPercent < 5).length} positions under 5% - consider consolidating small holdings</li>
                  )}
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
