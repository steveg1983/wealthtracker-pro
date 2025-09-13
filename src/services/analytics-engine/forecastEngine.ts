/**
 * Forecast Engine Module
 * Generates predictions using multiple statistical models
 */

import regression from 'regression';
import * as ss from 'simple-statistics';
import { addMonths, parseISO } from 'date-fns';
import type { Transaction } from '../../types';
import type { ForecastResult, ChartDataPoint, TrendAnalysis } from './types';
import { timeIntelligence } from './timeIntelligence';

export class ForecastEngine {
  /**
   * Generate forecasts using multiple models
   */
  async generateForecast(
    transactions: Transaction[],
    metric: 'income' | 'expenses' | 'net',
    periods: number = 3,
    model: 'linear' | 'exponential' | 'polynomial' | 'auto' = 'auto'
  ): Promise<ForecastResult> {
    const historicalData = timeIntelligence.aggregateByPeriod(transactions, 'month', metric);
    
    if (historicalData.length < 3) {
      throw new Error('Insufficient data for forecasting');
    }

    const values: [number, number][] = historicalData.map((d, i) => [i, d.y]);
    
    // Select best model if auto
    let selectedModel = model;
    let bestFit = { equation: [0, 0], r2: 0, predict: (x: number): [number, number] => [0, 0] };
    
    if (model === 'auto') {
      const models = {
        linear: regression.linear(values),
        exponential: regression.exponential(values),
        polynomial: regression.polynomial(values, { order: 2 })
      };
      
      // Select model with highest R²
      let maxR2 = 0;
      Object.entries(models).forEach(([name, fit]) => {
        if (fit.r2 > maxR2) {
          maxR2 = fit.r2;
          selectedModel = name as 'linear' | 'exponential' | 'polynomial';
          bestFit = fit;
        }
      });
    } else {
      switch (model) {
        case 'linear':
          bestFit = regression.linear(values);
          break;
        case 'exponential':
          bestFit = regression.exponential(values);
          break;
        case 'polynomial':
          bestFit = regression.polynomial(values, { order: 2 });
          break;
      }
    }

    // Generate predictions
    const predictions: Array<{ date: Date; value: number; lower: number; upper: number }> = [];
    const lastIndex = values.length - 1;
    const lastDate = parseISO(historicalData[historicalData.length - 1].x as string);
    
    // Calculate confidence intervals based on historical variance
    const residuals = values.map(([x, y]) => y - bestFit.predict(x)[1]);
    const stdError = ss.standardDeviation(residuals);
    
    for (let i = 1; i <= periods; i++) {
      const futureIndex = lastIndex + i;
      const prediction = bestFit.predict(futureIndex)[1];
      const confidence = 1.96 * stdError * Math.sqrt(
        1 + 1/values.length + 
        Math.pow(futureIndex - ss.mean(values.map(v => v[0])), 2) / 
        ss.sum(values.map(v => Math.pow(v[0] - ss.mean(values.map(v => v[0])), 2)))
      );
      
      predictions.push({
        date: addMonths(lastDate, i),
        value: Math.max(0, prediction),
        lower: Math.max(0, prediction - confidence),
        upper: prediction + confidence
      });
    }

    return {
      predictions,
      accuracy: bestFit.r2,
      model: selectedModel,
      parameters: {
        equation: bestFit.equation,
        dataPoints: values.length
      }
    };
  }

  /**
   * Detect seasonal patterns using decomposition
   */
  detectSeasonalPatterns(
    transactions: Transaction[],
    metric: 'income' | 'expenses' = 'expenses'
  ): TrendAnalysis {
    const monthlyData = timeIntelligence.aggregateByPeriod(transactions, 'month', metric);
    
    if (monthlyData.length < 12) {
      return {
        direction: 'stable',
        slope: 0,
        rSquared: 0,
        changeRate: 0,
        seasonality: { detected: false }
      };
    }

    const values = monthlyData.map(d => d.y);
    
    // Calculate trend using linear regression
    const regressionData: [number, number][] = values.map((y, x) => [x, y]);
    const result = regression.linear(regressionData);
    
    // Detrend the data
    const detrended = values.map((y, x) => y - result.predict(x)[1]);
    
    // Check for seasonality using autocorrelation
    const seasonalStrength = this.calculateAutocorrelation(detrended, 12);
    
    return {
      direction: result.equation[0] > 0.01 ? 'increasing' : 
                 result.equation[0] < -0.01 ? 'decreasing' : 'stable',
      slope: result.equation[0],
      rSquared: result.r2,
      changeRate: (result.equation[0] / (values[0] || 1)) * 100,
      seasonality: {
        detected: Math.abs(seasonalStrength) > 0.3,
        pattern: Math.abs(seasonalStrength) > 0.3 ? 'monthly' : undefined,
        strength: Math.abs(seasonalStrength)
      }
    };
  }

  /**
   * Calculate autocorrelation for seasonality detection
   */
  private calculateAutocorrelation(data: number[], lag: number): number {
    if (data.length <= lag) return 0;
    
    const mean = ss.mean(data);
    const c0 = ss.sum(data.map(x => Math.pow(x - mean, 2))) / data.length;
    
    let sum = 0;
    for (let i = 0; i < data.length - lag; i++) {
      sum += (data[i] - mean) * (data[i + lag] - mean);
    }
    
    return (sum / (data.length - lag)) / c0;
  }
}

export const forecastEngine = new ForecastEngine();