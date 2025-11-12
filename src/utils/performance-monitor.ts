import { formatDecimal } from './decimal-format';

const noop = () => {};
const consoleTarget: Pick<Console, 'log' | 'warn'> & Partial<Pick<Console, 'group' | 'groupEnd'>> =
  typeof console !== 'undefined'
    ? console
    : {
        log: noop,
        warn: noop,
        group: noop,
        groupEnd: noop,
      };

const isTestMode = typeof import.meta !== 'undefined'
  ? import.meta.env?.MODE === 'test'
  : (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test');

const isDevMode = typeof import.meta !== 'undefined'
  ? !!import.meta.env?.DEV
  : (typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : false);

const devLoggingEnabled = isDevMode && !isTestMode;

const devLog = (...args: Parameters<Console['log']>) => {
  if (devLoggingEnabled) {
    consoleTarget.log(...args);
  }
};

const devWarn = (...args: Parameters<Console['warn']>) => {
  if (devLoggingEnabled) {
    consoleTarget.warn(...args);
  }
};

const devGroup = (...args: Parameters<Console['group']>) => {
  if (devLoggingEnabled && typeof consoleTarget.group === 'function') {
    consoleTarget.group(...args);
  }
};

const devGroupEnd = () => {
  if (devLoggingEnabled && typeof consoleTarget.groupEnd === 'function') {
    consoleTarget.groupEnd();
  }
};

/**
 * Performance Monitoring Utilities
 * Track and report application performance metrics
 */

interface PerformanceMetrics {
  // Navigation Timing
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  
  // Resource Timing
  totalResources: number;
  totalResourceSize: number;
  totalResourceDuration: number;
  
  // Bundle Metrics
  jsSize: number;
  cssSize: number;
  imageSize: number;
  fontSize: number;
  
  // User Timing
  customMetrics: Record<string, number>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.initializeObservers();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeObservers(): void {
    // Observe paint timing
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-paint') {
              this.metrics.firstPaint = entry.startTime;
            } else if (entry.name === 'first-contentful-paint') {
              this.metrics.firstContentfulPaint = entry.startTime;
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);

        // Observe largest contentful paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        devWarn('Performance Observer not supported:', e);
      }
    }
  }

  collectNavigationMetrics(): void {
    if ('performance' in window && 'timing' in performance) {
      const timing = performance.timing;
      this.metrics.navigationStart = timing.navigationStart;
      this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
      this.metrics.loadComplete = timing.loadEventEnd - timing.navigationStart;
    }
  }

  collectResourceMetrics(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const resources = performance.getEntriesByType('resource');
      
      let jsSize = 0;
      let cssSize = 0;
      let imageSize = 0;
      let fontSize = 0;
      let totalDuration = 0;

      resources.forEach((resource: any) => {
        const size = resource.transferSize || 0;
        const duration = resource.duration || 0;
        totalDuration += duration;

        if (resource.name.includes('.js')) {
          jsSize += size;
        } else if (resource.name.includes('.css')) {
          cssSize += size;
        } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
          imageSize += size;
        } else if (resource.name.match(/\.(woff|woff2|ttf|eot)/i)) {
          fontSize += size;
        }
      });

      this.metrics.totalResources = resources.length;
      this.metrics.totalResourceSize = jsSize + cssSize + imageSize + fontSize;
      this.metrics.totalResourceDuration = totalDuration;
      this.metrics.jsSize = jsSize;
      this.metrics.cssSize = cssSize;
      this.metrics.imageSize = imageSize;
      this.metrics.fontSize = fontSize;
    }
  }

  mark(name: string): void {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }

  measure(name: string, startMark: string, endMark?: string): void {
    if ('performance' in window && 'measure' in performance) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          if (!this.metrics.customMetrics) {
            this.metrics.customMetrics = {};
          }
          this.metrics.customMetrics[name] = entries[entries.length - 1].duration;
        }
      } catch (e) {
        devWarn('Performance measure failed:', e);
      }
    }
  }

  getMetrics(): Partial<PerformanceMetrics> {
    this.collectNavigationMetrics();
    this.collectResourceMetrics();
    return this.metrics;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    devGroup('📊 Performance Metrics');
    
    if (metrics.domContentLoaded) {
      devLog(`DOM Content Loaded: ${formatDecimal(metrics.domContentLoaded, 2)}ms`);
    }
    if (metrics.loadComplete) {
      devLog(`Page Load Complete: ${formatDecimal(metrics.loadComplete, 2)}ms`);
    }
    if (metrics.firstContentfulPaint) {
      devLog(`First Contentful Paint: ${formatDecimal(metrics.firstContentfulPaint, 2)}ms`);
    }
    if (metrics.largestContentfulPaint) {
      devLog(`Largest Contentful Paint: ${formatDecimal(metrics.largestContentfulPaint, 2)}ms`);
    }
    
    devLog('\n📦 Resource Metrics:');
    devLog(`Total Resources: ${metrics.totalResources}`);
    devLog(`JS Size: ${this.formatBytes(metrics.jsSize || 0)}`);
    devLog(`CSS Size: ${this.formatBytes(metrics.cssSize || 0)}`);
    devLog(`Image Size: ${this.formatBytes(metrics.imageSize || 0)}`);
    devLog(`Total Size: ${this.formatBytes(metrics.totalResourceSize || 0)}`);
    
    if (metrics.customMetrics && Object.keys(metrics.customMetrics).length > 0) {
      devLog('\n⏱️ Custom Metrics:');
      Object.entries(metrics.customMetrics).forEach(([name, duration]) => {
        devLog(`${name}: ${formatDecimal(duration, 2)}ms`);
      });
    }
    
    devGroupEnd();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${formatDecimal(value, 2)} ${sizes[i]}`;
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Helper functions
export function measureComponentRender(componentName: string): { start: () => void; end: () => void } {
  const monitor = PerformanceMonitor.getInstance();
  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;
  
  return {
    start: () => monitor.mark(startMark),
    end: () => {
      monitor.mark(endMark);
      monitor.measure(`${componentName}-render`, startMark, endMark);
    }
  };
}

export function reportWebVitals(metric: any): void {
  // Send to analytics or logging service
  devLog('Web Vital:', metric.name, metric.value);
  
  // Thresholds based on Core Web Vitals
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    'FCP': { good: 1800, needsImprovement: 3000 },
    'LCP': { good: 2500, needsImprovement: 4000 },
    'FID': { good: 100, needsImprovement: 300 },
    'CLS': { good: 0.1, needsImprovement: 0.25 },
    'TTFB': { good: 800, needsImprovement: 1800 }
  };
  
  const threshold = thresholds[metric.name];
  if (threshold) {
    let rating = 'poor';
    if (metric.value <= threshold.good) {
      rating = 'good';
    } else if (metric.value <= threshold.needsImprovement) {
      rating = 'needs improvement';
    }
    
    devLog(`${metric.name} rating: ${rating}`);
  }
}
