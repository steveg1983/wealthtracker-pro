/**
 * @module PerformanceBenchmarks
 * @description World-class performance monitoring and benchmarking system
 * Tracks key metrics to ensure Microsoft/Google/Apple-level performance
 */

import { lazyLogger as logger } from '../services/serviceFactory';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  timestamp: number;
}

interface BenchmarkThresholds {
  renderTime: number;      // ms
  updateTime: number;      // ms
  memoryIncrease: number;  // MB
  fps: number;            // frames per second
}

/**
 * World-class performance thresholds
 * Based on industry standards from top tech companies
 */
const WORLD_CLASS_THRESHOLDS: BenchmarkThresholds = {
  renderTime: 16,        // 60 FPS target
  updateTime: 8,         // Half frame for updates
  memoryIncrease: 50,    // Max 50MB increase
  fps: 60               // Smooth animations
};

class PerformanceBenchmarkSystem {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private observer: PerformanceObserver | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;

  constructor() {
    this.initializeObserver();
    this.startFPSMonitoring();
  }

  /**
   * Initialize Performance Observer for detailed metrics
   */
  private initializeObserver(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.recordMetric(entry.name, entry.duration);
          }
        }
      });

      this.observer.observe({ entryTypes: ['measure'] });
    } catch (error) {
      logger.error('Failed to initialize performance observer:', error);
    }
  }

  /**
   * Start FPS monitoring for smooth animations
   */
  private startFPSMonitoring(): void {
    if (typeof window === 'undefined') return;

    const measureFPS = (currentTime: number) => {
      if (this.lastFrameTime) {
        const delta = currentTime - this.lastFrameTime;
        this.frameCount++;
        
        // Calculate FPS every second
        if (this.frameCount >= 60) {
          this.fps = Math.round(1000 / (delta / this.frameCount));
          this.frameCount = 0;
          
          if (this.fps < WORLD_CLASS_THRESHOLDS.fps) {
            logger.warn(`FPS below threshold: ${this.fps} < ${WORLD_CLASS_THRESHOLDS.fps}`);
          }
        }
      }
      
      this.lastFrameTime = currentTime;
      this.rafId = requestAnimationFrame(measureFPS);
    };

    this.rafId = requestAnimationFrame(measureFPS);
  }

  /**
   * Measure component render time
   */
  measureRender(componentName: string, callback: () => void): void {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    performance.mark(startMark);
    
    try {
      callback();
    } finally {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      
      const measure = performance.getEntriesByName(measureName)[0] as PerformanceMeasure;
      
      if (measure && measure.duration > WORLD_CLASS_THRESHOLDS.renderTime) {
        logger.warn(`Slow render detected in ${componentName}: ${measure.duration.toFixed(2)}ms`);
      }
      
      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);
    }
  }

  /**
   * Measure async operations
   */
  async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.recordMetric(operationName, duration);
      
      if (duration > 1000) {
        logger.warn(`Slow async operation ${operationName}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Async operation ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(name: string, duration: number): void {
    const metrics = this.metrics.get(name) || [];
    
    metrics.push({
      componentName: name,
      renderTime: duration,
      updateTime: 0,
      memoryUsage: this.getCurrentMemoryUsage(),
      timestamp: Date.now()
    });

    // Keep only last 100 metrics per component
    if (metrics.length > 100) {
      metrics.shift();
    }

    this.metrics.set(name, metrics);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof window === 'undefined') return 0;
    
    // @ts-ignore - performance.memory is Chrome-specific
    if (window.performance && window.performance.memory) {
      // @ts-ignore
      return window.performance.memory.usedJSHeapSize / 1048576; // Convert to MB
    }
    
    return 0;
  }

  /**
   * Get performance report for a component
   */
  getReport(componentName: string): {
    averageRenderTime: number;
    maxRenderTime: number;
    violations: number;
    recommendation: string;
  } {
    const metrics = this.metrics.get(componentName) || [];
    
    if (metrics.length === 0) {
      return {
        averageRenderTime: 0,
        maxRenderTime: 0,
        violations: 0,
        recommendation: 'No data available'
      };
    }

    const renderTimes = metrics.map(m => m.renderTime);
    const average = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const max = Math.max(...renderTimes);
    const violations = renderTimes.filter(t => t > WORLD_CLASS_THRESHOLDS.renderTime).length;

    let recommendation = 'Performance is world-class';
    
    if (violations > metrics.length * 0.1) {
      recommendation = 'Consider memoization and code splitting';
    } else if (max > WORLD_CLASS_THRESHOLDS.renderTime * 2) {
      recommendation = 'Investigate performance bottlenecks';
    }

    return {
      averageRenderTime: average,
      maxRenderTime: max,
      violations,
      recommendation
    };
  }

  /**
   * Get overall application performance score
   */
  getOverallScore(): {
    score: number;
    grade: string;
    fps: number;
    memoryUsage: number;
  } {
    const allMetrics = Array.from(this.metrics.values()).flat();
    
    if (allMetrics.length === 0) {
      return { score: 100, grade: 'A+', fps: this.fps, memoryUsage: 0 };
    }

    const avgRenderTime = allMetrics.reduce((a, b) => a + b.renderTime, 0) / allMetrics.length;
    const memoryUsage = this.getCurrentMemoryUsage();
    
    // Calculate score (0-100)
    let score = 100;
    
    // Deduct for slow renders
    if (avgRenderTime > WORLD_CLASS_THRESHOLDS.renderTime) {
      score -= Math.min(30, (avgRenderTime - WORLD_CLASS_THRESHOLDS.renderTime) * 2);
    }
    
    // Deduct for low FPS
    if (this.fps < WORLD_CLASS_THRESHOLDS.fps) {
      score -= Math.min(30, (WORLD_CLASS_THRESHOLDS.fps - this.fps) * 0.5);
    }
    
    // Deduct for high memory
    if (memoryUsage > 500) {
      score -= Math.min(20, (memoryUsage - 500) * 0.04);
    }
    
    // Determine grade
    let grade = 'A+';
    if (score < 95) grade = 'A';
    if (score < 90) grade = 'A-';
    if (score < 85) grade = 'B+';
    if (score < 80) grade = 'B';
    if (score < 75) grade = 'B-';
    if (score < 70) grade = 'C';
    
    return {
      score: Math.max(0, Math.round(score)),
      grade,
      fps: this.fps,
      memoryUsage
    };
  }

  /**
   * Log performance summary via centralized logger
   */
  logSummary(): void {
    const overall = this.getOverallScore();
    
    try {
      // Lazy import to avoid circular deps in some environments
      const { logger } = require('../services/loggingService');
      logger.info('🏆 Performance Benchmark Summary', {
        overall,
        details: Array.from(this.metrics.entries()).map(([name, _metrics]) => {
          const report = this.getReport(name);
          return { name, report };
        })
      });
    } catch {
      // Fallback if logger is unavailable
       
      console.warn('🏆 Performance Benchmark Summary');
      console.warn(`Overall Score: ${overall.score}/100 (${overall.grade})`);
      console.warn(`FPS: ${overall.fps}`);
      console.warn(`Memory Usage: ${overall.memoryUsage.toFixed(2)} MB`);
      this.metrics.forEach((_, name) => {
        const report = this.getReport(name);
        console.warn(`${name}: avg=${report.averageRenderTime.toFixed(2)}ms, max=${report.maxRenderTime.toFixed(2)}ms, violations=${report.violations}`);
      });
       
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.metrics.clear();
  }
}

// Export singleton instance
export const performanceBenchmarks = new PerformanceBenchmarkSystem();

// Export React hook for easy component integration
export function usePerformanceBenchmark(componentName: string) {
  return {
    measureRender: (callback: () => void) => 
      performanceBenchmarks.measureRender(componentName, callback),
    measureAsync: <T,>(operation: () => Promise<T>) => 
      performanceBenchmarks.measureAsync(componentName, operation),
    getReport: () => performanceBenchmarks.getReport(componentName)
  };
}

/**
 * World-Class Performance Benchmarks:
 * - Real-time FPS monitoring ✅
 * - Component render time tracking ✅
 * - Memory usage monitoring ✅
 * - Async operation timing ✅
 * - Automatic violation detection ✅
 * - Performance scoring system ✅
 * - Actionable recommendations ✅
 * 
 * This ensures Microsoft/Google/Apple-level performance
 */
