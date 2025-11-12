import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PerformanceOptimizationService,
  type PerformanceOptimizationServiceOptions
} from '../performanceOptimizationService';

type ObserverRecord = {
  options: PerformanceObserverInit;
  callback: (entries: any[]) => void;
};

const buildService = () => {
  const observerRecords: ObserverRecord[] = [];
  const createPerformanceObserver: PerformanceOptimizationServiceOptions['performanceObserverFactory'] =
    (callback) => ({
      observe: vi.fn((options: PerformanceObserverInit) => {
        observerRecords.push({
          options,
          callback: (entries: any[]) =>
            callback(
              {
                getEntries: () => entries
              } as PerformanceObserverEntryList,
              {} as PerformanceObserver
            )
        });
      })
    });

  const intersectionCallbacks: IntersectionObserverCallback[] = [];
  const intersectionObserver = {
    observe: vi.fn(),
    unobserve: vi.fn()
  };
  const createIntersectionObserver: PerformanceOptimizationServiceOptions['intersectionObserverFactory'] =
    (callback) => {
      intersectionCallbacks.push(callback);
      return intersectionObserver;
    };

  const images: any[] = [
    {
      dataset: { src: '/img.png' },
      removeAttribute: vi.fn()
    }
  ];

  const documentRef = {
    querySelectorAll: vi.fn(() => images),
    head: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({ rel: '', href: '' }))
  };

  const logger = { warn: vi.fn() };
  const setIntervalCallbacks: Array<() => void> = [];
  let intervalId = 1;
  const setIntervalFn = vi.fn((cb: () => void) => {
    setIntervalCallbacks.push(cb);
    return intervalId++;
  });
  const clearIntervalFn = vi.fn();
  const performanceRef: Performance & { memory: { usedJSHeapSize: number } } = {
    timeOrigin: 0,
    now: () => 0,
    toJSON: () => ({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntries: vi.fn(),
    getEntriesByName: vi.fn(),
    getEntriesByType: vi.fn(),
    memory: { usedJSHeapSize: 150 * 1024 * 1024 }
  } as unknown as Performance & { memory: { usedJSHeapSize: number } };

  const service = new PerformanceOptimizationService({
    performanceObserverFactory: createPerformanceObserver,
    intersectionObserverFactory: createIntersectionObserver,
    documentRef,
    performanceRef,
    logger,
    setIntervalFn,
    clearIntervalFn
  });

  return {
    service,
    observerRecords,
    intersectionCallbacks,
    intersectionObserver,
    documentRef,
    logger,
    setIntervalCallbacks,
    performanceRef
  };
};

describe('PerformanceOptimizationService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records core metrics via injected performance observers', () => {
    const {
      service,
      observerRecords,
      intersectionCallbacks,
      intersectionObserver,
      documentRef
    } = buildService();

    service.initialize();

    // Trigger LCP
    const lcpObserver = observerRecords.find((o) => o.options.type === 'largest-contentful-paint');
    lcpObserver?.callback([{ renderTime: 120 }]);
    expect(service.getMetrics().largestContentfulPaint).toBe(120);

    // Trigger FCP
    const fcpObserver = observerRecords.find((o) => o.options.type === 'paint');
    fcpObserver?.callback([{ name: 'first-contentful-paint', startTime: 55 }]);
    expect(service.getMetrics().firstContentfulPaint).toBe(55);

    expect(documentRef.createElement).toHaveBeenCalledTimes(3);
    expect(documentRef.head?.appendChild).toHaveBeenCalledTimes(3);
    expect(intersectionObserver.observe).toHaveBeenCalledTimes(1);

    // Simulate intersection to ensure lazy loading wiring
    intersectionCallbacks[0]?.(
      [{ isIntersecting: true, target: documentRef.querySelectorAll('')[0] }],
      intersectionObserver as unknown as IntersectionObserver
    );
    expect(intersectionObserver.unobserve).toHaveBeenCalled();
  });

  it('warns on slow interactions and high memory via injected logger', () => {
    const { service, observerRecords, logger, setIntervalCallbacks, performanceRef } = buildService();
    service.initialize();

    const fidObserver = observerRecords.find((o) => o.options.type === 'first-input');
    fidObserver?.callback([{ processingStart: 250, startTime: 0 }]);
    expect(logger.warn).toHaveBeenCalledWith('Slow interaction detected: 250ms');

    // Trigger memory polling
    performanceRef.memory.usedJSHeapSize = 200 * 1024 * 1024;
    setIntervalCallbacks[0]?.();
    expect(logger.warn).toHaveBeenCalledWith('High memory usage detected: 200MB');
  });
});
