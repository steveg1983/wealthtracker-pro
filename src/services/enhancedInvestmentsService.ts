import { investmentEnhancementService } from './investmentEnhancementService';
import type { 
  RebalancingSuggestion, 
  RiskMetrics, 
  DividendInfo, 
  ESGScore, 
  BenchmarkComparison 
} from './investmentEnhancementService';
import type { Investment, Transaction } from '../types';

export type TabId = 
  | 'allocation-analysis' 
  | 'portfolio-rebalancer' 
  | 'dividend-tracker' 
  | 'rebalancing' 
  | 'risk' 
  | 'benchmarks' 
  | 'esg';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

export interface InvestmentMetrics {
  rebalancingSuggestions: RebalancingSuggestion[];
  riskMetrics: RiskMetrics | null;
  dividendInfo: DividendInfo[];
  esgScores: ESGScore[];
  benchmarkData: BenchmarkComparison | null;
  insights: string[];
}

class EnhancedInvestmentsService {
  calculateAllMetrics(
    investments: Investment[], 
    transactions: Transaction[]
  ): InvestmentMetrics {
    if (!investments || investments.length === 0) {
      return {
        rebalancingSuggestions: [],
        riskMetrics: null,
        dividendInfo: [],
        esgScores: [],
        benchmarkData: null,
        insights: []
      };
    }

    return {
      rebalancingSuggestions: investmentEnhancementService.getRebalancingSuggestions(investments),
      riskMetrics: investmentEnhancementService.calculateRiskMetrics(investments),
      dividendInfo: investmentEnhancementService.trackDividends(investments, transactions),
      esgScores: investmentEnhancementService.getESGScores(investments),
      benchmarkData: investmentEnhancementService.compareWithBenchmarks(investments),
      insights: investmentEnhancementService.generateInsights(investments, transactions)
    };
  }

  getTabs(): TabConfig[] {
    return [
      { id: 'allocation-analysis', label: 'Allocation Analysis', icon: 'PieChartIcon' },
      { id: 'portfolio-rebalancer', label: 'Portfolio Rebalancer', icon: 'TargetIcon' },
      { id: 'dividend-tracker', label: 'Dividend Tracker', icon: 'DollarSignIcon' },
      { id: 'rebalancing', label: 'Quick Suggestions', icon: 'RefreshCwIcon' },
      { id: 'risk', label: 'Risk Analysis', icon: 'ShieldIcon' },
      { id: 'benchmarks', label: 'Benchmarks', icon: 'BarChart3Icon' },
      { id: 'esg', label: 'ESG Scores', icon: 'LeafIcon' }
    ];
  }

  getTabButtonClass(isActive: boolean): string {
    return isActive
      ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
  }

  getRiskLevelClass(risk: 'high' | 'medium' | 'low'): string {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
  }

  getActionClass(action: 'buy' | 'sell'): string {
    return action === 'buy'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }

  getESGRatingClass(rating: string): string {
    if (rating === 'AAA' || rating === 'AA') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    } else if (rating === 'A' || rating === 'BBB') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    } else {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
  }

  getReturnColorClass(value: number): string {
    return value >= 0 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400';
  }
}

export const enhancedInvestmentsService = new EnhancedInvestmentsService();