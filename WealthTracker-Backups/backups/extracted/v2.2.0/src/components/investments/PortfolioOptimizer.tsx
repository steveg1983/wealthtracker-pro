import { useState, useMemo, useEffect } from 'react';
import { portfolioOptimizationService, type Asset, type EfficientFrontierPoint } from '../../services/portfolioOptimizationService';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { 
  TrendingUpIcon,
  TargetIcon,
  AlertTriangleIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  RefreshCwIcon,
  DownloadIcon
} from '../icons';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Default asset classes with historical statistics
const DEFAULT_ASSETS: Asset[] = [
  { symbol: 'STOCKS', name: 'US Stocks', expectedReturn: 0.10, volatility: 0.16 },
  { symbol: 'INTL', name: 'International Stocks', expectedReturn: 0.08, volatility: 0.18 },
  { symbol: 'BONDS', name: 'US Bonds', expectedReturn: 0.04, volatility: 0.05 },
  { symbol: 'REITS', name: 'Real Estate', expectedReturn: 0.09, volatility: 0.19 },
  { symbol: 'COMMOD', name: 'Commodities', expectedReturn: 0.06, volatility: 0.20 },
  { symbol: 'GOLD', name: 'Gold', expectedReturn: 0.05, volatility: 0.15 }
];

// Default correlation matrix (simplified)
const DEFAULT_CORRELATIONS = [
  [1.00, 0.70, 0.10, 0.60, 0.30, 0.05],  // US Stocks
  [0.70, 1.00, 0.15, 0.55, 0.35, 0.10],  // International Stocks
  [0.10, 0.15, 1.00, 0.20, -0.10, 0.15], // US Bonds
  [0.60, 0.55, 0.20, 1.00, 0.40, 0.15],  // Real Estate
  [0.30, 0.35, -0.10, 0.40, 1.00, 0.50], // Commodities
  [0.05, 0.10, 0.15, 0.15, 0.50, 1.00]   // Gold
];

interface PortfolioOptimizerProps {
  portfolioValue?: number;
  currentAllocations?: Record<string, number>;
}

