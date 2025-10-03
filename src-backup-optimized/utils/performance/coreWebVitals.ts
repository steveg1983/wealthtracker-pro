/**
 * Core Web Vitals Monitoring - Phase 8.5
 * Real-time Web Vitals tracking with optimization recommendations
 */

import { lazyLogger as logger } from '../../services/serviceFactory';
import { productionMonitoring } from '../../services/ProductionMonitoringService';

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTimingEntry extends PerformanceEntry {
  processingStart?: number;
  startTime: number;
}

interface PerformanceNavigationEntry extends PerformanceEntry {
  responseStart?: number;
  requestStart?: number;
}

const isPerformanceEventTiming = (entry: PerformanceEntry): entry is PerformanceEventTimingEntry => {
  return 'processingStart' in entry;
};

const isLayoutShiftEntry = (entry: PerformanceEntry): entry is LayoutShiftEntry => {
  return 'value' in entry && 'hadRecentInput' in entry;
};

const isNavigationTimingEntry = (entry: PerformanceEntry): entry is PerformanceNavigationEntry => {
  return 'responseStart' in entry && 'requestStart' in entry;
};

interface WebVital {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'TTI';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface WebVitalsReport {
  vitals: WebVital[];
  overallScore: number;
  recommendations: string[];
  lastUpdated: Date;
}

// Web Vitals thresholds (Google standards)
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  TTI: { good: 3800, poor: 7300 }
} as const;

/**
 * Core Web Vitals Monitor
 */
export class CoreWebVitalsMonitor {
  private vitals: WebVital[] = [];
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;

  /**
   * Initialize Web Vitals monitoring
   */
  initialize(): void {
    if (this.isInitialized || typeof PerformanceObserver === 'undefined') return;

    this.setupFCPMonitoring();
    this.setupLCPMonitoring();
    this.setupFIDMonitoring();
    this.setupCLSMonitoring();
    this.setupTTFBMonitoring();
    this.setupNavigationTiming();

    this.isInitialized = true;
    logger.info('Core Web Vitals monitoring initialized');
  }

  /**
   * First Contentful Paint monitoring
   */
  private setupFCPMonitoring(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.recordVital('FCP', entry.startTime);
        }
      });
    });

    observer.observe({ entryTypes: ['paint'] });
    this.observers.push(observer);
  }

  /**
   * Largest Contentful Paint monitoring
   */
  private setupLCPMonitoring(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.recordVital('LCP', entry.startTime);
      });
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(observer);
  }

  /**
   * First Input Delay monitoring
   */
  private setupFIDMonitoring(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (isPerformanceEventTiming(entry) && entry.processingStart && entry.startTime) {
          const fid = entry.processingStart - entry.startTime;
          this.recordVital('FID', fid);
        }
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
    this.observers.push(observer);
  }

  /**
   * Cumulative Layout Shift monitoring
   */
  private setupCLSMonitoring(): void {
    let clsScore = 0;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (isLayoutShiftEntry(entry) && !entry.hadRecentInput) {
          clsScore += entry.value;
          this.recordVital('CLS', clsScore);
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(observer);
  }

  /**
   * Time to First Byte monitoring
   */
  private setupTTFBMonitoring(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (isNavigationTimingEntry(entry) && entry.responseStart && entry.requestStart) {
          const ttfb = entry.responseStart - entry.requestStart;
          this.recordVital('TTFB', ttfb);
        }
      });
    });

    observer.observe({ entryTypes: ['navigation'] });
    this.observers.push(observer);
  }

  /**
   * Navigation timing for TTI estimation
   */
  private setupNavigationTiming(): void {
    window.addEventListener('load', () => {
      // Estimate Time to Interactive
      const timing = performance.timing;
      const tti = timing.domInteractive - timing.navigationStart;
      this.recordVital('TTI', tti);
    });
  }

  /**
   * Record a Web Vital measurement
   */
  private recordVital(name: WebVital['name'], value: number): void {
    const rating = this.getRating(name, value);

    const vital: WebVital = {
      name,
      value,
      rating,
      timestamp: Date.now()
    };

    // Update or add vital
    const existingIndex = this.vitals.findIndex(v => v.name === name);
    if (existingIndex >= 0) {
      this.vitals[existingIndex] = vital;
    } else {
      this.vitals.push(vital);
    }

    // Track in production monitoring
    productionMonitoring.trackPerformanceMetric(name, value, { rating });

    // Log poor performance
    if (rating === 'poor') {
      logger.warn('Poor Web Vital detected:', {
        metric: name,
        value,
        threshold: THRESHOLDS[name]?.good,
        recommendation: this.getRecommendation(name)
      });
    }
  }

  /**
   * Get rating for a Web Vital
   */
  private getRating(name: WebVital['name'], value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = THRESHOLDS[name];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get optimization recommendation for a Web Vital
   */
  private getRecommendation(name: WebVital['name']): string {
    const recommendations: Record<WebVital['name'], string> = {
      FCP: 'Optimize resource loading, reduce render-blocking resources',
      LCP: 'Optimize images, preload key resources, improve server response time',
      FID: 'Reduce main thread blocking, optimize JavaScript execution',
      CLS: 'Specify image dimensions, avoid dynamic content insertion',
      TTFB: 'Optimize server response time, use CDN, enable caching',
      TTI: 'Reduce JavaScript bundle size, optimize critical rendering path'
    };

    return recommendations[name] || 'General performance optimization needed';
  }

  /**
   * Get current Web Vitals report
   */
  getReport(): WebVitalsReport {
    const overallScore = this.calculateOverallScore();
    const recommendations = this.generateRecommendations();

    return {
      vitals: [...this.vitals],
      overallScore,
      recommendations,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculateOverallScore(): number {
    if (this.vitals.length === 0) return 0;

    const scores = this.vitals.map(vital => {
      switch (vital.rating) {
        case 'good': return 100;
        case 'needs-improvement': return 70;
        case 'poor': return 30;
      }
    });

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations = [];

    // Specific recommendations based on poor vitals
    const poorVitals = this.vitals.filter(v => v.rating === 'poor');

    if (poorVitals.length === 0) {
      recommendations.push('All Web Vitals are performing well!');
    } else {
      poorVitals.forEach(vital => {
        recommendations.push(this.getRecommendation(vital.name));
      });
    }

    // General recommendations
    if (this.vitals.some(v => v.name === 'LCP' && v.value > 2500)) {
      recommendations.push('Consider implementing image optimization and lazy loading');
    }

    if (this.vitals.some(v => v.name === 'FID' && v.value > 100)) {
      recommendations.push('Reduce JavaScript bundle size and main thread blocking');
    }

    return recommendations;
  }

  /**
   * Cleanup monitoring
   */
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isInitialized = false;
  }
}

/**
 * React hook for Web Vitals monitoring
 */
export function useWebVitalsMonitoring() {
  const monitor = new CoreWebVitalsMonitor();

  const startMonitoring = () => monitor.initialize();
  const getReport = () => monitor.getReport();
  const cleanup = () => monitor.cleanup();

  return {
    startMonitoring,
    getReport,
    cleanup
  };
}

// Export singleton instance
export const webVitalsMonitor = new CoreWebVitalsMonitor();

// Auto-initialize in production
if (typeof window !== 'undefined') {
  // Initialize after page load
  if (document.readyState === 'complete') {
    webVitalsMonitor.initialize();
  } else {
    window.addEventListener('load', () => {
      webVitalsMonitor.initialize();
    });
  }
}
