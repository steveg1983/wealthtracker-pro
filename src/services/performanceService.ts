/**
 * Performance Monitoring Service
 * Tracks Core Web Vitals, custom metrics, and provides performance insights
 */

import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger } from '../loggers/scopedLogger';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  timestamp: number;
  url: string;
  userAgent: string;
}

interface WindowRef extends Partial<Window> {
  PerformanceObserver?: typeof PerformanceObserver;
  PerformanceEventTiming?: typeof PerformanceEventTiming;
  gtag?: (...args: unknown[]) => void;
}

interface DocumentRef extends Partial<Document> {
  scripts?: HTMLCollectionOf<HTMLScriptElement>;
}

interface NavigatorRef extends Partial<Navigator> {
  connection?: unknown;
}

export interface PerformanceServiceOptions {
  windowRef?: WindowRef | null;
  documentRef?: DocumentRef | null;
  navigatorRef?: NavigatorRef | null;
  performanceRef?: Performance | null;
  requestAnimationFrameFn?: typeof requestAnimationFrame;
  consoleRef?: Pick<Console, 'log' | 'warn' | 'error'>;
  fetchFn?: typeof fetch;
}

export class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private observer: PerformanceObserver | null = null;
  private reportCallback: ((report: PerformanceReport) => void) | null = null;
  private isInitialized = false;
  private windowRef: WindowRef | null;
  private documentRef: DocumentRef | null;
  private navigatorRef: NavigatorRef | null;
  private performanceRef: Performance | null;
  private requestAnimationFrameFn: typeof requestAnimationFrame;
  private consoleRef: Pick<Console, 'log' | 'warn' | 'error'>;
  private fetchFn: typeof fetch;
  private logger = createScopedLogger('PerformanceService');

  // Core Web Vitals thresholds
  private readonly thresholds = {
    LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
    FID: { good: 100, poor: 300 },   // First Input Delay (ms)
    CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
    FCP: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
    TTFB: { good: 800, poor: 1800 }, // Time to First Byte (ms)
    INP: { good: 200, poor: 500 },   // Interaction to Next Paint (ms)
  };

  constructor(options: PerformanceServiceOptions = {}) {
    this.windowRef = options.windowRef ?? (typeof window !== 'undefined' ? window : null);
    this.documentRef = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
    this.navigatorRef = options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
    this.performanceRef = options.performanceRef ?? (typeof performance !== 'undefined' ? performance : null);
    this.requestAnimationFrameFn =
      options.requestAnimationFrameFn ??
      ((typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16)) as typeof requestAnimationFrame);
    this.consoleRef = options.consoleRef ?? console;
    this.fetchFn = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : (async () => new Response()) as unknown as typeof fetch);
  }

  init(callback?: (report: PerformanceReport) => void): void {
    if (this.isInitialized) return;
    
    this.reportCallback = callback || null;
    this.isInitialized = true;

    if (!this.windowRef) return;

    this.observeWebVitals();
    this.measureCustomMetrics();
    this.setupResourceObserver();
    this.trackBundleSize();
  }

  // Observe Core Web Vitals
  private observeWebVitals() {
    // Use web-vitals library if available, otherwise use native APIs
    if (this.windowRef?.PerformanceObserver) {
      // Observe Largest Contentful Paint
      try {
        const lcpObserver = new this.windowRef.PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry | undefined;
          if (lastEntry) {
            this.recordMetric('LCP', lastEntry.startTime, 'LCP');
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch {
        this.logger.warn?.('LCP observer not supported');
      }

      // Observe First Input Delay
      try {
        const fidObserver = new this.windowRef.PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-input' && 'processingStart' in entry) {
              const perfEntry = entry as PerformanceEventTiming;
              this.recordMetric('FID', perfEntry.processingStart - perfEntry.startTime, 'FID');
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch {
        this.logger.warn?.('FID observer not supported');
      }

      // Observe Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new this.windowRef.PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!layoutEntry.hadRecentInput && typeof layoutEntry.value === 'number') {
              clsValue += layoutEntry.value;
            }
          }
          this.recordMetric('CLS', clsValue, 'CLS');
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch {
        this.logger.warn?.('CLS observer not supported');
      }

      // Observe First Contentful Paint
      try {
        const fcpObserver = new this.windowRef.PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.recordMetric('FCP', entry.startTime, 'FCP');
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch {
        this.logger.warn?.('FCP observer not supported');
      }
    }

    // Measure Time to First Byte
    if (this.performanceRef?.timing) {
      const timing = this.performanceRef.timing;
      const ttfb = timing.responseStart - timing.navigationStart;
      if (ttfb > 0) {
        this.recordMetric('TTFB', ttfb, 'TTFB');
      }
    }

    // Measure Interaction to Next Paint (INP)
    if (this.windowRef && 'PerformanceEventTiming' in this.windowRef && this.windowRef.PerformanceObserver) {
      let maxDuration = 0;
      const inpObserver = new this.windowRef.PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const duration = (entry as PerformanceEntry & { duration?: number }).duration;
          if (typeof duration === 'number' && duration > maxDuration) {
            maxDuration = duration;
            this.recordMetric('INP', maxDuration, 'INP');
          }
        });
      });
      try {
        inpObserver.observe({ entryTypes: ['event'] });
      } catch {
        this.logger.warn?.('INP observer not supported');
      }
    }
  }

  // Record a performance metric
  private recordMetric(name: string, value: number, type: keyof typeof this.thresholds) {
    const rating = this.getRating(value, type);
    const metric: PerformanceMetric = {
      name,
      value: Math.round(value),
      rating,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    this.logger.info?.(`[Performance] ${name}: ${metric.value}ms (${rating})`);

    // Send metric to analytics if configured
    this.sendToAnalytics(metric);
  }

  // Get rating based on thresholds
  private getRating(value: number, type: keyof typeof this.thresholds): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[type];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  // Measure custom metrics
  private measureCustomMetrics() {
    // Helper to safely call performance.now() with proper context
    const getNow = (): number => {
      if (this.performanceRef?.now) {
        // Use call() to preserve proper 'this' context for native API
        return this.performanceRef.now.call(this.performanceRef);
      }
      return Date.now();
    };

    // Helper to safely call requestAnimationFrame with proper context
    const safeRAF = (callback: FrameRequestCallback): void => {
      if (this.windowRef && 'requestAnimationFrame' in this.windowRef) {
        // Call directly on window to preserve context
        (this.windowRef as Window).requestAnimationFrame(callback);
      } else {
        setTimeout(() => callback(Date.now()), 16);
      }
    };

    // Time to Interactive (approximation)
    if (this.documentRef?.readyState === 'complete') {
      const tti = getNow();
      this.recordMetric('TTI', tti, 'FCP'); // Use FCP thresholds
    } else {
      this.windowRef?.addEventListener?.('load', () => {
        const tti = getNow();
        this.recordMetric('TTI', tti, 'FCP');
      });
    }

    // Memory usage (if available)
    if (this.performanceRef && 'memory' in this.performanceRef) {
      const memory = (this.performanceRef as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      if (memory) {
        const usedMemoryMB = Math.round(memory.usedJSHeapSize / 1048576);
        const totalMemoryMB = Math.round(memory.totalJSHeapSize / 1048576);
      
        this.logger.info?.(`[Performance] Memory: ${usedMemoryMB}MB / ${totalMemoryMB}MB`);
      }
    }

    // Frame rate monitoring
    let lastTime = getNow();
    let frames = 0;
    const checkFPS = (): void => {
      frames++;
      const currentTime = getNow();
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        if (fps < 30) {
          this.logger.warn?.(`[Performance] Low FPS detected: ${fps}`);
        }
        frames = 0;
        lastTime = currentTime;
      }
      if (this.isInitialized) {
        safeRAF(checkFPS);
      }
    };
    safeRAF(checkFPS);
  }

  // Setup resource timing observer
  private setupResourceObserver() {
    if (!this.windowRef?.PerformanceObserver) return;

    const resourceObserver = new this.windowRef.PerformanceObserver((list) => {
      const entries = list.getEntries();
      const slowResources = entries.filter((entry) => entry.duration > 1000);
      
      if (slowResources.length > 0) {
        this.logger.warn?.('[Performance] Slow resources detected', 
          slowResources.map(r => ({
            name: r.name,
            duration: Math.round(r.duration),
            type: (r as PerformanceResourceTiming).initiatorType
          }))
        );
      }
    });

    try {
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch {
      this.logger.warn?.('Resource timing not supported');
    }
  }

  // Track bundle size
  private async trackBundleSize() {
    if (!this.navigatorRef?.connection) return;

    // Get all script sizes
    const scriptsCollection = this.documentRef?.scripts;
    if (!scriptsCollection) return;
    const scripts = Array.from(scriptsCollection);
    const scriptSizes = await Promise.all(
      scripts
        .filter(script => script.src)
        .map(async (script) => {
          try {
            const response = await this.fetchFn(script.src, { method: 'HEAD' });
            const size = response.headers.get('content-length');
            return {
              url: script.src,
              size: size ? parseInt(size) : 0
            };
          } catch {
            return { url: script.src, size: 0 };
          }
        })
    );

    const totalSize = scriptSizes.reduce((sum, s) => sum + s.size, 0);
    const totalSizeMB = formatDecimal(totalSize / 1048576, 2);
    
    this.logger.info?.(`[Performance] Total JS bundle size: ${totalSizeMB}MB`);
    
    // Warn if bundle is too large
    if (totalSize > 5 * 1048576) { // 5MB
      this.logger.warn?.('[Performance] Bundle size exceeds 5MB threshold');
    }
  }

  // Send metrics to analytics service
  private sendToAnalytics(metric: PerformanceMetric) {
    // Send to Google Analytics if available
    if (this.windowRef?.gtag) {
      this.windowRef.gtag('event', 'performance', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
      });
    }

    // Custom callback
    if (this.reportCallback) {
      const report: PerformanceReport = {
        metrics: [metric],
        timestamp: Date.now(),
        url: this.windowRef?.location?.href ?? '',
        userAgent: this.navigatorRef?.userAgent ?? ''
      };
      this.reportCallback(report);
    }
  }

  // Public API

  // Get all collected metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get latest metrics summary
  getSummary() {
    const latestMetrics: Record<string, PerformanceMetric> = {};
    
    // Get the latest value for each metric type
    this.metrics.forEach(metric => {
      if (!latestMetrics[metric.name] || 
          metric.timestamp > latestMetrics[metric.name].timestamp) {
        latestMetrics[metric.name] = metric;
      }
    });

    return {
      metrics: Object.values(latestMetrics),
      score: this.calculatePerformanceScore(latestMetrics),
      recommendations: this.getRecommendations(latestMetrics),
    };
  }

  // Calculate overall performance score (0-100)
  private calculatePerformanceScore(metrics: Record<string, PerformanceMetric>): number {
    const weights = {
      LCP: 0.25,
      FID: 0.25,
      CLS: 0.25,
      FCP: 0.15,
      TTFB: 0.10,
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([metricName, weight]) => {
      const metric = metrics[metricName];
      if (metric) {
        const score = metric.rating === 'good' ? 100 : 
                     metric.rating === 'needs-improvement' ? 50 : 0;
        totalScore += score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  // Get performance recommendations
  private getRecommendations(metrics: Record<string, PerformanceMetric>): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (metrics.LCP?.rating !== 'good') {
      recommendations.push('Optimize largest contentful paint: Consider lazy loading images, optimizing server response time, and using a CDN');
    }

    // FID recommendations
    if (metrics.FID?.rating !== 'good') {
      recommendations.push('Improve first input delay: Break up long tasks, use web workers, and optimize JavaScript execution');
    }

    // CLS recommendations
    if (metrics.CLS?.rating !== 'good') {
      recommendations.push('Reduce layout shift: Set size attributes on images/videos, avoid inserting content above existing content');
    }

    // FCP recommendations
    if (metrics.FCP?.rating !== 'good') {
      recommendations.push('Speed up first contentful paint: Minimize render-blocking resources, inline critical CSS');
    }

    // TTFB recommendations
    if (metrics.TTFB?.rating !== 'good') {
      recommendations.push('Reduce server response time: Use caching, optimize database queries, consider a CDN');
    }

    return recommendations;
  }

  // Manual metric recording
  recordCustomMetric(name: string, value: number) {
    this.metrics.push({
      name,
      value,
      rating: 'good', // Custom metrics don't have ratings
      timestamp: Date.now(),
    });
  }

  // Mark for specific user interactions
  mark(name: string) {
    this.performanceRef?.mark(name);
  }

  // Measure between two marks
  measure(name: string, startMark: string, endMark?: string) {
    try {
      if (!this.performanceRef?.measure) return;
      const measure = this.performanceRef.measure(name, startMark, endMark);
      this.recordCustomMetric(name, measure.duration);
    } catch (e) {
      this.consoleRef.error('Performance measurement failed:', e);
    }
  }

  // Clear all metrics
  clear() {
    this.metrics = [];
  }

  // Export metrics for external analysis
  exportMetrics() {
    return {
      metrics: this.getMetrics(),
      summary: this.getSummary(),
      timestamp: Date.now(),
      url: this.windowRef?.location?.href ?? '',
      userAgent: this.navigatorRef?.userAgent ?? '',
      connection: (this.navigatorRef as Navigator & { connection?: unknown })?.connection || {},
    };
  }

  // Destroy service
  destroy() {
    this.isInitialized = false;
    this.observer?.disconnect();
    this.clear();
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();
