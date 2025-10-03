import Decimal from 'decimal.js';

export interface Asset {
  symbol: string;
  name: string;
  expectedReturn: number;
  volatility: number;
  currentAllocation?: number;
}

export interface AssetCorrelation {
  asset1: string;
  asset2: string;
  correlation: number;
}

export interface PortfolioStats {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  weights: Record<string, number>;
}

export interface EfficientFrontierPoint {
  return: number;
  risk: number;
  weights: Record<string, number>;
  sharpeRatio: number;
}

export interface OptimizationConstraints {
  minWeight?: number;
  maxWeight?: number;
  targetReturn?: number;
  maxRisk?: number;
  riskFreeRate?: number;
}

class PortfolioOptimizationService {
  private readonly DEFAULT_RISK_FREE_RATE = 0.04; // 4% treasury rate

  /**
   * Calculate portfolio statistics given weights
   */
  calculatePortfolioStats(
    assets: Asset[],
    weights: number[],
    correlationMatrix: number[][],
    riskFreeRate: number = this.DEFAULT_RISK_FREE_RATE
  ): PortfolioStats {
    if (assets.length !== weights.length) {
      throw new Error('Assets and weights arrays must have the same length');
    }

    // Calculate expected return (weighted average)
    const expectedReturn = assets.reduce((sum, asset, i) => {
      return sum + asset.expectedReturn * weights[i];
    }, 0);

    // Calculate portfolio variance
    let variance = 0;
    for (let i = 0; i < assets.length; i++) {
      for (let j = 0; j < assets.length; j++) {
        variance += weights[i] * weights[j] * 
                    assets[i].volatility * assets[j].volatility * 
                    correlationMatrix[i][j];
      }
    }

    const volatility = Math.sqrt(variance);
    const sharpeRatio = (expectedReturn - riskFreeRate) / volatility;

    // Create weights object
    const weightsObj: Record<string, number> = {};
    assets.forEach((asset, i) => {
      weightsObj[asset.symbol] = weights[i];
    });

    return {
      expectedReturn,
      volatility,
      sharpeRatio,
      weights: weightsObj
    };
  }

  /**
   * Find the optimal portfolio that maximizes Sharpe ratio
   */
  findOptimalPortfolio(
    assets: Asset[],
    correlationMatrix: number[][],
    constraints: OptimizationConstraints = {}
  ): PortfolioStats {
    const {
      minWeight = 0,
      maxWeight = 1,
      riskFreeRate = this.DEFAULT_RISK_FREE_RATE
    } = constraints;

    // Use gradient descent to find optimal weights
    const n = assets.length;
    let weights = new Array(n).fill(1 / n); // Start with equal weights
    let bestSharpe = -Infinity;
    let bestWeights = [...weights];
    
    const learningRate = 0.01;
    const iterations = 1000;
    const epsilon = 0.0001;

    for (let iter = 0; iter < iterations; iter++) {
      // Calculate current portfolio stats
      const currentStats = this.calculatePortfolioStats(
        assets,
        weights,
        correlationMatrix,
        riskFreeRate
      );

      if (currentStats.sharpeRatio > bestSharpe) {
        bestSharpe = currentStats.sharpeRatio;
        bestWeights = [...weights];
      }

      // Calculate gradient for each weight
      const gradients = new Array(n).fill(0);
      
      for (let i = 0; i < n; i++) {
        // Approximate gradient using finite differences
        const delta = epsilon;
        const weightsPlus = [...weights];
        weightsPlus[i] += delta;
        
        // Normalize weights to sum to 1
        const sumPlus = weightsPlus.reduce((a, b) => a + b, 0);
        const normalizedWeightsPlus = weightsPlus.map(w => w / sumPlus);
        
        const statsPlus = this.calculatePortfolioStats(
          assets,
          normalizedWeightsPlus,
          correlationMatrix,
          riskFreeRate
        );
        
        gradients[i] = (statsPlus.sharpeRatio - currentStats.sharpeRatio) / delta;
      }

      // Update weights using gradient ascent
      for (let i = 0; i < n; i++) {
        weights[i] += learningRate * gradients[i];
        
        // Apply constraints
        weights[i] = Math.max(minWeight, Math.min(maxWeight, weights[i]));
      }

      // Normalize weights to sum to 1
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
    }

    return this.calculatePortfolioStats(
      assets,
      bestWeights,
      correlationMatrix,
      riskFreeRate
    );
  }

