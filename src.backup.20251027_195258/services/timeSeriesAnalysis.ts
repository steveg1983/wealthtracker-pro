/**
 * Time Series Analysis Service
 * Advanced forecasting algorithms for spending prediction
 * Created: 2025-09-02
 */

import { toDecimal } from '@wealthtracker/utils';
import type { DecimalInstance } from '../types/decimal-types';

export interface TimeSeriesData {
  date: Date;
  value: DecimalInstance;
}

export interface SeasonalDecomposition {
  trend: DecimalInstance[];
  seasonal: DecimalInstance[];
  residual: DecimalInstance[];
  seasonalFactors: Map<number, DecimalInstance>; // month -> factor
}

export interface Forecast {
  value: DecimalInstance;
  lowerBound: DecimalInstance;
  upperBound: DecimalInstance;
  confidence: number;
  method: 'exponential' | 'arima' | 'linear' | 'seasonal';
}

export class TimeSeriesAnalysis {
  /**
   * Simple Moving Average
   */
  static movingAverage(data: DecimalInstance[], window: number): DecimalInstance[] {
    if (data.length < window) return data;
    
    const result: DecimalInstance[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const sum = data.slice(i - window + 1, i + 1)
        .reduce((acc, val) => acc.plus(val), toDecimal(0));
      result.push(sum.dividedBy(window));
    }
    
    return result;
  }

  /**
   * Exponential Smoothing with trend adjustment
   */
  static exponentialSmoothing(
    data: DecimalInstance[],
    alpha: number = 0.3,
    beta: number = 0.1
  ): Forecast[] {
    if (data.length < 2) {
      return data.map(d => ({
        value: d,
        lowerBound: d.times(0.9),
        upperBound: d.times(1.1),
        confidence: 0.5,
        method: 'exponential' as const
      }));
    }

    const forecasts: Forecast[] = [];
    const firstValue = data[0];
    const secondValue = data[1];
    if (!firstValue || !secondValue) {
      return forecasts; // Cannot forecast with insufficient data
    }

    let level = firstValue;
    let trend = secondValue.minus(firstValue);
    
    for (let i = 0; i < data.length; i++) {
      const value = level.plus(trend);
      
      // Update level and trend
      if (i < data.length) {
        const currentData = data[i];
        if (currentData && level && trend) {
          const prevLevel = level;
          level = toDecimal(alpha).times(currentData)
            .plus(toDecimal(1 - alpha).times(level.plus(trend)));
          trend = toDecimal(beta).times(level.minus(prevLevel))
            .plus(toDecimal(1 - beta).times(trend));
        }
      }
      
      // Calculate confidence bounds based on historical error
      const currentData = data[i];
      const prevForecast = forecasts[i - 1];
      const error = (i > 0 && currentData && prevForecast) ?
        currentData.minus(prevForecast.value).abs() : toDecimal(0);
      const stdError = error.times(1.96); // 95% confidence interval
      
      forecasts.push({
        value,
        lowerBound: value.minus(stdError),
        upperBound: value.plus(stdError),
        confidence: Math.max(0.5, 1 - (i * 0.05)), // Decreasing confidence over time
        method: 'exponential'
      });
    }
    
    return forecasts;
  }

  /**
   * Seasonal Decomposition using additive model
   */
  static seasonalDecomposition(
    data: TimeSeriesData[],
    seasonalPeriod: number = 12
  ): SeasonalDecomposition {
    const values = data.map(d => d.value);
    
    // Calculate trend using centered moving average
    const trend = this.centeredMovingAverage(values, seasonalPeriod);
    
    // Calculate seasonal component
    const detrended: DecimalInstance[] = [];
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const trendValue = trend[i];
      if (value && trendValue && i < trend.length) {
        detrended.push(value.minus(trendValue));
      } else {
        detrended.push(toDecimal(0));
      }
    }
    
    // Average seasonal factors for each period
    const seasonalFactors = new Map<number, DecimalInstance>();
    for (let period = 0; period < seasonalPeriod; period++) {
      const periodValues: DecimalInstance[] = [];
      for (let i = period; i < detrended.length; i += seasonalPeriod) {
        const value = detrended[i];
        if (value) {
          periodValues.push(value);
        }
      }
      
      if (periodValues.length > 0) {
        const avg = periodValues.reduce((sum, val) => sum.plus(val), toDecimal(0))
          .dividedBy(periodValues.length);
        seasonalFactors.set(period, avg);
      } else {
        seasonalFactors.set(period, toDecimal(0));
      }
    }
    
    // Apply seasonal factors to get seasonal component
    const seasonal: DecimalInstance[] = [];
    for (let i = 0; i < values.length; i++) {
      const period = i % seasonalPeriod;
      seasonal.push(seasonalFactors.get(period) || toDecimal(0));
    }
    
