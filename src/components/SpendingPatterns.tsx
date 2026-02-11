import React, { useState, useEffect } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import type { SpendingPattern } from '../services/dataIntelligenceService';
import { 
  TrendingUpIcon,
  BarChart3Icon,
  CalendarIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  EyeIcon,
  FilterIcon,
  CheckCircleIcon,
  ClockIcon,
  LineChartIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';

interface SpendingPatternsProps {
  onDataChange?: () => void;
}

export default function SpendingPatterns({ onDataChange }: SpendingPatternsProps) {
  const [patterns, setPatterns] = useState<SpendingPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<PatternFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'amount' | 'detectedAt' | 'frequency'>('confidence');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { formatCurrency } = useCurrencyDecimal();

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = () => {
    setIsLoading(true);
    try {
      const loadedPatterns = dataIntelligenceService.getSpendingPatterns();
      setPatterns(loadedPatterns);
    } catch (error) {
      console.error('Error loading spending patterns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzePatterns = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate analysis process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would analyze actual transactions
      // For now, we'll just refresh the patterns
      loadPatterns();
      onDataChange?.();
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPatternTypeIcon = (type: SpendingPattern['patternType']) => {
    switch (type) {
      case 'recurring':
        return <CalendarIcon size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'seasonal':
        return <ClockIcon size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'trend':
        return <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'anomaly':
        return <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return <BarChart3Icon size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getPatternTypeColor = (type: SpendingPattern['patternType']) => {
    switch (type) {
      case 'recurring':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'seasonal':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'trend':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'anomaly':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const patternTypes = ['all', 'recurring', 'seasonal', 'trend', 'anomaly'] as const;
  type PatternFilter = typeof patternTypes[number];
  const patternTypeOptions: SpendingPattern['patternType'][] = ['recurring', 'seasonal', 'trend', 'anomaly'];
  const categories = ['all', ...Array.from(new Set(patterns.map(p => p.category)))];

  const filteredPatterns = patterns
    .filter(pattern => {
      const matchesType = selectedType === 'all' || pattern.patternType === selectedType;
      const matchesCategory = selectedCategory === 'all' || pattern.category === selectedCategory;
      return matchesType && matchesCategory && pattern.isActive;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'amount':
          return b.amount - a.amount;
        case 'detectedAt':
          return b.detectedAt.getTime() - a.detectedAt.getTime();
        case 'frequency':
          return a.frequency.localeCompare(b.frequency);
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCwIcon size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUpIcon size={20} className="text-purple-600 dark:text-purple-400" />
            Spending Patterns
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Discover recurring spending patterns and trends in your financial behavior
          </p>
        </div>
        <button
          onClick={handleAnalyzePatterns}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          <RefreshCwIcon size={16} className={isAnalyzing ? 'animate-spin' : ''} />
          {isAnalyzing ? 'Analyzing...' : 'Analyze Patterns'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Patterns</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {patterns.filter(p => p.isActive).length}
              </p>
            </div>
            <BarChart3Icon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recurring</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {patterns.filter(p => p.patternType === 'recurring' && p.isActive).length}
              </p>
            </div>
            <CalendarIcon size={24} className="text-green-500" />
          </div>
        </div>

        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">High Confidence</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {patterns.filter(p => p.confidence >= 0.8 && p.isActive).length}
              </p>
            </div>
            <CheckCircleIcon size={24} className="text-purple-500" />
          </div>
        </div>

        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Anomalies</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {patterns.filter(p => p.patternType === 'anomaly' && p.isActive).length}
              </p>
            </div>
            <AlertCircleIcon size={24} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Pattern Type Distribution */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-6 shadow-sm">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <LineChartIcon size={18} />
          Pattern Distribution
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {patternTypeOptions.map(type => {
            const count = patterns.filter(p => p.patternType === type && p.isActive).length;
            const percentage = patterns.length > 0 ? (count / patterns.filter(p => p.isActive).length) * 100 : 0;
            
            return (
              <div key={type} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {getPatternTypeIcon(type)}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDecimal(percentage, 1)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <FilterIcon size={16} className="text-gray-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as PatternFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-card-bg-light dark:bg-card-bg-dark text-gray-900 dark:text-white text-sm"
          >
            {patternTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-card-bg-light dark:bg-card-bg-dark text-gray-900 dark:text-white text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as 'confidence' | 'amount' | 'detectedAt' | 'frequency'
              )
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-card-bg-light dark:bg-card-bg-dark text-gray-900 dark:text-white text-sm"
          >
            <option value="confidence">Confidence</option>
            <option value="amount">Amount</option>
            <option value="detectedAt">Detected Date</option>
            <option value="frequency">Frequency</option>
          </select>
        </div>
      </div>

      {/* Patterns List */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm overflow-hidden">
        {filteredPatterns.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUpIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No spending patterns found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Try analyzing your transactions to discover patterns
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pattern
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Detected
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card-bg-light dark:bg-card-bg-dark divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPatterns.map((pattern) => (
                  <tr key={pattern.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {pattern.description}
                        </div>
                        {pattern.merchant && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {pattern.merchant}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPatternTypeColor(pattern.patternType)}`}>
                        {getPatternTypeIcon(pattern.patternType)}
                        {pattern.patternType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">
                        {pattern.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white capitalize">
                        {pattern.frequency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">
                        {formatCurrency(toDecimal(pattern.amount))}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ±{formatCurrency(toDecimal(pattern.variance))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBadge(pattern.confidence)}`}>
                        <CheckCircleIcon size={12} />
                        {formatDecimal(pattern.confidence * 100, 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(pattern.detectedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300">
                        <EyeIcon size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
