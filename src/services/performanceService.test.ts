/**
 * PerformanceService Tests
 * Tests for the performance monitoring service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceService } from './performanceService';

describe('PerformanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset service state
    performanceService.destroy();
    
    // Mock browser APIs with minimal setup
    global.window = {
      addEventListener: vi.fn(),
      location: { href: 'http://test.com' },
      performance: {
        now: vi.fn(() => 1000),
        timing: {
          navigationStart: 0,
          responseStart: 100
        },
        mark: vi.fn(),
        measure: vi.fn(() => ({ duration: 150 }))
      }
    } as any;
    
    global.navigator = { userAgent: 'Test Browser' } as any;
    global.document = {
      readyState: 'loading',
      scripts: []
    } as any;
    
    global.performance = global.window.performance;
    
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      return 1; // Don't actually call the callback to prevent infinite loops
    });
    
    // Mock PerformanceObserver
    global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    
    // Set NODE_ENV to test by default to avoid development logs
    process.env.NODE_ENV = 'test';
    
    // Mock console
    global.console.log = vi.fn();
    global.console.warn = vi.fn();
    global.console.error = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    performanceService.destroy();
  });

  describe('initialization', () => {
    it('initializes without error', () => {
      expect(() => performanceService.init()).not.toThrow();
    });

    it('initializes with callback', () => {
      const callback = vi.fn();
      expect(() => performanceService.init(callback)).not.toThrow();
    });

    it('handles server-side environment gracefully', () => {
      global.window = undefined as any;
      expect(() => performanceService.init()).not.toThrow();
      // Should not initialize in server environment
      expect(performanceService.getMetrics()).toHaveLength(0);
    });
  });

  describe('metric recording', () => {
    beforeEach(() => {
      performanceService.init();
    });

    it('records custom metrics', () => {
      performanceService.recordCustomMetric('TestMetric', 123.45);
      
      const metrics = performanceService.getMetrics();
      const customMetric = metrics.find(m => m.name === 'TestMetric');
      
      expect(customMetric).toBeDefined();
      expect(customMetric?.value).toBe(123.45);
      expect(customMetric?.rating).toBe('good');
    });

    it('maintains metric history', () => {
      performanceService.recordCustomMetric('Metric1', 100);
      performanceService.recordCustomMetric('Metric2', 200);
      
      const metrics = performanceService.getMetrics();
      // Filter out auto-recorded metrics (TTI, TTFB)
      const customMetrics = metrics.filter(m => m.name.startsWith('Metric'));
      expect(customMetrics).toHaveLength(2);
      expect(customMetrics[0].name).toBe('Metric1');
      expect(customMetrics[1].name).toBe('Metric2');
    });
  });

  describe('performance marks and measures', () => {
    beforeEach(() => {
      performanceService.init();
    });

    it('creates performance marks', () => {
      performanceService.mark('test-mark');
      
      expect(window.performance.mark).toHaveBeenCalledWith('test-mark');
    });

    it('measures between marks', () => {
      performanceService.measure('test-measure', 'start', 'end');
      
      expect(window.performance.measure).toHaveBeenCalledWith('test-measure', 'start', 'end');
      
      const metrics = performanceService.getMetrics();
      const measure = metrics.find(m => m.name === 'test-measure');
      expect(measure?.value).toBe(150);
    });

    it('handles measure errors gracefully', () => {
      window.performance.measure = vi.fn(() => {
        throw new Error('Mark not found');
      });
      
      expect(() => performanceService.measure('bad-measure', 'invalid')).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      performanceService.init();
    });

    it('returns summary with metrics and score', () => {
      performanceService.recordCustomMetric('Test1', 100);
      performanceService.recordCustomMetric('Test2', 200);
      
      const summary = performanceService.getSummary();
      
      expect(summary).toHaveProperty('metrics');
      expect(summary).toHaveProperty('score');
      expect(summary).toHaveProperty('recommendations');
      // Should have our 2 custom metrics plus any auto-recorded ones
      const customMetrics = summary.metrics.filter(m => m.name.startsWith('Test'));
      expect(customMetrics).toHaveLength(2);
    });

    it('returns latest value for duplicate metrics', () => {
      // Record first metric
      performanceService.recordCustomMetric('DupeMetric', 100);
      
      // Mock Date.now to ensure second metric has later timestamp
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => originalDateNow() + 1000);
      
      // Record second metric with same name
      performanceService.recordCustomMetric('DupeMetric', 200);
      
      // Restore Date.now
      Date.now = originalDateNow;
      
      const metrics = performanceService.getMetrics();
      const dupeMetrics = metrics.filter(m => m.name === 'DupeMetric');
      // Should have both values in history
      expect(dupeMetrics).toHaveLength(2);
      
      const summary = performanceService.getSummary();
      const summaryMetric = summary.metrics.find(m => m.name === 'DupeMetric');
      
      // Summary should have the latest value (the second one we recorded)
      expect(summaryMetric).toBeDefined();
      expect(summaryMetric?.value).toBe(200);
    });

    it('calculates score between 0 and 100', () => {
      performanceService.recordCustomMetric('LCP', 2000);
      performanceService.recordCustomMetric('FID', 50);
      
      const summary = performanceService.getSummary();
      
      expect(summary.score).toBeGreaterThanOrEqual(0);
      expect(summary.score).toBeLessThanOrEqual(100);
    });
  });

  describe('exportMetrics', () => {
    beforeEach(() => {
      global.navigator.connection = {} as any;
      performanceService.init();
    });

    it('exports metrics with metadata', () => {
      performanceService.recordCustomMetric('Export1', 100);
      performanceService.recordCustomMetric('Export2', 200);
      
      const exported = performanceService.exportMetrics();
      
      expect(exported).toHaveProperty('metrics');
      expect(exported).toHaveProperty('summary');
      expect(exported).toHaveProperty('timestamp');
      expect(exported).toHaveProperty('url');
      expect(exported).toHaveProperty('userAgent');
      expect(exported).toHaveProperty('connection');
      
      // Should have our 2 custom metrics plus any auto-recorded ones
      const customMetrics = exported.metrics.filter(m => m.name.startsWith('Export'));
      expect(customMetrics).toHaveLength(2);
      expect(exported.url).toBe('http://test.com');
      expect(exported.userAgent).toBe('Test Browser');
    });
  });

  describe('clear and destroy', () => {
    beforeEach(() => {
      performanceService.init();
    });

    it('clears all metrics', () => {
      performanceService.recordCustomMetric('Test1', 100);
      performanceService.recordCustomMetric('Test2', 200);
      
      const metrics = performanceService.getMetrics();
      const customMetrics = metrics.filter(m => m.name.startsWith('Test'));
      expect(customMetrics).toHaveLength(2);
      
      performanceService.clear();
      
      expect(performanceService.getMetrics()).toHaveLength(0);
    });

    it('destroys service and clears state', () => {
      performanceService.recordCustomMetric('Test', 100);
      
      performanceService.destroy();
      
      expect(performanceService.getMetrics()).toHaveLength(0);
    });

    it('prevents operations after destroy', () => {
      performanceService.destroy();
      
      // Re-init should work
      expect(() => performanceService.init()).not.toThrow();
    });
  });

  describe('development mode logging', () => {

    it('logs in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      vi.clearAllMocks();
      performanceService.destroy();
      performanceService.init();
      
      // Should log TTFB in development mode during init
      const logCalls = (console.log as any).mock.calls;
      const ttfbLog = logCalls.find((call: any[]) => 
        call[0]?.includes('[Performance]') && call[0]?.includes('TTFB')
      );
      
      expect(ttfbLog).toBeDefined();
      expect(ttfbLog[0]).toMatch(/\[Performance\] TTFB: \d+ms \(good\)/);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('does not log custom metrics in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      vi.clearAllMocks();
      performanceService.destroy();
      performanceService.init();
      
      // In production, TTFB should not be logged
      const logs = (console.log as any).mock.calls;
      const hasPerformanceLog = logs.some((call: any[]) => 
        call[0]?.includes('[Performance]')
      );
      
      expect(hasPerformanceLog).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('edge cases', () => {
    it('handles missing window.performance gracefully', () => {
      // Reset and create window without performance
      performanceService.destroy();
      
      // Save original values
      const originalPerformance = global.performance;
      const originalWindow = global.window;
      
      // Create a minimal window without performance
      global.window = {
        addEventListener: vi.fn(),
        location: { href: 'http://test.com' }
      } as any;
      
      // Mock global performance with minimal implementation
      Object.defineProperty(global, 'performance', {
        configurable: true,
        value: {
          now: vi.fn(() => 1000),
          mark: vi.fn(),
          measure: vi.fn(() => ({ duration: 100 }))
        }
      });
      
      // Service should handle missing performance gracefully
      expect(() => performanceService.init()).not.toThrow();
      
      // The service should still initialize without errors
      
      // Restore for other tests
      global.performance = originalPerformance;
      global.window = originalWindow;
    });

    it('handles invalid metric values', () => {
      performanceService.init();
      
      performanceService.recordCustomMetric('Invalid', NaN);
      performanceService.recordCustomMetric('Negative', -100);
      
      const metrics = performanceService.getMetrics();
      const customMetrics = metrics.filter(m => 
        m.name === 'Invalid' || m.name === 'Negative'
      );
      expect(customMetrics).toHaveLength(2);
      
      // Find our specific metrics
      const invalidMetric = metrics.find(m => m.name === 'Invalid');
      const negativeMetric = metrics.find(m => m.name === 'Negative');
      
      // NaN should be stored as NaN
      expect(invalidMetric?.value).toBeNaN();
      // Negative values should be preserved
      expect(negativeMetric?.value).toBe(-100);
    });

    it('handles empty metric names', () => {
      performanceService.init();
      
      performanceService.recordCustomMetric('', 100);
      
      const metrics = performanceService.getMetrics();
      const emptyNameMetrics = metrics.filter(m => m.name === '');
      expect(emptyNameMetrics).toHaveLength(1);
      expect(emptyNameMetrics[0].name).toBe('');
    });

    it('handles PerformanceObserver not supported', () => {
      global.PerformanceObserver = undefined as any;
      expect(() => performanceService.init()).not.toThrow();
    });

    it('simulates window load event', () => {
      performanceService.init();
      
      // Check that addEventListener was called
      expect(window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
      
      // Simulate the load event
      const loadHandler = (window.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'load'
      )?.[1];
      
      if (loadHandler) {
        loadHandler();
        
        // Should record TTI metric
        const metrics = performanceService.getMetrics();
        const ttiMetric = metrics.find(m => m.name === 'TTI');
        expect(ttiMetric).toBeDefined();
        expect(ttiMetric?.value).toBe(1000); // mocked performance.now value
      }
    });

    it('handles document already loaded', () => {
      performanceService.destroy();
      global.document.readyState = 'complete';
      performanceService.init();
      
      // Should record TTI immediately
      const metrics = performanceService.getMetrics();
      const ttiMetric = metrics.find(m => m.name === 'TTI');
      expect(ttiMetric).toBeDefined();
      expect(ttiMetric?.value).toBe(1000);
    });
  });
});