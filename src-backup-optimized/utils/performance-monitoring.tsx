/**
 * @module PerformanceMonitoring
 * @description World-class performance monitoring utilities for React components.
 * Provides comprehensive performance tracking, re-render detection, and 
 * optimization insights matching Google/Meta engineering standards.
 */

import React, { useEffect, useRef, useCallback, ComponentType, PropsWithChildren } from 'react';
import * as Sentry from '@sentry/react';
import { useLogger } from '../services/ServiceProvider';

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Component name for tracking */
  componentName: string;
  /** Threshold in milliseconds for render time warnings */
  renderThreshold?: number;
  /** Track component re-renders */
  trackRerenders?: boolean;
  /** Track props changes that trigger re-renders */
  trackPropsChanges?: boolean;
  /** Report to Sentry */
  reportToSentry?: boolean;
  /** Report to console in development */
  logInDevelopment?: boolean;
  /** Custom performance marks */
  customMarks?: string[];
  /** Enable memory profiling */
  trackMemory?: boolean;
}

/**
 * Performance metrics collected for each component
 */
export interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  renderCount: number;
  lastRenderTimestamp: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  propsChangeCount: number;
  memoryUsage?: {
    jsHeapSizeUsed: number;
    jsHeapSizeLimit: number;
    usagePercentage: number;
  };
}

/**
 * Global performance store for aggregating metrics
 */
class PerformanceStore {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: Set<(metrics: PerformanceMetrics[]) => void> = new Set();

  updateMetrics(componentName: string, renderTime: number): void {
    const existing = this.metrics.get(componentName) || {
      componentName,
      renderTime: 0,
      renderCount: 0,
      lastRenderTimestamp: 0,
      averageRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
      propsChangeCount: 0,
    };

    const newCount = existing.renderCount + 1;
    const newAverage = (existing.averageRenderTime * existing.renderCount + renderTime) / newCount;

    this.metrics.set(componentName, {
      ...existing,
      renderTime,
      renderCount: newCount,
      lastRenderTimestamp: Date.now(),
      averageRenderTime: newAverage,
      maxRenderTime: Math.max(existing.maxRenderTime, renderTime),
      minRenderTime: Math.min(existing.minRenderTime, renderTime),
    });

    this.notifyObservers();
  }

  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  subscribe(callback: (metrics: PerformanceMetrics[]) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  private notifyObservers(): void {
    const metrics = this.getMetrics();
    this.observers.forEach(observer => observer(metrics));
  }

  reset(): void {
    this.metrics.clear();
    this.notifyObservers();
  }
}

export const performanceStore = new PerformanceStore();

/**
 * Hook for monitoring component performance
 * @param config - Performance monitoring configuration
 */
export function usePerformanceMonitoring(config: PerformanceConfig): void {
  const logger = useLogger();
  const renderStartTime = useRef<number>(performance.now());
  const renderCount = useRef<number>(0);
  const previousProps = useRef<any>();
  const {
    componentName,
    renderThreshold = 16, // One frame at 60fps
    trackRerenders = true,
    trackPropsChanges = false,
    reportToSentry = true,
    logInDevelopment = process.env.NODE_ENV === 'development',
    trackMemory = false,
  } = config;

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    renderCount.current += 1;

    // Update global metrics
    performanceStore.updateMetrics(componentName, renderTime);

    // Check if render time exceeds threshold
    if (renderTime > renderThreshold) {
      const warning = `Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`;
      
      if (logInDevelopment) {
        logger.warn(warning, {
          componentName,
          renderTime,
          renderCount: renderCount.current,
          threshold: renderThreshold,
        });
      }

      if (reportToSentry && renderTime > renderThreshold * 2) {
        Sentry.captureMessage(warning, 'warning');
      }
    }

    // Track memory usage if enabled
    if (trackMemory && 'memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = {
        jsHeapSizeUsed: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };

      if (memoryUsage.usagePercentage > 90) {
        logger.error(`High memory usage in ${componentName}: ${memoryUsage.usagePercentage.toFixed(1)}%`);
      }
    }

    // Track re-renders
    if (trackRerenders && renderCount.current > 1 && logInDevelopment) {
      logger.debug(`${componentName} re-rendered (count: ${renderCount.current})`);
    }

