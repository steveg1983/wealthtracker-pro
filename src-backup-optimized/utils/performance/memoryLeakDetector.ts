/**
 * Memory Leak Detector - Phase 7.5
 * Detects and prevents memory leaks in React components
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLogger } from '../../services/ServiceProvider';
interface PerformanceMemoryLike {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemoryLike;
};

type ManagedObserver = {
  disconnect?: () => void;
  unobserve?: (target?: Element) => void;
};

const getPerformanceMemory = (): PerformanceMemoryLike | null => {
  const logger = useLogger();
  if (typeof performance === 'undefined') {
    return null;
  }

  const performanceWithMemory = performance as PerformanceWithMemory;
  return performanceWithMemory.memory ?? null;
};

interface LeakDetectionConfig {
  componentName: string;
  enableLogging?: boolean;
  memoryThreshold?: number; // MB
  intervalThreshold?: number; // ms
}

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  componentName: string;
}

/**
 * Memory Leak Detector Service
 */
class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private intervals = new Map<string, NodeJS.Timeout>();
  private eventListeners = new Map<string, Array<{ element: EventTarget; event: string; handler: EventListener }>>();
  private observerRefs = new Map<string, Array<{ observer: ManagedObserver; type: string }>>();

  /**
   * Start monitoring a component for memory leaks
   */
  startMonitoring(config: LeakDetectionConfig): void {
    const { componentName, enableLogging = true, memoryThreshold = 50 } = config;

    // Take initial memory snapshot
    this.takeSnapshot(componentName);

    // Set up periodic monitoring
    const interval = setInterval(() => {
      this.takeSnapshot(componentName);
      this.analyzeLeaks(componentName, memoryThreshold, enableLogging);
    }, 10000); // Check every 10 seconds

    this.intervals.set(componentName, interval);

    if (enableLogging) {
      logger.debug('Started memory monitoring for component:', componentName);
    }
  }

  /**
   * Stop monitoring a component
   */
  stopMonitoring(componentName: string): void {
    const interval = this.intervals.get(componentName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(componentName);
    }

    // Clean up tracked resources
    this.cleanupEventListeners(componentName);
    this.cleanupObservers(componentName);

    // Remove snapshots for this component
    this.snapshots = this.snapshots.filter(s => s.componentName !== componentName);

    logger.debug('Stopped memory monitoring for component:', componentName);
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(componentName: string): void {
    const memory = getPerformanceMemory();
    if (!memory) {
      return;
    }
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      componentName
    };

    this.snapshots.push(snapshot);

    // Keep only last 20 snapshots per component
    this.snapshots = this.snapshots
      .filter(s => s.componentName === componentName)
      .slice(-20)
      .concat(this.snapshots.filter(s => s.componentName !== componentName));
  }

  /**
   * Analyze for potential memory leaks
   */
  private analyzeLeaks(componentName: string, threshold: number, enableLogging: boolean): void {
    const componentSnapshots = this.snapshots
      .filter(s => s.componentName === componentName)
      .slice(-10); // Last 10 snapshots

    if (componentSnapshots.length < 5) return;

    // Check for consistent memory growth
    const memoryTrend = this.calculateMemoryTrend(componentSnapshots);
    const currentMemoryMB = componentSnapshots[componentSnapshots.length - 1].heapUsed / 1024 / 1024;

    // Detect potential leaks
    const isLeaking = memoryTrend > 1024 * 1024; // Growing by 1MB+
    const isHighMemory = currentMemoryMB > threshold;

    if (isLeaking || isHighMemory) {
      const severity = isLeaking && isHighMemory ? 'critical' : 'warning';

      if (enableLogging) {
        logger[severity === 'critical' ? 'error' : 'warn']('Potential memory leak detected:', {
          component: componentName,
          currentMemoryMB: currentMemoryMB.toFixed(2),
          memoryTrend: (memoryTrend / 1024 / 1024).toFixed(2) + 'MB growth',
          threshold: threshold + 'MB',
          recommendation: this.getLeakRecommendation(componentName)
        });
      }
    }
  }

  /**
   * Calculate memory growth trend
   */
  private calculateMemoryTrend(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0].heapUsed;
    const last = snapshots[snapshots.length - 1].heapUsed;
    return last - first;
  }

  /**
   * Get recommendations for fixing memory leaks
   */
  private getLeakRecommendation(componentName: string): string {
    const eventListeners = this.eventListeners.get(componentName)?.length || 0;
    const observers = this.observerRefs.get(componentName)?.length || 0;

    if (eventListeners > 0) {
      return `Remove ${eventListeners} event listeners in useEffect cleanup`;
    }
    if (observers > 0) {
      return `Disconnect ${observers} observers in useEffect cleanup`;
    }
    return 'Check for uncleaned timers, subscriptions, or large data structures';
  }

  /**
   * Register event listener for cleanup tracking
   */
  registerEventListener(
    componentName: string,
    element: EventTarget,
    event: string,
    handler: EventListener
  ): void {
    if (!this.eventListeners.has(componentName)) {
      this.eventListeners.set(componentName, []);
    }
    this.eventListeners.get(componentName)!.push({ element, event, handler });
  }

  /**
   * Register observer for cleanup tracking
   */
  registerObserver(
    componentName: string,
    observer: ManagedObserver,
    type: string
  ): void {
    if (!this.observerRefs.has(componentName)) {
      this.observerRefs.set(componentName, []);
    }
    this.observerRefs.get(componentName)!.push({ observer, type });
  }

  /**
   * Clean up event listeners
   */
  private cleanupEventListeners(componentName: string): void {
    const listeners = this.eventListeners.get(componentName);
    if (listeners) {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners.delete(componentName);
    }
  }

  /**
   * Clean up observers
   */
  private cleanupObservers(componentName: string): void {
    const observers = this.observerRefs.get(componentName);
    if (observers) {
      observers.forEach(({ observer }) => {
        if (observer && typeof observer.disconnect === 'function') {
          observer.disconnect();
        }
        if (observer && typeof observer.unobserve === 'function') {
          observer.unobserve();
        }
      });
      this.observerRefs.delete(componentName);
    }
  }

  /**
   * Get memory leak report
   */
  getLeakReport(): {
    componentsMonitored: number;
    activeIntervals: number;
    trackedEventListeners: number;
    trackedObservers: number;
    recentSnapshots: number;
  } {
    return {
      componentsMonitored: this.intervals.size,
      activeIntervals: this.intervals.size,
      trackedEventListeners: Array.from(this.eventListeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      trackedObservers: Array.from(this.observerRefs.values()).reduce((sum, arr) => sum + arr.length, 0),
      recentSnapshots: this.snapshots.length
    };
  }
}

