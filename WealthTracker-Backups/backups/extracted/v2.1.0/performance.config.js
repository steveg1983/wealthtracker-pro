/**
 * Performance Monitoring Configuration
 * Defines thresholds and monitoring settings for the application
 */

export const performanceConfig = {
  // Core Web Vitals thresholds (in milliseconds)
  webVitals: {
    FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
    LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
    CLS: { good: 0.1, poor: 0.25 },   // Cumulative Layout Shift (score)
    FID: { good: 100, poor: 300 },    // First Input Delay
    TTFB: { good: 800, poor: 1800 },  // Time to First Byte
    INP: { good: 200, poor: 500 },    // Interaction to Next Paint
  },

  // Bundle size budgets (in KB)
  bundleBudgets: {
    totalSize: 1000,      // 1MB total
    mainBundle: 300,      // 300KB for main bundle
    chunkSize: 200,       // 200KB per lazy-loaded chunk
    cssSize: 100,         // 100KB for all CSS
    imageSize: 500,       // 500KB for images
  },

  // Performance marks for custom metrics
  customMetrics: [
    'app-init',
    'router-ready',
    'data-loaded',
    'interactive',
    'fully-loaded',
  ],

  // Components to monitor render performance
  monitoredComponents: [
    'Dashboard',
    'TransactionList',
    'VirtualizedTransactionList',
    'SpendingByCategoryChart',
    'NetWorthTrendChart',
    'EnhancedPortfolioView',
  ],

  // API endpoints to monitor
  monitoredEndpoints: [
    { name: 'transactions', maxDuration: 1000 },
    { name: 'accounts', maxDuration: 500 },
    { name: 'budgets', maxDuration: 500 },
    { name: 'analytics', maxDuration: 2000 },
    { name: 'reports', maxDuration: 3000 },
  ],

  // Long task threshold (in milliseconds)
  longTaskThreshold: 50,

  // Memory thresholds
  memoryThresholds: {
    warning: 70,  // 70% heap usage
    critical: 90, // 90% heap usage
  },

  // Sampling rates for production monitoring
  sampling: {
    webVitals: 0.1,      // 10% of users
    customMetrics: 0.05, // 5% of users
    errors: 1.0,         // 100% of errors
  },

  // Enable/disable features
  features: {
    webVitals: true,
    customMetrics: true,
    componentProfiling: true,
    apiMonitoring: true,
    memoryMonitoring: true,
    bundleAnalysis: true,
  },

  // Reporting configuration
  reporting: {
    endpoint: process.env.VITE_PERFORMANCE_ENDPOINT || null,
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    enableConsoleLogging: process.env.NODE_ENV === 'development',
  },
};

// Helper function to check if a metric passes threshold
export const checkMetricThreshold = (metric, value, thresholds) => {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
};

// Helper to format bytes
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper to format time
export const formatTime = (ms) => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};