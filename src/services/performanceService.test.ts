/**
 * PerformanceService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceService, type PerformanceServiceOptions } from './performanceService';

const createEnv = (overrides: Partial<PerformanceServiceOptions> = {}) => {
  const performanceRef = overrides.performanceRef ?? {
    now: vi.fn(() => 1000),
    timing: {
      navigationStart: 0,
      responseStart: 120
    },
    mark: vi.fn(),
    measure: vi.fn(() => ({ duration: 150 }))
  } as Performance;

  const windowRef = overrides.windowRef ?? {
    addEventListener: vi.fn(),
    location: { href: 'http://test.local' },
    PerformanceObserver: vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    })),
    PerformanceEventTiming: function () {},
    gtag: vi.fn()
  } as any;

  const documentRef = overrides.documentRef ?? ({
    readyState: 'complete',
    scripts: [] as any
  } as Document);

  const navigatorRef = overrides.navigatorRef ?? ({
    userAgent: 'TestAgent',
    connection: {}
  } as Navigator);

  const requestAnimationFrameFn =
    overrides.requestAnimationFrameFn ?? vi.fn(() => 1);

  const consoleRef = overrides.consoleRef ?? {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  const fetchFn = overrides.fetchFn ?? vi.fn(async () => new Response('', {
    headers: new Headers({ 'content-length': '0' })
  }));

  const service = new PerformanceService({
    performanceRef,
    windowRef,
    documentRef,
    navigatorRef,
    requestAnimationFrameFn,
    consoleRef,
    fetchFn
  });

  return {
    service,
    performanceRef,
    windowRef,
    documentRef,
    navigatorRef,
    requestAnimationFrameFn,
    consoleRef,
    fetchFn
  };
};

describe('PerformanceService (DI)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with injected refs and records custom metrics', () => {
    const env = createEnv();
    env.service.init();
    env.service.recordCustomMetric('Custom', 123);

    const metrics = env.service.getMetrics();
    expect(metrics.find(m => m.name === 'Custom')).toBeDefined();
  });

  it('marks and measures using injected performance object', () => {
    const env = createEnv();
    env.service.init();

    env.service.mark('test');
    expect(env.performanceRef.mark).toHaveBeenCalledWith('test');

    env.service.measure('measure', 'start', 'end');
    expect(env.performanceRef.measure).toHaveBeenCalledWith('measure', 'start', 'end');
  });

  it('exports metrics with injected window/navigator info', () => {
    const env = createEnv();
    env.service.init();
    env.service.recordCustomMetric('Export', 42);

    const exported = env.service.exportMetrics();
    expect(exported.url).toBe('http://test.local');
    expect(exported.userAgent).toBe('TestAgent');
  });
});
