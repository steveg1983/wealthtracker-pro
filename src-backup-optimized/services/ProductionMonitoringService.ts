/**
 * Production Monitoring Service - Phase 8
 * Comprehensive monitoring and observability for production deployment
 */

import { lazyLogger as logger } from './serviceFactory';
import { errorTaxonomyService, ErrorSeverity, type CategorizedError } from './ErrorTaxonomyService';
import { captureException, captureMessage } from '../lib/sentry';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: boolean;
    authentication: boolean;
    storage: boolean;
    externalApis: boolean;
  };
  responseTime: number;
  version: string;
}

interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

interface UserAnalytics {
  sessionId: string;
  userId?: string;
  pageViews: number;
  sessionDuration: number;
  errorCount: number;
  features: string[];
  deviceInfo: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
  };
}

/**
 * Production Monitoring Service
 */
export class ProductionMonitoringService {
  private sessionId: string;
  private sessionStartTime: number;
  private pageViews: number = 0;
  private errorCount: number = 0;
  private featureUsage = new Set<string>();
  private isProduction: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.isProduction = this.detectEnvironment();
    this.initializeMonitoring();
  }

  /**
   * Initialize production monitoring
   */
  private initializeMonitoring(): void {
    if (!this.isProduction) {
      logger.debug('Development mode - limited monitoring enabled');
      return;
    }

    // Set up global error tracking
    this.setupGlobalErrorTracking();

    // Monitor performance metrics
    this.setupPerformanceMonitoring();

    // Set up health check endpoint
    this.setupHealthChecks();

    // Track user analytics
    this.setupUserAnalytics();

    logger.info('Production monitoring initialized', {
      sessionId: this.sessionId,
      environment: this.isProduction ? 'production' : 'development'
    });
  }

  /**
   * Set up global error tracking
   */
  private setupGlobalErrorTracking(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = new Error(event.reason?.message || 'Unhandled promise rejection');
      this.trackError(error, {
        type: 'unhandledRejection',
        reason: event.reason
      });
    });

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError(event.error || new Error(event.message), {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        this.trackError(new Error('Resource loading failed'), {
          type: 'resourceError',
          resource: (event.target as any).src || (event.target as any).href
        });
      }
    }, true);
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    // Core Web Vitals monitoring
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry) => {
        this.trackPerformanceMetric(entry.name, entry.startTime, {
          entryType: entry.entryType,
          duration: entry.duration
        });
      });
    });

    observer.observe({
      entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift']
    });

    // Page load timing
    window.addEventListener('load', () => {
      const timing = performance.timing;
      const pageLoadTime = timing.loadEventEnd - timing.navigationStart;

      this.trackPerformanceMetric('page-load-complete', pageLoadTime, {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart
      });
    });
  }

  /**
   * Set up health checks
   */
  private setupHealthChecks(): void {
    // Register health check endpoint
    if (typeof window !== 'undefined') {
      (window as any).__healthCheck = () => this.performHealthCheck();
    }

    // Periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Set up user analytics
   */
  private setupUserAnalytics(): void {
    // Track page views
    this.trackPageView();

    // Track feature usage
    this.trackFeatureUsage('app-start');

    // Device and browser detection
    const deviceInfo = this.detectDeviceInfo();
    logger.debug('Device info detected:', deviceInfo);
  }

  /**
   * Track an error with comprehensive context
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    this.errorCount++;

    // Use our error taxonomy for categorization
    const categorizedError = errorTaxonomyService.processError(error, {
      sessionId: this.sessionId,
      pageViews: this.pageViews,
      sessionDuration: Date.now() - this.sessionStartTime,
      ...context
    });

    // Send to Sentry based on severity
    if (categorizedError.severity === ErrorSeverity.HIGH || categorizedError.severity === ErrorSeverity.CRITICAL) {
      captureException(error, {
        tags: {
          category: categorizedError.category,
          severity: categorizedError.severity,
          errorCode: categorizedError.errorCode,
          sessionId: this.sessionId
        },
        contexts: {
          errorTaxonomy: {
            userMessage: categorizedError.userMessage,
            recoveryAction: categorizedError.recoveryAction,
            category: categorizedError.category
          },
          session: {
            sessionId: this.sessionId,
            pageViews: this.pageViews,
            errorCount: this.errorCount,
            sessionDuration: Date.now() - this.sessionStartTime
          }
        }
      });
    }

    // Log locally for development
    logger.error('Production error tracked:', {
      errorCode: categorizedError.errorCode,
      category: categorizedError.category,
      severity: categorizedError.severity,
      userMessage: categorizedError.userMessage
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformanceMetric(
    metricName: string,
    value: number,
    context?: Record<string, unknown>
  ): void {
    // Send to monitoring service
    if (this.isProduction) {
      captureMessage(`Performance: ${metricName}`, 'info', {
        metric: metricName,
        value,
        sessionId: this.sessionId,
        ...context
      });
    }

    // Check against performance targets
    this.validatePerformanceTarget(metricName, value);

    logger.debug('Performance metric tracked:', {
      metric: metricName,
      value,
      context
    });
  }

  /**
   * Track page view
   */
  trackPageView(route?: string): void {
    this.pageViews++;

    const pageData = {
      route: route || window.location.pathname,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      pageNumber: this.pageViews
    };

    if (this.isProduction) {
      captureMessage('Page view', 'info');
    }

    logger.debug('Page view tracked:', pageData);
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, context?: Record<string, unknown>): void {
    this.featureUsage.add(feature);

    if (this.isProduction) {
      captureMessage(`Feature used: ${feature}`, 'info');
    }

    logger.debug('Feature usage tracked:', { feature, context });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    const checks = {
      database: await this.checkDatabase(),
      authentication: await this.checkAuthentication(),
      storage: await this.checkStorage(),
      externalApis: await this.checkExternalApis()
    };

    const allHealthy = Object.values(checks).every(Boolean);
    const responseTime = performance.now() - startTime;

    const result: HealthCheckResult = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      checks,
      responseTime,
      version: this.getAppVersion()
    };

    // Alert on unhealthy status
    if (!allHealthy) {
      this.trackError(new Error('Health check failed'), {
        healthCheck: result
      });
    }

    return result;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      // Basic connectivity test
      const response = await fetch('/api/health/database');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check authentication service
   */
  private async checkAuthentication(): Promise<boolean> {
    try {
      // Check if Clerk is accessible
      return typeof window !== 'undefined' && !!(window as any).Clerk;
    } catch {
      return false;
    }
  }

  /**
   * Check local storage functionality
   */
  private async checkStorage(): Promise<boolean> {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return retrieved === 'test';
    } catch {
      return false;
    }
  }

  /**
   * Check external API connectivity
   */
  private async checkExternalApis(): Promise<boolean> {
    try {
      // Test a simple API call
      const response = await fetch('/api/health/external');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate performance against targets
   */
  private validatePerformanceTarget(metricName: string, value: number): void {
    const targets: Record<string, number> = {
      'first-contentful-paint': 2000,
      'largest-contentful-paint': 2500,
      'first-input-delay': 100,
      'cumulative-layout-shift': 0.1,
      'page-load-complete': 3000
    };

    const target = targets[metricName];
    if (target && value > target) {
      logger.warn('Performance target missed:', {
        metric: metricName,
        value,
        target,
        overage: value - target
      });

      // Track performance issues
      this.trackError(new Error(`Performance target missed: ${metricName}`), {
        metric: metricName,
        value,
        target
      });
    }
  }

  /**
   * Get application version
   */
  private getAppVersion(): string {
    return process.env.npm_package_version || '1.4.5';
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect if running in production
   */
  private detectEnvironment(): boolean {
    return import.meta.env.MODE === 'production' ||
           import.meta.env.VITE_APP_ENV === 'production';
  }

  /**
   * Detect device information
   */
  private detectDeviceInfo(): {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
  } {
    const userAgent = navigator.userAgent;
    const width = window.innerWidth;

    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    if (width < 768) deviceType = 'mobile';
    else if (width < 1024) deviceType = 'tablet';

    let os = 'Unknown';
    if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return { type: deviceType, os, browser };
  }

  /**
   * Get production readiness report
   */
  getProductionReadinessReport(): {
    environment: string;
    monitoring: boolean;
    errorTracking: boolean;
    performanceTracking: boolean;
    healthChecks: boolean;
    sessionInfo: {
      sessionId: string;
      duration: number;
      pageViews: number;
      errorCount: number;
      featuresUsed: number;
    };
  } {
    return {
      environment: this.isProduction ? 'production' : 'development',
      monitoring: true,
      errorTracking: this.isProduction,
      performanceTracking: true,
      healthChecks: true,
      sessionInfo: {
        sessionId: this.sessionId,
        duration: Date.now() - this.sessionStartTime,
        pageViews: this.pageViews,
        errorCount: this.errorCount,
        featuresUsed: this.featureUsage.size
      }
    };
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): Array<{
    type: 'error' | 'performance' | 'security' | 'availability';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
  }> {
    const alerts = [];

    // Check error rate
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000 / 60; // minutes
    const errorRate = this.errorCount / Math.max(sessionDuration, 1);

    if (errorRate > 1) { // More than 1 error per minute
      alerts.push({
        type: 'error' as const,
        message: `High error rate detected: ${errorRate.toFixed(2)} errors/minute`,
        severity: 'critical' as const,
        timestamp: new Date()
      });
    }

    // Check session duration (potential performance issues)
    if (sessionDuration > 30 && this.pageViews < 3) {
      alerts.push({
        type: 'performance' as const,
        message: 'Long session with low page views - potential performance issue',
        severity: 'medium' as const,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Export session data for analysis
   */
  exportSessionData(): UserAnalytics {
    return {
      sessionId: this.sessionId,
      pageViews: this.pageViews,
      sessionDuration: Date.now() - this.sessionStartTime,
      errorCount: this.errorCount,
      features: Array.from(this.featureUsage),
      deviceInfo: this.detectDeviceInfo()
    };
  }

  /**
   * Graceful shutdown for production
   */
  shutdown(): void {
    // Send final session data
    if (this.isProduction) {
      captureMessage('Session ended', 'info');
    }

    logger.info('Production monitoring shutdown', {
      sessionId: this.sessionId,
      finalStats: this.exportSessionData()
    });
  }
}

/**
 * Health Check API endpoint
 */
export async function healthCheckEndpoint(): Promise<HealthCheckResult> {
  return productionMonitoring.performHealthCheck();
}

/**
 * Create monitoring dashboard widget
 */
export function createMonitoringWidget(): {
  status: string;
  alerts: number;
  uptime: string;
} {
  const report = productionMonitoring.getProductionReadinessReport();
  const alerts = productionMonitoring.getCriticalAlerts();

  return {
    status: alerts.some(a => a.severity === 'critical') ? 'critical' :
            alerts.some(a => a.severity === 'high') ? 'warning' : 'healthy',
    alerts: alerts.length,
    uptime: Math.round(report.sessionInfo.duration / 1000 / 60) + 'm'
  };
}

// Export singleton instance
export const productionMonitoring = new ProductionMonitoringService();

// Set up shutdown handler
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    productionMonitoring.shutdown();
  });
}