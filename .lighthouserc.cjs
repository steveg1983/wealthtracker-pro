/**
 * Lighthouse CI Configuration
 * Configures performance budgets and CI integration
 */

module.exports = {
  ci: {
    collect: {
      // Collect Lighthouse data for these URLs
      url: [
        'http://localhost:4173/', // Preview server
        'http://localhost:4173/transactions',
        'http://localhost:4173/budget',
        'http://localhost:4173/analytics',
        'http://localhost:4173/reports',
        'http://localhost:4173/goals',
      ],
      // Number of times to run Lighthouse for each URL
      numberOfRuns: 3,
      // Settings for Lighthouse collection
      settings: {
        // Use mobile simulation
        preset: 'desktop',
        // Chrome flags for consistent results
        chromeFlags: '--no-sandbox --headless --disable-gpu',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      // Performance budgets
      assertions: {
        // Core Web Vitals thresholds
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Specific metrics
        'metrics:largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'metrics:first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'metrics:speed-index': ['warn', { maxNumericValue: 3000 }],
        'metrics:interactive': ['warn', { maxNumericValue: 3800 }],
        'metrics:cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'metrics:total-blocking-time': ['warn', { maxNumericValue: 300 }],
        
        // Resource size budgets
        'resource-summary:document:size': ['warn', { maxNumericValue: 50000 }], // 50KB
        'resource-summary:script:size': ['warn', { maxNumericValue: 1000000 }], // 1MB
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:font:size': ['warn', { maxNumericValue: 200000 }], // 200KB
        
        // Network requests
        'resource-summary:total:count': ['warn', { maxNumericValue: 100 }],
        'resource-summary:script:count': ['warn', { maxNumericValue: 20 }],
        'resource-summary:stylesheet:count': ['warn', { maxNumericValue: 10 }],
        
        // Security
        'uses-https': 'error',
        'redirects-http': 'error',
        
        // Best practices
        'errors-in-console': 'warn',
        'no-vulnerable-libraries': 'error',
        'charset': 'error',
        'doctype': 'error',
        'valid-lang': 'error',
      },
    },
  },
};