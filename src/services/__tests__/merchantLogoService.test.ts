import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MerchantLogoService,
  type ImageLike,
  type TimerAdapter
} from '../merchantLogoService';

type ImageOutcome = 'success' | 'error' | 'timeout';

const createTimerHarness = () => {
  let now = 0;
  let counter = 0;
  const queue: Array<{ id: number; due: number; handler: () => void }> = [];

  const adapter: TimerAdapter = {
    setTimeout: (handler, timeout) => {
      const id = ++counter;
      queue.push({ id, due: now + timeout, handler });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: id => {
      const index = queue.findIndex(task => task.id === id);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    }
  };

  const flushDue = () => {
    queue.sort((a, b) => a.due - b.due);
    while (queue.length && queue[0].due <= now) {
      const task = queue.shift()!;
      task.handler();
    }
  };

  return {
    adapter,
    advanceBy(ms: number) {
      now += ms;
      flushDue();
    },
    flushAll() {
      queue.sort((a, b) => a.due - b.due);
      while (queue.length) {
        const task = queue.shift()!;
        now = Math.max(now, task.due);
        task.handler();
      }
    },
    pending() {
      return queue.length;
    }
  };
};

const createStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    setRaw(key: string, value: string) {
      store[key] = value;
    },
    dump() {
      return { ...store };
    }
  };
};

const createImageHarness = (timers: TimerAdapter) => {
  let behavior: (src: string, attempt: number) => ImageOutcome = () => 'success';
  const calls: string[] = [];
  let invocation = 0;

  class ControlledImage implements ImageLike {
    crossOrigin?: string;
    onload?: (() => void) | null;
    onerror?: (() => void) | null;
    private currentSrc = '';

    set src(value: string) {
      this.currentSrc = value;
      const attempt = invocation++;
      calls.push(value);
      const outcome = behavior(value, attempt);
      if (outcome === 'success') {
        timers.setTimeout(() => this.onload?.(), 0);
      } else if (outcome === 'error') {
        timers.setTimeout(() => this.onerror?.(), 0);
      }
      // timeout => no callbacks, letting service timeout handler resolve
    }

    get src() {
      return this.currentSrc;
    }
  }

  return {
    factory: () => new ControlledImage(),
    setBehavior(fn: (src: string, attempt: number) => ImageOutcome) {
      behavior = fn;
    },
    getCalls: () => [...calls]
  };
};

describe('MerchantLogoService', () => {
  let storage: ReturnType<typeof createStorageMock>;
  let timerHarness: ReturnType<typeof createTimerHarness>;
  let timers: TimerAdapter;
  let imageHarness: ReturnType<typeof createImageHarness>;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let service: MerchantLogoService;

  const buildService = () =>
    new MerchantLogoService({
      storage,
      imageFactory: imageHarness.factory,
      timers,
      logger
    });

  beforeEach(() => {
    storage = createStorageMock();
    timerHarness = createTimerHarness();
    timers = timerHarness.adapter;
    imageHarness = createImageHarness(timers);
    logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = buildService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('matches merchants regardless of prefixes or casing', () => {
    const info = service.getMerchantInfo('CARD PURCHASE TESCO STORES 1234');
    expect(info).not.toBeNull();
    expect(info?.name).toBe('Tesco');

    const partial = service.getMerchantInfo('TESCOSTORES-LONDON');
    expect(partial).not.toBeNull();
    expect(partial?.name).toBe('Tesco');
  });

  it('returns null for unknown merchants', () => {
    expect(service.getMerchantInfo('UNLISTED MERCHANT XYZ')).toBeNull();
  });

  it('returns embedded logos without network calls', async () => {
    const result = await service.fetchLogoUrl('amazon.com');
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(imageHarness.getCalls()).toHaveLength(0);
  });

  it('caches fetched logos and persists them to storage', async () => {
    const domain = 'fresh-example.com';
    imageHarness.setBehavior(src => (src.includes(domain) ? 'success' : 'error'));

    const fetchPromise = service.fetchLogoUrl(domain);
    timerHarness.flushAll();
    const result = await fetchPromise;

    expect(result).toContain(domain);
    expect(storage.setItem).toHaveBeenCalled();
    const payload = JSON.parse(storage.setItem.mock.calls.at(-1)[1]);
    expect(payload[domain]).toBe(result);

    const cachedStorage = createStorageMock();
    cachedStorage.setRaw('merchantLogos', JSON.stringify({ [domain]: result }));
    const cachedTimers = createTimerHarness();
    const cachedService = new MerchantLogoService({
      storage: cachedStorage,
      imageFactory: () => null,
      timers: cachedTimers.adapter,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const cachedResult = await cachedService.fetchLogoUrl(domain);
    expect(cachedResult).toBe(result);
  });

  it('deduplicates concurrent fetch requests for the same domain', async () => {
    const domain = 'dupe-test.com';
    imageHarness.setBehavior(src => (src.includes(domain) ? 'success' : 'error'));

    const p1 = service.fetchLogoUrl(domain);
    const p2 = service.fetchLogoUrl(domain);
    const p3 = service.fetchLogoUrl(domain);

    timerHarness.flushAll();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const calls = imageHarness.getCalls().filter(call => call.includes(domain));
    expect(calls.length).toBe(1);
  });

  it('falls back to alternate favicon sources when a logo fails', async () => {
    const domain = 'fallback-source.com';
    imageHarness.setBehavior(src => {
      if (src.includes('logo.clearbit.com')) {
        return 'error';
      }
      if (src.includes('google.com/s2/favicons')) {
        return 'success';
      }
      return 'error';
    });

    const fetchPromise = service.fetchLogoUrl(domain);
    timerHarness.flushAll();
    const result = await fetchPromise;

    expect(result).toContain('google.com/s2/favicons');
    const calls = imageHarness.getCalls().filter(call => call.includes(domain));
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('resolves to null when every source times out', async () => {
    const domain = 'timeout-source.com';
    imageHarness.setBehavior(src => (src.includes(domain) ? 'timeout' : 'error'));

    const fetchPromise = service.fetchLogoUrl(domain);
    timerHarness.advanceBy(3000);
    timerHarness.advanceBy(3000);
    timerHarness.advanceBy(3000);
    const result = await fetchPromise;

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('preloads common merchant logos in the background', async () => {
    const spy = vi.spyOn(service, 'fetchLogoUrl').mockResolvedValue(null);
    await service.preloadCommonLogos();

    expect(spy).toHaveBeenCalledWith('amazon.com');
    expect(spy).toHaveBeenCalledWith('netflix.com');
    expect(spy).toHaveBeenCalledWith('tesco.com');
    expect(spy).toHaveBeenCalledWith('spotify.com');
    spy.mockRestore();
  });

  it('returns unique merchant definitions', () => {
    const merchants = service.getAllMerchants();
    const names = merchants.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Tesco');
    expect(names).toContain('Amazon');
  });

  it('gracefully handles environments without an image factory', async () => {
    const quietLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const nullTimerHarness = createTimerHarness();
    const nullImageService = new MerchantLogoService({
      storage,
      imageFactory: () => null,
      timers: nullTimerHarness.adapter,
      logger: quietLogger
    });

    const result = await nullImageService.fetchLogoUrl('no-image.com');
    expect(result).toBeNull();
    expect(quietLogger.warn).toHaveBeenCalled();
  });
});
