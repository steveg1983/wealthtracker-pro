import { logger } from './loggingService';
/**
 * Performance Monitoring Service
 * Tracks Core Web Vitals, custom metrics, and provides performance insights
 */

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

class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private observer: PerformanceObserver | null = null;
  private reportCallback: ((report: PerformanceReport) => void) | null = null;
  private isInitialized = false;

  // Core Web Vitals thresholds
  private readonly thresholds = {
    LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
    FID: { good: 100, poor: 300 },   // First Input Delay (ms)
    CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
    FCP: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
    TTFB: { good: 800, poor: 1800 }, // Time to First Byte (ms)
    INP: { good: 200, poor: 500 },   // Interaction to Next Paint (ms)
  };

  init(callback?: (report: PerformanceReport) => void): void {
    if (this.isInitialized) return;
    
    this.reportCallback = callback || null;
    this.isInitialized = true;

    // Only run in browser environment
    if (typeof window === 'undefined') return;

    this.observeWebVitals();
    this.measureCustomMetrics();
    this.setupResourceObserver();
    this.trackBundleSize();
  }

  // Observe Core Web Vitals
  private observeWebVitals() {
    // Use web-vitals library if available, otherwise use native APIs
    if ('PerformanceObserver' in window) {
      // Observe Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.recordMetric('LCP', lastEntry.startTime, 'LCP');
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        logger.warn('LCP observer not supported');
      }

      // Observe First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-input') {
              this.recordMetric('FID', entry.processingStart - entry.startTime, 'FID');
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        logger.warn('FID observer not supported');
      }

      // Observe Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.recordMetric('CLS', clsValue, 'CLS');
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        logger.warn('CLS observer not supported');
      }

      // Observe First Contentful Paint
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.recordMetric('FCP', entry.startTime, 'FCP');
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {
        logger.warn('FCP observer not supported');
      }
    }

    // Measure Time to First Byte
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const ttfb = timing.responseStart - timing.navigationStart;
      if (ttfb > 0) {
        this.recordMetric('TTFB', ttfb, 'TTFB');
      }
    }

    // Measure Interaction to Next Paint (INP)
    if ('PerformanceEventTiming' in window) {
      let maxDuration = 0;
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        entries.forEach((entry) => {
          if (entry.duration > maxDuration) {
            maxDuration = entry.duration;
            this.recordMetric('INP', maxDuration, 'INP');
          }
        });
      });
      try {
        inpObserver.observe({ entryTypes: ['event'] });
      } catch (e) {
        logger.warn('INP observer not supported');
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

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${metric.value}ms (${rating})`);
    }

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
    // Time to Interactive (approximation)
    if (document.readyState === 'complete') {
      const tti = performance.now();
      this.recordMetric('TTI', tti, 'FCP'); // Use FCP thresholds
    } else {
      window.addEventListener('load', () => {
        const tti = performance.now();
        this.recordMetric('TTI', tti, 'FCP');
      });
    }

    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMemoryMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMemoryMB = Math.round(memory.totalJSHeapSize / 1048576);
      
      console.log(`[Performance] Memory: ${usedMemoryMB}MB / ${totalMemoryMB}MB`);
    }

    // Frame rate monitoring
    let lastTime = performance.now();
    let frames = 0;
    const checkFPS = (): void => {
      frames++;
      const currentTime = performance.now();
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        if (fps < 30) {
          logger.warn(`[Performance] Low FPS detected: ${fps}`);
        }
        frames = 0;
        lastTime = currentTime;
      }
      if (this.isInitialized) {
        requestAnimationFrame(checkFPS);
      }
    };
    requestAnimationFrame(checkFPS);
  }

  // Setup resource timing observer
  private setupResourceObserver() {
    if (!('PerformanceObserver' in window)) return;

    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const slowResources = entries.filter((entry) => entry.duration > 1000);
      
      if (slowResources.length > 0) {
        logger.warn('[Performance] Slow resources detected:', 
          slowResources.map(r => ({
            name: r.name,
            duration: Math.round(r.duration),
            type: (r as any).initiatorType
          }))
        );
      }
    });

    try {
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      logger.warn('Resource timing not supported');
    }
  }

  // Track bundle size
  private async trackBundleSize() {
    if (!('navigator' in window) || !('connection' in navigator)) return;

    // Get all script sizes
    const scripts = Array.from(document.scripts);
    const scriptSizes = await Promise.all(
      scripts
        .filter(script => script.src)
        .map(async (script) => {
          try {
            const response = await fetch(script.src, { method: 'HEAD' });
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
    const totalSizeMB = (totalSize / 1048576).toFixed(2);
    
    console.log(`[Performance] Total JS bundle size: ${totalSizeMB}MB`);
    
    // Warn if bundle is too large
    if (totalSize > 5 * 1048576) { // 5MB
      logger.warn('[Performance] Bundle size exceeds 5MB threshold');
    }
  }

  // Send metrics to analytics service
  private sendToAnalytics(metric: PerformanceMetric) {
    // Send to Google Analytics if available
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'performance', {
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
        url: window.location.href,
        userAgent: navigator.userAgent,
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
    performance.mark(name);
  }

  // Measure between two marks
  measure(name: string, startMark: string, endMark?: string) {
    try {
      const measure = performance.measure(name, startMark, endMark);
      this.recordCustomMetric(name, measure.duration);
    } catch (e) {
      logger.error('Performance measurement failed:', e);
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
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection || {},
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