// Export singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();

/**
 * React hook for automatic memory leak detection
 */
export function useMemoryLeakDetection(
  componentName: string,
  config: Partial<LeakDetectionConfig> = {}
): {
  registerInterval: (interval: NodeJS.Timeout) => void;
  registerEventListener: (element: EventTarget, event: string, handler: EventListener) => void;
  registerObserver: (observer: ManagedObserver, type: string) => void;
} {
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Start monitoring
    memoryLeakDetector.startMonitoring({
      componentName,
      ...config
    });

    return () => {
      // Cleanup all intervals created by this component
      intervalsRef.current.forEach(clearInterval);

      // Stop monitoring
      memoryLeakDetector.stopMonitoring(componentName);
    };
  }, [componentName]);

  const registerInterval = useCallback((interval: NodeJS.Timeout) => {
    intervalsRef.current.push(interval);
  }, []);

  const registerEventListener = useCallback((element: EventTarget, event: string, handler: EventListener) => {
    memoryLeakDetector.registerEventListener(componentName, element, event, handler);
  }, [componentName]);

  const registerObserver = useCallback((observer: ManagedObserver, type: string) => {
    memoryLeakDetector.registerObserver(componentName, observer, type);
  }, [componentName]);

  return {
    registerInterval,
    registerEventListener,
    registerObserver
  };
}

/**
 * Hook for monitoring component render performance
 */
export function useRenderLeakDetection(componentName: string) {
  const logger = useLogger();
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  useEffect(() => {
    renderCountRef.current++;
    const currentTime = performance.now();

    if (lastRenderTimeRef.current > 0) {
      const timeSinceLastRender = currentTime - lastRenderTimeRef.current;

      // Detect excessive re-renders
      if (timeSinceLastRender < 16 && renderCountRef.current > 10) {
        logger.warn('Excessive re-renders detected:', {
          component: componentName,
          renderCount: renderCountRef.current,
          timeSinceLastRender
        });
      }
    }

    lastRenderTimeRef.current = currentTime;
  });

  return {
    renderCount: renderCountRef.current
  };
}