  /**
   * Generate efficient frontier points
   */
  generateEfficientFrontier(
    assets: Asset[],
    correlationMatrix: number[][],
    numPoints: number = 50,
    constraints: OptimizationConstraints = {}
  ): EfficientFrontierPoint[] {
    const points: EfficientFrontierPoint[] = [];
    
    // Find min and max possible returns
    const minReturn = Math.min(...assets.map(a => a.expectedReturn));
    const maxReturn = Math.max(...assets.map(a => a.expectedReturn));
    
    // Generate points along the return spectrum
    for (let i = 0; i < numPoints; i++) {
      const targetReturn = minReturn + (maxReturn - minReturn) * (i / (numPoints - 1));
      
      // Find minimum variance portfolio for this target return
      const portfolio = this.findMinVariancePortfolio(
        assets,
        correlationMatrix,
        targetReturn,
        constraints
      );
      
      points.push({
        return: portfolio.expectedReturn,
        risk: portfolio.volatility,
        weights: portfolio.weights,
        sharpeRatio: portfolio.sharpeRatio
      });
    }

    // Sort by risk
    points.sort((a, b) => a.risk - b.risk);
    
    // Remove dominated portfolios (higher risk for same or lower return)
    const efficientPoints: EfficientFrontierPoint[] = [];
    let maxReturnSoFar = -Infinity;
    
    for (const point of points) {
      if (point.return > maxReturnSoFar) {
        efficientPoints.push(point);
        maxReturnSoFar = point.return;
      }
    }

    return efficientPoints;
  }

  /**
   * Find minimum variance portfolio for a target return
   */
  private findMinVariancePortfolio(
    assets: Asset[],
    correlationMatrix: number[][],
    targetReturn: number,
    constraints: OptimizationConstraints = {}
  ): PortfolioStats {
    const {
      minWeight = 0,
      maxWeight = 1,
      riskFreeRate = this.DEFAULT_RISK_FREE_RATE
    } = constraints;

    const n = assets.length;
    let weights = new Array(n).fill(1 / n);
    let bestVariance = Infinity;
    let bestWeights = [...weights];
    
    const learningRate = 0.01;
    const iterations = 500;
    const returnPenalty = 100; // Penalty for deviating from target return

    for (let iter = 0; iter < iterations; iter++) {
      const currentStats = this.calculatePortfolioStats(
        assets,
        weights,
        correlationMatrix,
        riskFreeRate
      );

      // Objective: minimize variance + penalty for return deviation
      const returnDeviation = Math.abs(currentStats.expectedReturn - targetReturn);
      const objective = currentStats.volatility * currentStats.volatility + 
                       returnPenalty * returnDeviation * returnDeviation;

      if (objective < bestVariance) {
        bestVariance = objective;
        bestWeights = [...weights];
      }

      // Gradient descent step
      const gradients = new Array(n).fill(0);
      const delta = 0.0001;
      
      for (let i = 0; i < n; i++) {
        const weightsPlus = [...weights];
        weightsPlus[i] += delta;
        
        const sumPlus = weightsPlus.reduce((a, b) => a + b, 0);
        const normalizedWeightsPlus = weightsPlus.map(w => w / sumPlus);
        
        const statsPlus = this.calculatePortfolioStats(
          assets,
          normalizedWeightsPlus,
          correlationMatrix,
          riskFreeRate
        );
        
        const returnDeviationPlus = Math.abs(statsPlus.expectedReturn - targetReturn);
        const objectivePlus = statsPlus.volatility * statsPlus.volatility + 
                             returnPenalty * returnDeviationPlus * returnDeviationPlus;
        
        gradients[i] = (objectivePlus - objective) / delta;
      }

      // Update weights
      for (let i = 0; i < n; i++) {
        weights[i] -= learningRate * gradients[i];
        weights[i] = Math.max(minWeight, Math.min(maxWeight, weights[i]));
      }

      // Normalize
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
    }

    return this.calculatePortfolioStats(
      assets,
      bestWeights,
      correlationMatrix,
      riskFreeRate
    );
  }