    // Reset render start time for next render
    renderStartTime.current = performance.now();
  });

  // Track props changes
  useEffect(() => {
    if (trackPropsChanges && previousProps.current) {
      const changedProps = Object.keys(previousProps.current).filter(
        key => previousProps.current[key] !== (config as any)[key]
      );
      
      if (changedProps.length > 0 && logInDevelopment) {
        logger.debug(`${componentName} props changed:`, changedProps);
      }
    }
    previousProps.current = { ...config };
  }, [config, componentName, trackPropsChanges, logInDevelopment]);
}

/**
 * Higher-order component for performance monitoring
 * @param Component - Component to wrap
 * @param config - Performance configuration
 * @returns Wrapped component with performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  config: Omit<PerformanceConfig, 'componentName'> & { 
    componentName?: string 
  } = {}
): ComponentType<P> {
  const componentName = config.componentName || Component.displayName || Component.name || 'Unknown';
  
  const WrappedComponent = React.memo((props: P) => {
    usePerformanceMonitoring({
      ...config,
      componentName,
    });

    return <Component {...props} />;
  }, (prevProps, nextProps) => {
    // Custom comparison for better performance
    if (config.trackPropsChanges) {
      const keys = Object.keys(prevProps) as Array<keyof P>;
      return keys.every(key => prevProps[key] === nextProps[key]);
    }
    return false; // Use default comparison
  });

  WrappedComponent.displayName = `WithPerformance(${componentName})`;
  return WrappedComponent as unknown as ComponentType<P>;
}

/**
 * Performance monitoring provider for app-wide metrics
 */
export const PerformanceMonitoringProvider: React.FC<PropsWithChildren> = ({ children }) => {
  useEffect(() => {
    // Set up performance observer for long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            logger.warn('Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Longtask observer not supported
      }

      return () => observer.disconnect();
    }
  }, []);

  return <>{children}</>;
};

/**
 * Hook to access performance metrics
 */
export function usePerformanceMetrics(): PerformanceMetrics[] {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    setMetrics(performanceStore.getMetrics());
    return performanceStore.subscribe(setMetrics);
  }, []);

  return metrics;
}

/**
 * Component profiler for detailed performance analysis
 */
export const ComponentProfiler: React.FC<{
  id: string;
  children: React.ReactNode;
  onRender?: (id: string, phase: string, actualDuration: number) => void;
}> = ({ id, children, onRender }) => {
  const handleRender = useCallback(
    (
      profileId: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      const metrics = {
        id: profileId,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      };

      if (actualDuration > 16) {
        logger.warn(`Slow ${phase} in ${profileId}:`, metrics);
      }

      if (onRender) {
        onRender(profileId, phase, actualDuration);
      }

      // Report to Sentry for significant performance issues
      if (actualDuration > 100) {
        Sentry.captureMessage(
          `Performance issue: ${profileId} ${phase} took ${actualDuration.toFixed(2)}ms`,
          'warning'
        );
      }
    },
    [onRender]
  );

  return (
    <React.Profiler id={id} onRender={handleRender}>
      {children}
    </React.Profiler>
  );
};

/**
 * Utility to measure async operation performance
 */
export async function measureAsyncPerformance<T>(
  operation: () => Promise<T>,
  operationName: string,
  threshold = 1000
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    if (duration > threshold) {
      logger.warn(`Slow async operation: ${operationName} took ${duration.toFixed(2)}ms`);
      
      if (duration > threshold * 2) {
        Sentry.captureMessage(
          `Very slow async operation: ${operationName} took ${duration.toFixed(2)}ms`,
          'warning'
        );
      }
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error(`Async operation failed: ${operationName} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Export performance report
 */
export function exportPerformanceReport(): string {
  const metrics = performanceStore.getMetrics();
  const report = {
    timestamp: new Date().toISOString(),
    metrics: metrics.sort((a, b) => b.averageRenderTime - a.averageRenderTime),
    summary: {
      totalComponents: metrics.length,
      slowComponents: metrics.filter(m => m.averageRenderTime > 16).length,
      totalRenders: metrics.reduce((sum, m) => sum + m.renderCount, 0),
      averageRenderTime: metrics.reduce((sum, m) => sum + m.averageRenderTime, 0) / metrics.length,
    },
  };
  
  return JSON.stringify(report, null, 2);
}
