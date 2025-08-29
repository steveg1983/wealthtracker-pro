import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { investmentEnhancementService } from '../services/investmentEnhancementService';
import { 
  TrendingUpIcon, 
  TargetIcon, 
  ShieldIcon,
  DollarSignIcon,
  BarChart3Icon,
  LeafIcon,
  RefreshCwIcon,
  InfoIcon,
  PieChartIcon
} from '../components/icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import type { RebalancingSuggestion, RiskMetrics, DividendInfo, ESGScore, BenchmarkComparison } from '../services/investmentEnhancementService';
import DividendTracker from '../components/DividendTracker';
import PortfolioRebalancer from '../components/PortfolioRebalancer';
import AllocationAnalysis from '../components/AllocationAnalysis';
import PageWrapper from '../components/PageWrapper';

export default function EnhancedInvestments() {
  const { accounts, investments = [], transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [activeTab, setActiveTab] = useState('allocation-analysis');
  const [rebalancingSuggestions, setRebalancingSuggestions] = useState<RebalancingSuggestion[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [dividendInfo, setDividendInfo] = useState<DividendInfo[]>([]);
  const [esgScores, setEsgScores] = useState<ESGScore[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkComparison | null>(null);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    if (investments && investments.length > 0) {
      // Calculate all metrics
      setRebalancingSuggestions(investmentEnhancementService.getRebalancingSuggestions(investments));
      setRiskMetrics(investmentEnhancementService.calculateRiskMetrics(investments));
      setDividendInfo(investmentEnhancementService.trackDividends(investments, transactions));
      setEsgScores(investmentEnhancementService.getESGScores(investments));
      setBenchmarkData(investmentEnhancementService.compareWithBenchmarks(investments));
      setInsights(investmentEnhancementService.generateInsights(investments, transactions));
    }
  }, [investments, transactions]);

  const renderRebalancing = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Portfolio Rebalancing</h3>
        <p className="text-sm text-blue-700 dark:text-blue-200">
          Keep your portfolio aligned with your target asset allocation.
        </p>
      </div>

      {rebalancingSuggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <TargetIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>Your portfolio is well-balanced!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rebalancingSuggestions.map((suggestion, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      suggestion.action === 'buy' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {suggestion.action.toUpperCase()}
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {suggestion.name}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {suggestion.reason}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      Amount: <strong>{formatCurrency(suggestion.amount)}</strong>
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      Shares: <strong>{suggestion.shares}</strong>
                    </span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 text-sm">
                  Execute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRiskAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Risk Analysis</h3>
        <p className="text-sm text-purple-700 dark:text-purple-200">
          Understanding your portfolio's risk profile and diversification.
        </p>
      </div>

      {riskMetrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Portfolio Beta</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskMetrics.portfolioBeta.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {riskMetrics.portfolioBeta > 1 ? 'More volatile than market' : 'Less volatile than market'}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sharpe Ratio</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskMetrics.sharpeRatio.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Risk-adjusted returns
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Volatility</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskMetrics.standardDeviation.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Annual standard deviation
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Diversification Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskMetrics.diversificationScore}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${riskMetrics.diversificationScore}%` }}
                />
              </div>
            </div>
          </div>

          {riskMetrics.concentrationRisk.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Concentration Risk</h4>
              <div className="space-y-2">
                {riskMetrics.concentrationRisk.map((risk, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{risk.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">{risk.percent.toFixed(1)}%</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        risk.risk === 'high' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : risk.risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {risk.risk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderDividends = () => (
    <div className="space-y-6">
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Dividend Tracking</h3>
        <p className="text-sm text-green-700 dark:text-green-200">
          Monitor dividend income and reinvestment opportunities.
        </p>
      </div>

      {dividendInfo.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <DollarSignIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No dividend-paying investments found</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Annual Dividends</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(
                    dividendInfo.reduce((sum, d) => sum.plus(d.projectedAnnual), toDecimal(0))
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Average Yield</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(dividendInfo.reduce((sum, d) => sum + d.yield, 0) / dividendInfo.length).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">YTD Received</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(
                    dividendInfo.reduce((sum, d) => sum.plus(d.totalReceived), toDecimal(0))
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {dividendInfo.map((dividend, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{dividend.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{dividend.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {dividend.yield.toFixed(2)}% yield
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {dividend.frequency}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Annual: </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(dividend.annualDividend)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Next Ex-Date: </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {dividend.exDividendDate?.toLocaleDateString() || 'TBD'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderBenchmarks = () => (
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
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
                <p className={`text-2xl font-bold ${
                  benchmarkData.portfolio.return >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {benchmarkData.portfolio.return >= 0 ? '+' : ''}{benchmarkData.portfolio.return.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Annualized</p>
                <p className={`text-2xl font-bold ${
                  benchmarkData.portfolio.annualizedReturn >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {benchmarkData.portfolio.annualizedReturn >= 0 ? '+' : ''}{benchmarkData.portfolio.annualizedReturn.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(benchmarkData.portfolio.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Start Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(benchmarkData.portfolio.startValue)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {benchmarkData.benchmarks.map((benchmark, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{benchmark.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{benchmark.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {benchmark.annualizedReturn.toFixed(2)}%
                    </p>
                    <p className={`text-sm font-medium ${
                      benchmark.outperformance >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {benchmark.outperformance >= 0 ? 'Outperforming' : 'Underperforming'} by {Math.abs(benchmark.outperformance).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderESG = () => (
    <div className="space-y-6">
      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">ESG Scoring</h3>
        <p className="text-sm text-teal-700 dark:text-teal-200">
          Environmental, Social, and Governance ratings for your investments.
        </p>
      </div>

      {esgScores.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <LeafIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No ESG data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {esgScores.map((score, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{score.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{score.symbol}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                  score.rating === 'AAA' || score.rating === 'AA' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : score.rating === 'A' || score.rating === 'BBB'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {score.rating}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Environmental</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${score.environmental}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {score.environmental}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Social</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${score.social}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {score.social}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Governance</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full" 
                        style={{ width: `${score.governance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {score.governance}
                    </span>
                  </div>
                </div>
              </div>
              
              {score.controversies.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    ⚠️ {score.controversies.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'allocation-analysis', label: 'Allocation Analysis', icon: PieChartIcon },
    { id: 'portfolio-rebalancer', label: 'Portfolio Rebalancer', icon: TargetIcon },
    { id: 'dividend-tracker', label: 'Dividend Tracker', icon: DollarSignIcon },
    { id: 'rebalancing', label: 'Quick Suggestions', icon: RefreshCwIcon },
    { id: 'risk', label: 'Risk Analysis', icon: ShieldIcon },
    { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3Icon },
    { id: 'esg', label: 'ESG Scores', icon: LeafIcon }
  ];

  return (
    <PageWrapper title="Investment Analytics">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Enhanced Investment Analytics</h1>
            <p className="text-purple-100">
              Advanced tools for portfolio optimization and analysis
            </p>
          </div>
          <TrendingUpIcon size={48} className="text-white/80" />
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <InfoIcon size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-2">
              {insights.map((insight, index) => (
                <p key={index} className="text-sm text-blue-800 dark:text-blue-200">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
        {activeTab === 'allocation-analysis' && <AllocationAnalysis />}
        {activeTab === 'portfolio-rebalancer' && <PortfolioRebalancer />}
        {activeTab === 'dividend-tracker' && <DividendTracker />}
        {activeTab === 'rebalancing' && renderRebalancing()}
        {activeTab === 'risk' && renderRiskAnalysis()}
        {activeTab === 'benchmarks' && renderBenchmarks()}
        {activeTab === 'esg' && renderESG()}
      </div>
    </div>
    </PageWrapper>
  );
}