  /**
   * Calculate correlation matrix from historical returns
   */
  calculateCorrelationMatrix(
    historicalReturns: Record<string, number[]>
  ): { matrix: number[][], assets: string[] } {
    const assets = Object.keys(historicalReturns);
    const n = assets.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const correlation = this.calculateCorrelation(
            historicalReturns[assets[i]],
            historicalReturns[assets[j]]
          );
          matrix[i][j] = correlation;
          matrix[j][i] = correlation;
        }
      }
    }

    return { matrix, assets };
  }

  /**
   * Calculate correlation between two return series
   */
  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) {
      return 0;
    }

    const n = returns1.length;
    const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / n;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    if (variance1 === 0 || variance2 === 0) {
      return 0;
    }

    return covariance / Math.sqrt(variance1 * variance2);
  }

  /**
   * Suggest portfolio rebalancing actions
   */
  suggestRebalancing(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    portfolioValue: number,
    threshold: number = 0.05 // 5% deviation threshold
  ): Array<{ symbol: string; action: 'buy' | 'sell'; amount: number; shares?: number }> {
    const actions: Array<{ symbol: string; action: 'buy' | 'sell'; amount: number; shares?: number }> = [];

    for (const symbol in targetWeights) {
      const currentWeight = currentWeights[symbol] || 0;
      const targetWeight = targetWeights[symbol];
      const deviation = Math.abs(targetWeight - currentWeight);

      if (deviation > threshold) {
        const currentValue = portfolioValue * currentWeight;
        const targetValue = portfolioValue * targetWeight;
        const difference = targetValue - currentValue;

        actions.push({
          symbol,
          action: difference > 0 ? 'buy' : 'sell',
          amount: Math.abs(difference)
        });
      }
    }

    // Sort by absolute amount (largest rebalancing needs first)
    actions.sort((a, b) => b.amount - a.amount);

    return actions;
  }

  /**
   * Calculate risk metrics for a portfolio
   */
  calculateRiskMetrics(
    portfolioReturns: number[],
    benchmarkReturns?: number[]
  ): {
    annualizedReturn: number;
    annualizedVolatility: number;
    maxDrawdown: number;
    calmarRatio: number;
    sortinoRatio: number;
    beta?: number;
    alpha?: number;
    trackingError?: number;
  } {
    const n = portfolioReturns.length;
    if (n === 0) {
      throw new Error('Portfolio returns array is empty');
    }

    // Annualized return (assuming daily returns)
    const totalReturn = portfolioReturns.reduce((a, b) => a + b, 0);
    const avgDailyReturn = totalReturn / n;
    const annualizedReturn = avgDailyReturn * 252; // 252 trading days

    // Annualized volatility
    const variance = portfolioReturns.reduce((sum, r) => {
      const diff = r - avgDailyReturn;
      return sum + diff * diff;
    }, 0) / n;
    const annualizedVolatility = Math.sqrt(variance * 252);

    // Maximum drawdown
    let peak = 1;
    let maxDrawdown = 0;
    let cumulativeReturn = 1;

    for (const r of portfolioReturns) {
      cumulativeReturn *= (1 + r);
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - cumulativeReturn) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Calmar ratio (return / max drawdown)
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Sortino ratio (uses downside deviation)
    const downsideReturns = portfolioReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance * 252);
    const sortinoRatio = downsideDeviation > 0 ? annualizedReturn / downsideDeviation : 0;

    const result: any = {
      annualizedReturn,
      annualizedVolatility,
      maxDrawdown,
      calmarRatio,
      sortinoRatio
    };

    // Calculate beta, alpha, and tracking error if benchmark is provided
    if (benchmarkReturns && benchmarkReturns.length === n) {
      const benchmarkMean = benchmarkReturns.reduce((a, b) => a + b, 0) / n;
      
      // Beta (covariance / benchmark variance)
      let covariance = 0;
      let benchmarkVariance = 0;
      
      for (let i = 0; i < n; i++) {
        const portfolioDiff = portfolioReturns[i] - avgDailyReturn;
        const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
        covariance += portfolioDiff * benchmarkDiff;
        benchmarkVariance += benchmarkDiff * benchmarkDiff;
      }
      
      covariance /= n;
      benchmarkVariance /= n;
      
      const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
      
      // Alpha (excess return over benchmark)
      const benchmarkAnnualReturn = benchmarkMean * 252;
      const alpha = annualizedReturn - (beta * benchmarkAnnualReturn);
      
      // Tracking error (standard deviation of excess returns)
      const excessReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
      const excessMean = excessReturns.reduce((a, b) => a + b, 0) / n;
      const trackingVariance = excessReturns.reduce((sum, r) => {
        const diff = r - excessMean;
        return sum + diff * diff;
      }, 0) / n;
      const trackingError = Math.sqrt(trackingVariance * 252);
      
      result.beta = beta;
      result.alpha = alpha;
      result.trackingError = trackingError;
    }

    return result;
  }
}

export const portfolioOptimizationService = new PortfolioOptimizationService();