    // Calculate residual
    const residual: DecimalInstance[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < trend.length) {
        const trendValue = trend[i];
        const seasonalValue = seasonal[i];
        const value = values[i];
        if (trendValue && seasonalValue && value) {
          residual.push(value.minus(trendValue).minus(seasonalValue));
        } else {
          residual.push(toDecimal(0));
        }
      } else {
        residual.push(toDecimal(0));
      }
    }
    
    return {
      trend,
      seasonal,
      residual,
      seasonalFactors
    };
  }

  /**
   * Centered Moving Average for trend extraction
   */
  private static centeredMovingAverage(
    data: DecimalInstance[],
    window: number
  ): DecimalInstance[] {
    const result: DecimalInstance[] = [];
    const halfWindow = Math.floor(window / 2);
    
    for (let i = halfWindow; i < data.length - halfWindow; i++) {
      const sum = data.slice(i - halfWindow, i + halfWindow + 1)
        .reduce((acc, val) => acc.plus(val), toDecimal(0));
      result.push(sum.dividedBy(window));
    }
    
    return result;
  }

  /**
   * Linear Regression for trend analysis
   */
  static linearRegression(data: DecimalInstance[]): {
    slope: DecimalInstance;
    intercept: DecimalInstance;
    rSquared: number;
  } {
    const n = data.length;
    if (n < 2) {
      return {
        slope: toDecimal(0),
        intercept: data[0] || toDecimal(0),
        rSquared: 0
      };
    }
    
    // Calculate sums
    let sumX = toDecimal(0);
    let sumY = toDecimal(0);
    let sumXY = toDecimal(0);
    let sumX2 = toDecimal(0);
    let sumY2 = toDecimal(0);
    
    for (let i = 0; i < n; i++) {
      const x = toDecimal(i);
      const y = data[i];

      if (y) {
        sumX = sumX.plus(x);
        sumY = sumY.plus(y);
        sumXY = sumXY.plus(x.times(y));
        sumX2 = sumX2.plus(x.pow(2));
        sumY2 = sumY2.plus(y.pow(2));
      }
    }
    
    // Calculate slope and intercept
    const denominator = toDecimal(n).times(sumX2).minus(sumX.pow(2));
    if (denominator.equals(0)) {
      return {
        slope: toDecimal(0),
        intercept: sumY.dividedBy(n),
        rSquared: 0
      };
    }
    
    const slope = toDecimal(n).times(sumXY).minus(sumX.times(sumY)).dividedBy(denominator);
    const intercept = sumY.minus(slope.times(sumX)).dividedBy(n);
    
    // Calculate R-squared
    const meanY = sumY.dividedBy(n);
    let ssRes = toDecimal(0);
    let ssTot = toDecimal(0);
    
    for (let i = 0; i < n; i++) {
      const dataPoint = data[i];
      if (dataPoint) {
        const predicted = slope.times(i).plus(intercept);
        const residual = dataPoint.minus(predicted);
        ssRes = ssRes.plus(residual.pow(2));

        const totalDiff = dataPoint.minus(meanY);
        ssTot = ssTot.plus(totalDiff.pow(2));
      }
    }
    
    const rSquared = ssTot.greaterThan(0) 
      ? 1 - ssRes.dividedBy(ssTot).toNumber()
      : 0;
    
    return { slope, intercept, rSquared };
  }

  /**
   * Forecast future values using best method
   */
  static forecast(
    historicalData: TimeSeriesData[],
    periodsAhead: number = 1,
    options: {
      detectSeasonality?: boolean;
      confidenceLevel?: number;
    } = {}
  ): Forecast[] {
    const { 
      detectSeasonality = true,
      confidenceLevel = 0.95
    } = options;
    
    if (historicalData.length < 3) {
      // Not enough data for sophisticated methods
      const lastValue = historicalData[historicalData.length - 1]?.value || toDecimal(0);
      return Array(periodsAhead).fill(null).map(() => ({
        value: lastValue,
        lowerBound: lastValue.times(0.8),
        upperBound: lastValue.times(1.2),
        confidence: 0.3,
        method: 'linear' as const
      }));
    }
    
    const values = historicalData.map(d => d.value);
    
    // Detect trend
    const { slope, rSquared } = this.linearRegression(values);
    const hasTrend = rSquared > 0.5;
    
    // Detect seasonality
    let hasSeasonality = false;
    let seasonalFactors = new Map<number, DecimalInstance>();
    
    if (detectSeasonality && historicalData.length >= 12) {
      const decomposition = this.seasonalDecomposition(historicalData, 12);
      
      // Check if seasonal component is significant
      const seasonalVariance = decomposition.seasonal
        .reduce((sum, val) => sum.plus(val.pow(2)), toDecimal(0))
        .dividedBy(decomposition.seasonal.length);
      
      const totalVariance = values
        .reduce((sum, val) => sum.plus(val.pow(2)), toDecimal(0))
        .dividedBy(values.length);
      
      hasSeasonality = seasonalVariance.dividedBy(totalVariance).toNumber() > 0.1;
      if (hasSeasonality) {
        seasonalFactors = decomposition.seasonalFactors;
      }
    }
    
    // Choose forecasting method
    const forecasts: Forecast[] = [];
    
    if (hasSeasonality) {
      // Use seasonal decomposition
      const lastValue = values[values.length - 1] || toDecimal(0);
      for (let i = 1; i <= periodsAhead; i++) {
        const periodIndex = (historicalData.length + i - 1) % 12;
        const seasonalFactor = seasonalFactors.get(periodIndex) || toDecimal(0);

        const forecast = lastValue
          .plus(slope.times(i))
          .plus(seasonalFactor);
        
        // Calculate prediction interval
        const standardError = this.calculateStandardError(values);
        const zScore = this.getZScore(confidenceLevel);
        
        forecasts.push({
          value: forecast,
          lowerBound: forecast.minus(standardError.times(zScore)),
          upperBound: forecast.plus(standardError.times(zScore)),
          confidence: Math.max(0.7, 0.95 - (i * 0.05)),
          method: 'seasonal'
        });
      }
    } else if (hasTrend) {
      // Use exponential smoothing with trend
      const smoothedForecasts = this.exponentialSmoothing(values, 0.3, 0.1);
      const lastForecast = smoothedForecasts[smoothedForecasts.length - 1];

      if (lastForecast) {
        for (let i = 1; i <= periodsAhead; i++) {
          const trendAdjustment = slope.times(i);
          const forecast = lastForecast.value.plus(trendAdjustment);
        
        forecasts.push({
          value: forecast,
          lowerBound: forecast.times(0.85),
          upperBound: forecast.times(1.15),
          confidence: Math.max(0.6, 0.9 - (i * 0.05)),
          method: 'exponential'
        });
        }
      }
    } else {
      // Use simple moving average
      const windowSize = Math.min(3, values.length);
      const recentValues = values.slice(-windowSize);
      const average = recentValues.reduce((sum, val) => sum.plus(val), toDecimal(0))
        .dividedBy(windowSize);
      
      for (let i = 1; i <= periodsAhead; i++) {
        forecasts.push({
          value: average,
          lowerBound: average.times(0.9),
          upperBound: average.times(1.1),
          confidence: Math.max(0.5, 0.8 - (i * 0.05)),
          method: 'linear'
        });
      }
    }
    
    return forecasts;
  }

  /**
   * Calculate standard error for prediction intervals
   */
  private static calculateStandardError(
    historicalValues: DecimalInstance[]
  ): DecimalInstance {
    const mean = historicalValues.reduce((sum, val) => sum.plus(val), toDecimal(0))
      .dividedBy(historicalValues.length);
    
    const squaredDiffs = historicalValues.map(val => val.minus(mean).pow(2));
    const variance = squaredDiffs.reduce((sum, val) => sum.plus(val), toDecimal(0))
      .dividedBy(Math.max(1, historicalValues.length - 1));
    
    return variance.sqrt();
  }

  /**
   * Get Z-score for confidence level
   */
  private static getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Detect anomalies in time series using MAD (Median Absolute Deviation)
   */
  static detectAnomalies(
    data: TimeSeriesData[],
    threshold: number = 3
  ): { index: number; value: DecimalInstance; score: number }[] {
    const values = data.map(d => d.value);
    
    // Calculate median
    const sorted = [...values].sort((a, b) => a.minus(b).toNumber());
    const medianIndex = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (() => {
          const left = sorted[sorted.length / 2 - 1];
          const right = sorted[sorted.length / 2];
          return (left && right) ? left.plus(right).dividedBy(2) : toDecimal(0);
        })()
      : sorted[medianIndex] || toDecimal(0);
    
    // Calculate MAD
    const deviations = values.map(val => val.minus(median).abs());
    const sortedDeviations = [...deviations].sort((a, b) => a.minus(b).toNumber());
    const madIndex = Math.floor(sortedDeviations.length / 2);
    const mad = sortedDeviations.length % 2 === 0
      ? (() => {
          const left = sortedDeviations[sortedDeviations.length / 2 - 1];
          const right = sortedDeviations[sortedDeviations.length / 2];
          return (left && right) ? left.plus(right).dividedBy(2) : toDecimal(0);
        })()
      : sortedDeviations[madIndex] || toDecimal(0);
    
    // Detect anomalies
    const anomalies: { index: number; value: DecimalInstance; score: number }[] = [];
    const madMultiplier = toDecimal(1.4826); // Consistency factor for normal distribution
    
    values.forEach((value, index) => {
      if (mad.greaterThan(0)) {
        const score = value.minus(median).abs()
          .dividedBy(mad.times(madMultiplier))
          .toNumber();
        
        if (score > threshold) {
          anomalies.push({ index, value, score });
        }
      }
    });
    
    return anomalies;
  }
}

export default TimeSeriesAnalysis;
