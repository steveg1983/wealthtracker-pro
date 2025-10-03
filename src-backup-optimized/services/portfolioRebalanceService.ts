/**
 * Portfolio Rebalance Service - Portfolio rebalancing and optimization
 *
 * Features:
 * - Asset allocation analysis
 * - Rebalancing recommendations
 * - Portfolio optimization
 * - Risk assessment
 * - Performance tracking
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('PortfolioRebalanceService');

export interface AssetAllocation {
  asset_class: string;
  symbol: string;
  name: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  drift: number;
  category: 'equity' | 'bond' | 'commodity' | 'real_estate' | 'cash' | 'crypto' | 'alternative';
}

export interface RebalanceRecommendation {
  id: string;
  asset_class: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  current_shares: number;
  target_shares: number;
  shares_to_trade: number;
  current_value: number;
  target_value: number;
  amount_to_trade: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface PortfolioMetrics {
  total_value: number;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  beta: number;
  alpha: number;
  correlation_matrix: Record<string, Record<string, number>>;
  diversification_ratio: number;
}

export interface RebalanceStrategy {
  name: string;
  description: string;
  frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'custom';
  drift_threshold: number; // Percentage drift to trigger rebalancing
  min_trade_amount: number;
  tax_optimization: boolean;
  consider_transaction_costs: boolean;
}

export interface RebalanceAnalysis {
  current_allocations: AssetAllocation[];
  recommendations: RebalanceRecommendation[];
  portfolio_metrics: PortfolioMetrics;
  rebalance_cost: number;
  expected_improvement: {
    risk_reduction: number;
    return_improvement: number;
    diversification_improvement: number;
  };
  summary: {
    total_trades: number;
    total_buy_amount: number;
    total_sell_amount: number;
    largest_drift: number;
    rebalance_urgency: 'low' | 'medium' | 'high' | 'critical';
  };
}

class PortfolioRebalanceService {
  private static instance: PortfolioRebalanceService;

  private constructor() {
    logger.info('PortfolioRebalanceService initialized');
  }

  public static getInstance(): PortfolioRebalanceService {
    if (!PortfolioRebalanceService.instance) {
      PortfolioRebalanceService.instance = new PortfolioRebalanceService();
    }
    return PortfolioRebalanceService.instance;
  }

  // Analyze current portfolio allocation
  public static async analyzePortfolio(
    portfolioId: string,
    targetAllocation: Record<string, number>
  ): Promise<RebalanceAnalysis> {
    logger.info('Analyzing portfolio for rebalancing', { portfolioId });

    try {
      // Mock portfolio data
      const currentAllocations: AssetAllocation[] = [
        {
          asset_class: 'US Stocks',
          symbol: 'VTI',
          name: 'Vanguard Total Stock Market ETF',
          current_value: 35000,
          current_percentage: 35,
          target_percentage: 40,
          drift: -5,
          category: 'equity'
        },
        {
          asset_class: 'International Stocks',
          symbol: 'VTIAX',
          name: 'Vanguard Total International Stock Index',
          current_value: 25000,
          current_percentage: 25,
          target_percentage: 20,
          drift: 5,
          category: 'equity'
        },
        {
          asset_class: 'Bonds',
          symbol: 'BND',
          name: 'Vanguard Total Bond Market ETF',
          current_value: 30000,
          current_percentage: 30,
          target_percentage: 30,
          drift: 0,
          category: 'bond'
        },
        {
          asset_class: 'REITs',
          symbol: 'VNQ',
          name: 'Vanguard Real Estate ETF',
          current_value: 10000,
          current_percentage: 10,
          target_percentage: 10,
          drift: 0,
          category: 'real_estate'
        }
      ];

      const recommendations = await this.generateRecommendations(currentAllocations);
      const portfolioMetrics = await this.calculatePortfolioMetrics(currentAllocations);
      const rebalanceCost = this.calculateRebalanceCost(recommendations);

      const analysis: RebalanceAnalysis = {
        current_allocations: currentAllocations,
        recommendations,
        portfolio_metrics: portfolioMetrics,
        rebalance_cost: rebalanceCost,
        expected_improvement: {
          risk_reduction: 0.15, // 15% reduction in portfolio volatility
          return_improvement: 0.08, // 8 basis points improvement in expected return
          diversification_improvement: 0.12 // 12% improvement in diversification ratio
        },
        summary: {
          total_trades: recommendations.length,
          total_buy_amount: recommendations.filter(r => r.action === 'buy').reduce((sum, r) => sum + r.amount_to_trade, 0),
          total_sell_amount: recommendations.filter(r => r.action === 'sell').reduce((sum, r) => sum + Math.abs(r.amount_to_trade), 0),
          largest_drift: Math.max(...currentAllocations.map(a => Math.abs(a.drift))),
          rebalance_urgency: this.calculateRebalanceUrgency(currentAllocations)
        }
      };

      return analysis;
    } catch (error) {
      logger.error('Error analyzing portfolio:', error);
      throw error;
    }
  }

  // Generate rebalancing recommendations
  private static async generateRecommendations(
    allocations: AssetAllocation[]
  ): Promise<RebalanceRecommendation[]> {
    const recommendations: RebalanceRecommendation[] = [];

    allocations.forEach((allocation, index) => {
      const driftThreshold = 3; // 3% drift threshold

      if (Math.abs(allocation.drift) > driftThreshold) {
        const totalValue = allocations.reduce((sum, a) => sum + a.current_value, 0);
        const targetValue = totalValue * (allocation.target_percentage / 100);
        const amountToTrade = targetValue - allocation.current_value;

        recommendations.push({
          id: `rebalance-${index + 1}`,
          asset_class: allocation.asset_class,
          symbol: allocation.symbol,
          action: amountToTrade > 0 ? 'buy' : 'sell',
          current_shares: Math.round(allocation.current_value / 100), // Mock price of $100 per share
          target_shares: Math.round(targetValue / 100),
          shares_to_trade: Math.abs(Math.round(amountToTrade / 100)),
          current_value: allocation.current_value,
          target_value: targetValue,
          amount_to_trade: amountToTrade,
          priority: Math.abs(allocation.drift) > 7 ? 'high' : Math.abs(allocation.drift) > 5 ? 'medium' : 'low',
          reason: amountToTrade > 0
            ? `Underweight by ${Math.abs(allocation.drift).toFixed(1)}% - need to buy ${Math.abs(amountToTrade).toFixed(0)}`
            : `Overweight by ${Math.abs(allocation.drift).toFixed(1)}% - need to sell ${Math.abs(amountToTrade).toFixed(0)}`
        });
      }
    });

    return recommendations;
  }

  // Calculate portfolio metrics
  private static async calculatePortfolioMetrics(
    allocations: AssetAllocation[]
  ): Promise<PortfolioMetrics> {
    // Mock portfolio metrics calculation
    return {
      total_value: allocations.reduce((sum, a) => sum + a.current_value, 0),
      expected_return: 0.078, // 7.8% expected annual return
      volatility: 0.142, // 14.2% annual volatility
      sharpe_ratio: 0.55,
      max_drawdown: -0.186, // -18.6% maximum historical drawdown
      beta: 0.98,
      alpha: 0.012, // 120 basis points of alpha
      correlation_matrix: {
        'US Stocks': { 'US Stocks': 1.0, 'International Stocks': 0.72, 'Bonds': -0.15, 'REITs': 0.68 },
        'International Stocks': { 'US Stocks': 0.72, 'International Stocks': 1.0, 'Bonds': -0.08, 'REITs': 0.54 },
        'Bonds': { 'US Stocks': -0.15, 'International Stocks': -0.08, 'Bonds': 1.0, 'REITs': 0.12 },
        'REITs': { 'US Stocks': 0.68, 'International Stocks': 0.54, 'Bonds': 0.12, 'REITs': 1.0 }
      },
      diversification_ratio: 0.847
    };
  }

  // Calculate rebalancing cost
  private static calculateRebalanceCost(recommendations: RebalanceRecommendation[]): number {
    const tradingFeePerTrade = 0; // Assuming commission-free trading
    const bidAskSpread = 0.001; // 10 basis points spread cost

    const totalTradeValue = recommendations.reduce((sum, rec) =>
      sum + Math.abs(rec.amount_to_trade), 0
    );

    return totalTradeValue * bidAskSpread;
  }

  // Calculate rebalance urgency
  private static calculateRebalanceUrgency(
    allocations: AssetAllocation[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const maxDrift = Math.max(...allocations.map(a => Math.abs(a.drift)));

    if (maxDrift >= 10) return 'critical';
    if (maxDrift >= 7) return 'high';
    if (maxDrift >= 4) return 'medium';
    return 'low';
  }

  // Execute rebalancing
  public static async executeRebalance(
    portfolioId: string,
    recommendations: RebalanceRecommendation[]
  ): Promise<{ success: boolean; executed_trades: number; total_amount: number }> {
    logger.info('Executing portfolio rebalance', {
      portfolioId,
      tradeCount: recommendations.length
    });

    try {
      // Mock trade execution
      let executedTrades = 0;
      let totalAmount = 0;

      for (const recommendation of recommendations) {
        // Simulate trade execution
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock success rate of 95%
        if (Math.random() > 0.05) {
          executedTrades++;
          totalAmount += Math.abs(recommendation.amount_to_trade);

          logger.debug('Trade executed', {
            symbol: recommendation.symbol,
            action: recommendation.action,
            amount: recommendation.amount_to_trade
          });
        }
      }

      const result = {
        success: executedTrades === recommendations.length,
        executed_trades: executedTrades,
        total_amount: totalAmount
      };

      logger.info('Rebalance execution completed', result);
      return result;
    } catch (error) {
      logger.error('Error executing rebalance:', error);
      throw error;
    }
  }

  // Get rebalancing history
  public static async getRebalanceHistory(
    portfolioId: string,
    limit = 10
  ): Promise<Array<{
    id: string;
    date: string;
    trigger: string;
    trades_executed: number;
    total_amount: number;
    cost: number;
    performance_impact: number;
  }>> {
    logger.info('Getting rebalance history', { portfolioId, limit });

    // Mock rebalance history
    return [
      {
        id: 'rebalance-2024-01',
        date: '2024-01-15T10:30:00Z',
        trigger: 'Quarterly rebalance',
        trades_executed: 3,
        total_amount: 8500,
        cost: 8.50,
        performance_impact: 0.12
      },
      {
        id: 'rebalance-2023-10',
        date: '2023-10-15T14:20:00Z',
        trigger: 'Drift threshold exceeded',
        trades_executed: 2,
        total_amount: 5200,
        cost: 5.20,
        performance_impact: 0.08
      }
    ];
  }

  // Optimize portfolio allocation using Modern Portfolio Theory
  public static async optimizeAllocation(
    assets: string[],
    constraints?: {
      min_weights?: Record<string, number>;
      max_weights?: Record<string, number>;
      risk_tolerance?: 'conservative' | 'moderate' | 'aggressive';
    }
  ): Promise<Record<string, number>> {
    logger.info('Optimizing portfolio allocation', { assets, constraints });

    try {
      // Mock optimization using simplified approach
      const baseAllocation: Record<string, number> = {};

      // Default allocations based on risk tolerance
      const riskProfiles = {
        conservative: { equity: 0.4, bond: 0.5, alternatives: 0.1 },
        moderate: { equity: 0.6, bond: 0.3, alternatives: 0.1 },
        aggressive: { equity: 0.8, bond: 0.1, alternatives: 0.1 }
      };

      const profile = riskProfiles[constraints?.risk_tolerance || 'moderate'];

      // Simple allocation based on asset categories
      assets.forEach((asset, index) => {
        if (asset.includes('Stock') || asset.includes('Equity')) {
          baseAllocation[asset] = profile.equity / assets.filter(a => a.includes('Stock') || a.includes('Equity')).length;
        } else if (asset.includes('Bond')) {
          baseAllocation[asset] = profile.bond / assets.filter(a => a.includes('Bond')).length;
        } else {
          baseAllocation[asset] = profile.alternatives / assets.filter(a => !a.includes('Stock') && !a.includes('Bond')).length;
        }
      });

      // Apply constraints
      if (constraints?.min_weights) {
        Object.keys(constraints.min_weights).forEach(asset => {
          if (baseAllocation[asset] < constraints.min_weights![asset]) {
            baseAllocation[asset] = constraints.min_weights![asset];
          }
        });
      }

      if (constraints?.max_weights) {
        Object.keys(constraints.max_weights).forEach(asset => {
          if (baseAllocation[asset] > constraints.max_weights![asset]) {
            baseAllocation[asset] = constraints.max_weights![asset];
          }
        });
      }

      // Normalize to ensure sum equals 1
      const total = Object.values(baseAllocation).reduce((sum, weight) => sum + weight, 0);
      Object.keys(baseAllocation).forEach(asset => {
        baseAllocation[asset] = baseAllocation[asset] / total;
      });

      logger.info('Portfolio optimization completed', { optimizedAllocation: baseAllocation });
      return baseAllocation;
    } catch (error) {
      logger.error('Error optimizing portfolio allocation:', error);
      throw error;
    }
  }

  // Calculate portfolio performance attribution
  public static async calculatePerformanceAttribution(
    portfolioId: string,
    benchmark: string,
    period: 'month' | 'quarter' | 'year'
  ): Promise<{
    total_return: number;
    benchmark_return: number;
    alpha: number;
    asset_allocation_effect: Record<string, number>;
    security_selection_effect: Record<string, number>;
  }> {
    logger.info('Calculating performance attribution', { portfolioId, benchmark, period });

    // Mock performance attribution
    return {
      total_return: 0.084, // 8.4% portfolio return
      benchmark_return: 0.076, // 7.6% benchmark return
      alpha: 0.008, // 80 basis points of alpha
      asset_allocation_effect: {
        'US Stocks': 0.002, // 20 basis points from allocation
        'International Stocks': -0.001,
        'Bonds': 0.001,
        'REITs': 0.000
      },
      security_selection_effect: {
        'US Stocks': 0.003, // 30 basis points from security selection
        'International Stocks': 0.001,
        'Bonds': 0.001,
        'REITs': 0.001
      }
    };
  }
}

export const portfolioRebalanceService = new PortfolioRebalanceService();
export default PortfolioRebalanceService;