export default function PortfolioOptimizer({ 
  portfolioValue = 100000,
  currentAllocations = {}
}: PortfolioOptimizerProps) {
  const { formatCurrency } = useRegionalCurrency();
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [correlationMatrix, setCorrelationMatrix] = useState(DEFAULT_CORRELATIONS);
  const [riskFreeRate, setRiskFreeRate] = useState(0.04);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<EfficientFrontierPoint | null>(null);
  const [optimizationTarget, setOptimizationTarget] = useState<'sharpe' | 'minRisk' | 'maxReturn'>('sharpe');
  
  // Calculate efficient frontier
  const efficientFrontier = useMemo(() => {
    return portfolioOptimizationService.generateEfficientFrontier(
      assets,
      correlationMatrix,
      30,
      { riskFreeRate }
    );
  }, [assets, correlationMatrix, riskFreeRate]);

  // Find optimal portfolio based on target
  const optimalPortfolio = useMemo(() => {
    if (optimizationTarget === 'sharpe') {
      return portfolioOptimizationService.findOptimalPortfolio(
        assets,
        correlationMatrix,
        { riskFreeRate }
      );
    } else if (optimizationTarget === 'minRisk') {
      return efficientFrontier.reduce((min, point) => 
        point.risk < min.risk ? point : min
      , efficientFrontier[0]);
    } else {
      return efficientFrontier.reduce((max, point) => 
        point.return > max.return ? point : max
      , efficientFrontier[0]);
    }
  }, [assets, correlationMatrix, riskFreeRate, optimizationTarget, efficientFrontier]);

  // Chart data
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Efficient Frontier',
          data: efficientFrontier.map(point => ({
            x: point.risk * 100,
            y: point.return * 100
          })),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Individual Assets',
          data: assets.map(asset => ({
            x: asset.volatility * 100,
            y: asset.expectedReturn * 100
          })),
          borderColor: 'rgb(156, 163, 175)',
          backgroundColor: 'rgb(156, 163, 175)',
          showLine: false,
          pointRadius: 6,
          pointStyle: 'rect'
        },
        {
          label: 'Optimal Portfolio',
          data: [{
            x: 'risk' in optimalPortfolio ? optimalPortfolio.risk * 100 : ('volatility' in optimalPortfolio ? (optimalPortfolio as EfficientFrontierPoint & { volatility: number }).volatility * 100 : 0),
            y: 'return' in optimalPortfolio ? optimalPortfolio.return * 100 : ('expectedReturn' in optimalPortfolio ? (optimalPortfolio as EfficientFrontierPoint & { expectedReturn: number }).expectedReturn * 100 : 0)
          }],
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgb(34, 197, 94)',
          showLine: false,
          pointRadius: 10,
          pointStyle: 'star'
        }
      ]
    };
  }, [efficientFrontier, assets, optimalPortfolio]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Efficient Frontier Analysis'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const x = context.parsed.x.toFixed(2);
            const y = context.parsed.y.toFixed(2);
            return `${label}: Risk ${x}%, Return ${y}%`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Risk (Standard Deviation %)'
        },
        min: 0
      },
      y: {
        title: {
          display: true,
          text: 'Expected Return (%)'
        },
        min: 0
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && elements[0].datasetIndex === 0) {
        const index = elements[0].index;
        setSelectedPoint(efficientFrontier[index]);
      }
    }
  };

  // Handle asset changes
  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    const newAssets = [...assets];
    if (field === 'expectedReturn' || field === 'volatility') {
      newAssets[index][field] = Number(value) / 100;
    } else if (field === 'symbol' || field === 'name') {
      newAssets[index][field] = String(value);
    }
    setAssets(newAssets);
  };

  const addAsset = () => {
    setAssets([...assets, {
      symbol: `ASSET${assets.length + 1}`,
      name: 'New Asset',
      expectedReturn: 0.07,
      volatility: 0.15
    }]);
    
    // Expand correlation matrix
    const newMatrix = correlationMatrix.map(row => [...row, 0.3]);
    newMatrix.push(new Array(newMatrix[0].length).fill(0.3));
    newMatrix[newMatrix.length - 1][newMatrix.length - 1] = 1;
    setCorrelationMatrix(newMatrix);
  };

  const removeAsset = (index: number) => {
    if (assets.length <= 2) return; // Need at least 2 assets
    
    const newAssets = assets.filter((_, i) => i !== index);
    setAssets(newAssets);
    
    // Shrink correlation matrix
    const newMatrix = correlationMatrix
      .filter((_, i) => i !== index)
      .map(row => row.filter((_, i) => i !== index));
    setCorrelationMatrix(newMatrix);
  };

  // Calculate current portfolio if allocations provided
  const currentPortfolioStats = useMemo(() => {
    if (Object.keys(currentAllocations).length === 0) return null;
    
    const weights = assets.map(asset => currentAllocations[asset.symbol] || 0);
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum === 0) return null;
    
    const normalizedWeights = weights.map(w => w / sum);
    return portfolioOptimizationService.calculatePortfolioStats(
      assets,
      normalizedWeights,
      correlationMatrix,
      riskFreeRate
    );
  }, [assets, currentAllocations, correlationMatrix, riskFreeRate]);

  // Rebalancing suggestions
  const rebalancingSuggestions = useMemo(() => {
    if (!currentPortfolioStats || !optimalPortfolio) return [];
    
    return portfolioOptimizationService.suggestRebalancing(
      currentPortfolioStats.weights,
      optimalPortfolio.weights,
      portfolioValue,
      0.05
    );
  }, [currentPortfolioStats, optimalPortfolio, portfolioValue]);

  const displayPortfolio = selectedPoint || optimalPortfolio;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Portfolio Optimizer - Modern Portfolio Theory
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Find the optimal asset allocation using mean-variance optimization
        </p>
      </div>

      {/* Optimization Target Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Optimization Target
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setOptimizationTarget('sharpe')}
            className={`p-3 rounded-lg border transition-colors ${
              optimizationTarget === 'sharpe'
                ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            <TargetIcon size={20} className="mx-auto mb-1 text-gray-600 dark:text-gray-500" />
            <p className="text-sm font-medium">Max Sharpe Ratio</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Best risk-adjusted returns</p>
          </button>
          
          <button
            onClick={() => setOptimizationTarget('minRisk')}
            className={`p-3 rounded-lg border transition-colors ${
              optimizationTarget === 'minRisk'
                ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            <AlertTriangleIcon size={20} className="mx-auto mb-1 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium">Minimum Risk</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Lowest volatility</p>
          </button>
          
          <button
            onClick={() => setOptimizationTarget('maxReturn')}
            className={`p-3 rounded-lg border transition-colors ${
              optimizationTarget === 'maxReturn'
                ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            <TrendingUpIcon size={20} className="mx-auto mb-1 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium">Maximum Return</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Highest expected return</p>
          </button>
        </div>
      </div>

      {/* Efficient Frontier Chart */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Click on the efficient frontier line to explore different portfolios
        </p>
      </div>

      {/* Optimal Portfolio Allocation */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          {selectedPoint ? 'Selected' : 'Optimal'} Portfolio Allocation
        </h4>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Expected Return</p>
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-500">
              {('return' in displayPortfolio ? displayPortfolio.return * 100 : ('expectedReturn' in displayPortfolio ? (displayPortfolio as EfficientFrontierPoint & { expectedReturn: number }).expectedReturn * 100 : 0)).toFixed(2)}%
            </p>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Risk (Volatility)</p>
            <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
              {('risk' in displayPortfolio ? displayPortfolio.risk * 100 : ('volatility' in displayPortfolio ? (displayPortfolio as EfficientFrontierPoint & { volatility: number }).volatility * 100 : 0)).toFixed(2)}%
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {displayPortfolio.sharpeRatio.toFixed(3)}
            </p>
          </div>
        </div>

        {/* Allocation Breakdown */}
        <div className="space-y-2">
          {assets.map((asset, index) => {
            const weight = displayPortfolio.weights[asset.symbol] || 0;
            const value = portfolioValue * weight;
            
            return (
              <div key={asset.symbol} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded" style={{
                    backgroundColor: `hsl(${index * 60}, 70%, 50%)`
                  }} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{asset.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{asset.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {(weight * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rebalancing Suggestions */}
      {rebalancingSuggestions.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-3 flex items-center gap-2">
            <RefreshCwIcon size={16} />
            Rebalancing Suggestions
          </h4>
          <div className="space-y-2">
            {rebalancingSuggestions.map(suggestion => (
              <div key={suggestion.symbol} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {assets.find(a => a.symbol === suggestion.symbol)?.name}
                </span>
                <span className={`font-medium ${
                  suggestion.action === 'buy' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {suggestion.action === 'buy' ? '+' : '-'}{formatCurrency(suggestion.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
        >
          <CalculatorIcon size={14} />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Risk-Free Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Risk-Free Rate (Treasury Rate)
              </label>
              <input
                type="number"
                value={(riskFreeRate * 100).toFixed(2)}
                onChange={(e) => setRiskFreeRate(Number(e.target.value) / 100)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                step="0.1"
                min="0"
                max="10"
              />
              <span className="ml-2 text-sm text-gray-500">%</span>
            </div>

            {/* Asset List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Asset Classes
                </label>
                <button
                  onClick={addAsset}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  <PlusIcon size={14} />
                  Add Asset
                </button>
              </div>
              
              <div className="space-y-2">
                {assets.map((asset, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={asset.symbol}
                      onChange={(e) => updateAsset(index, 'symbol', e.target.value)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Symbol"
                    />
                    <input
                      type="text"
                      value={asset.name}
                      onChange={(e) => updateAsset(index, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={(asset.expectedReturn * 100).toFixed(1)}
                      onChange={(e) => updateAsset(index, 'expectedReturn', e.target.value)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      step="0.1"
                      placeholder="Return %"
                    />
                    <input
                      type="number"
                      value={(asset.volatility * 100).toFixed(1)}
                      onChange={(e) => updateAsset(index, 'volatility', e.target.value)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      step="0.1"
                      placeholder="Risk %"
                    />
                    {assets.length > 2 && (
                      <button
                        onClick={() => removeAsset(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
        <div className="flex gap-2">
          <InfoIcon size={14} className="text-gray-600 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">About Modern Portfolio Theory:</p>
            <ul className="space-y-0.5">
              <li>• The efficient frontier shows the best possible risk-return combinations</li>
              <li>• Sharpe ratio measures risk-adjusted returns (higher is better)</li>
              <li>• Diversification can reduce risk without sacrificing returns</li>
              <li>• Past performance does not guarantee future results</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}