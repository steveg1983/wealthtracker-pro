import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PredictiveLoadingServiceOptions, NavigationContext, UserPattern } from '../predictiveLoadingService';
import { PredictiveLoadingService } from '../predictiveLoadingService';

const smartCacheMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}));

vi.mock('../smartCacheService', () => ({
  __esModule: true,
  default: smartCacheMock
}));

const createStorageMock = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    })
  };
};

const baseContext: NavigationContext = {
  currentPath: '/dashboard',
  previousPath: undefined,
  userRole: 'admin',
  timeOfDay: 'morning',
  dayOfWeek: 1,
  isMonthEnd: false,
  recentActions: [],
  deviceType: 'desktop'
};

const createService = (overrides: PredictiveLoadingServiceOptions = {}) => {
  const storage = overrides.storage ?? createStorageMock();
  const intervalCallbacks: Array<() => void> = [];
  const intervalHandle = { id: Symbol('analytics') } as unknown as ReturnType<typeof setInterval>;
  const defaultSetInterval: typeof setInterval = vi.fn((handler: TimerHandler, timeout?: number, ...args: any[]) => {
    if (typeof handler === 'function') {
      intervalCallbacks.push(handler as () => void);
    }
    return intervalHandle;
  });
  const setIntervalSpy = overrides.setIntervalFn ?? defaultSetInterval;
  const clearIntervalSpy = overrides.clearIntervalFn ?? vi.fn<typeof clearInterval>();
  const bandwidthDetector = overrides.bandwidthDetector ?? (() => ({ effectiveType: '4g' }));
  const fetchFn = overrides.fetchFn ?? vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response)
  );

  const logger = overrides.logger ?? { warn: vi.fn() };
  const windowRef = overrides.windowRef ?? { location: { pathname: '/dashboard' }, innerWidth: 1440 };
  const nowFn = overrides.now ?? (() => new Date('2025-01-15T10:00:00Z'));

  const service = new PredictiveLoadingService({
    ...overrides,
    storage,
    setIntervalFn: setIntervalSpy,
    clearIntervalFn: clearIntervalSpy,
    bandwidthDetector,
    fetchFn,
    logger,
    windowRef,
    navigatorRef: overrides.navigatorRef ?? null,
    now: nowFn
  });

  return {
    service,
    storage,
    setIntervalSpy,
    clearIntervalSpy,
    fetchFn,
    intervalCallbacks,
    intervalHandle,
    logger
  };
};

describe('PredictiveLoadingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    smartCacheMock.get.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes default rules and schedules analytics flushing', () => {
    const { service, setIntervalSpy, intervalCallbacks } = createService();
    expect(service['rules'].size).toBeGreaterThan(0);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(30_000);
    expect(intervalCallbacks.length).toBe(1);
    service.dispose();
  });

  it('preloads prediction data and caches results', async () => {
    const { service } = createService();
    const loader = vi.fn().mockResolvedValue({ payload: 'ready' });

    smartCacheMock.get.mockResolvedValueOnce(null);
    await service.preload({
      type: 'data',
      target: 'recent-transactions',
      loader
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(smartCacheMock.set).toHaveBeenCalledWith(
      'data:recent-transactions',
      { payload: 'ready' },
      expect.objectContaining({ ttl: expect.any(Number) })
    );

    smartCacheMock.get.mockResolvedValueOnce({ payload: 'ready' });
    await service.preload({
      type: 'data',
      target: 'recent-transactions',
      loader
    });

    expect(loader).toHaveBeenCalledTimes(1);
    service.dispose();
  });

  it('records navigation patterns using the injected storage adapter', () => {
    const { service, storage } = createService();
    storage.getItem.mockReturnValueOnce(null);

    service.recordNavigation('/dashboard', '/transactions');

    expect(storage.setItem).toHaveBeenCalledWith(
      'userNavigationPatterns',
      expect.stringContaining('dashboard')
    );

    service.dispose();
  });

  it('produces predictions from learned patterns', () => {
    const { service } = createService();
    const pattern: UserPattern = {
      sequence: ['/dashboard', '/transactions', '/reports'],
      count: 25,
      lastSeen: new Date()
    };

    (service as any).userPatterns.set('dash-flow', pattern);

    const predictions = service.getPredictions({
      ...baseContext,
      currentPath: '/transactions',
      previousPath: '/dashboard',
      recentActions: ['/dashboard']
    });

    expect(predictions.some(prediction => prediction.target === '/reports')).toBe(true);
    service.dispose();
  });

  it('honors bandwidth detector and skips execution on low bandwidth', async () => {
    const { service } = createService({
      bandwidthDetector: () => ({ effectiveType: '2g' })
    });
    const preloadSpy = vi.spyOn(service, 'preload');

    await service.executePredictions(baseContext);

    expect(preloadSpy).not.toHaveBeenCalled();
    service.dispose();
  });

  it('preloads resources after hover delay and cleans up listeners', async () => {
    vi.useFakeTimers();
    const { service } = createService();
    const preloadSpy = vi.spyOn(service, 'preload').mockResolvedValue(undefined as any);
    const element = document.createElement('button');

    const cleanup = service.preloadOnHover(element, '/reports');

    element.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(150);
    expect(preloadSpy).toHaveBeenCalledTimes(1);

    cleanup();
    element.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(150);
    expect(preloadSpy).toHaveBeenCalledTimes(1);

    service.dispose();
  });

  it('observes elements for viewport prefetching and triggers preload', () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    const intersectionObserverFactory = vi.fn((callback: IntersectionObserverCallback) => {
      observerCallback = callback;
      return {
        observe: observeMock,
        disconnect: disconnectMock,
        unobserve: vi.fn(),
        takeRecords: vi.fn()
      } as unknown as IntersectionObserver;
    });

    const { service } = createService({ intersectionObserverFactory });
    const preloadSpy = vi.spyOn(service, 'preload').mockResolvedValue(undefined as any);

    const element = document.createElement('div');
    element.dataset.prefetch = '/reports';
    service.observeForPrefetch(element);

    expect(observeMock).toHaveBeenCalledWith(element);
    const entry: IntersectionObserverEntry = {
      isIntersecting: true,
      target: element,
      intersectionRatio: 1,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: performance.now()
    };

    observerCallback?.([entry], {} as IntersectionObserver);
    expect(preloadSpy).toHaveBeenCalledWith(
      expect.objectContaining({ target: '/reports', type: 'page' })
    );

    service.dispose();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('clears resources via dispose', () => {
    const disconnectMock = vi.fn();
    const intersectionObserverFactory = vi.fn((callback: IntersectionObserverCallback) => {
      return {
        observe: vi.fn(),
        disconnect: disconnectMock,
        unobserve: vi.fn(),
        takeRecords: vi.fn()
      } as unknown as IntersectionObserver;
    });

    const { service, clearIntervalSpy, intervalHandle } = createService({
      intersectionObserverFactory
    });

    service.dispose();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalHandle);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
  it('derives context from injected clock and window reference', () => {
    const fixedDate = new Date('2025-01-30T08:00:00Z');
    const { service } = createService({
      now: () => fixedDate,
      windowRef: { location: { pathname: '/insights' }, innerWidth: 500 }
    });

    const context = service.getCurrentContext();

    expect(context.currentPath).toBe('/insights');
    expect(context.deviceType).toBe('mobile');
    expect(context.timeOfDay).toBe('morning');
    expect(context.isMonthEnd).toBe(true);
  });
