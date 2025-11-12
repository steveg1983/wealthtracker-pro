/**
 * Performance Optimization Service
 * Monitors and improves app performance with injectable browser hooks
 */

interface PerformanceMetrics {
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  bundleSize?: number;
  memoryUsage?: number;
  cumulativeLayoutShift?: number;
}

interface PerformanceObserverLike {
  observe(options: PerformanceObserverInit): void;
  disconnect?: () => void;
}

type PerformanceObserverFactory = (
  callback: PerformanceObserverCallback
) => PerformanceObserverLike | null;

interface ImageElementLike {
  dataset?: Record<string, string>;
  src?: string;
  removeAttribute?: (name: string) => void;
}

interface LinkElementLike {
  rel: string;
  href: string;
}

interface DocumentLike {
  querySelectorAll(selector: string): ArrayLike<ImageElementLike>;
  createElement(tagName: string): LinkElementLike;
  head?: { appendChild(node: LinkElementLike): void };
}

interface IntersectionObserverLike {
  observe(target: ImageElementLike): void;
  unobserve?(target: ImageElementLike): void;
  disconnect?(): void;
}

type IntersectionObserverFactory = (
  callback: IntersectionObserverCallback
) => IntersectionObserverLike | null;

type Logger = Pick<Console, 'warn'>;

type SetIntervalFn = (handler: () => void, timeout: number) => number;
type ClearIntervalFn = (id: number) => void;

export interface PerformanceOptimizationServiceOptions {
  performanceObserverFactory?: PerformanceObserverFactory;
  intersectionObserverFactory?: IntersectionObserverFactory;
  documentRef?: DocumentLike | null;
  performanceRef?: Performance | null;
  logger?: Logger;
  setIntervalFn?: SetIntervalFn;
  clearIntervalFn?: ClearIntervalFn;
}

export class PerformanceOptimizationService {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserverLike[] = [];
  private readonly performanceObserverFactory: PerformanceObserverFactory;
  private readonly intersectionObserverFactory: IntersectionObserverFactory;
  private readonly documentRef: DocumentLike | null;
  private readonly performanceRef: Performance | null;
  private readonly logger: Logger;
  private readonly setIntervalFn: SetIntervalFn;
  private readonly clearIntervalFn: ClearIntervalFn;
  private memoryIntervalId: number | null = null;

  constructor(options: PerformanceOptimizationServiceOptions = {}) {
    this.performanceObserverFactory =
      options.performanceObserverFactory ??
      ((callback) => {
        if (typeof PerformanceObserver === 'undefined') {
          return null;
        }
        return new PerformanceObserver(callback);
      });

    this.intersectionObserverFactory =
      options.intersectionObserverFactory ??
      ((callback) => {
        if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
          return null;
        }
        return new window.IntersectionObserver(callback);
      });

    this.documentRef = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
    this.performanceRef = options.performanceRef ?? (typeof performance !== 'undefined' ? performance : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? (() => {}))
    };
    this.setIntervalFn = options.setIntervalFn ?? ((handler, timeout) => setInterval(handler, timeout));
    this.clearIntervalFn = options.clearIntervalFn ?? ((id) => clearInterval(id));
  }

  initialize(): void {
    this.observeLCP();
    this.observeFCP();
    this.observeFID();
    this.observeCLS();
    this.monitorMemory();
    this.setupImageLazyLoading();
    this.prefetchCriticalResources();
  }

  private observeLCP(): void {
    const observer = this.performanceObserverFactory((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      if (lastEntry) {
        this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
      }
    });
    if (!observer) return;
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    this.observers.push(observer);
  }

  private observeFCP(): void {
    const observer = this.performanceObserverFactory((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find((entry) => (entry as any).name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.firstContentfulPaint = (fcpEntry as any).startTime;
      }
    });
    if (!observer) return;
    observer.observe({ type: 'paint', buffered: true });
    this.observers.push(observer);
  }

  private observeFID(): void {
    const observer = this.performanceObserverFactory((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.processingStart && entry.startTime !== undefined) {
          const inputDelay = entry.processingStart - entry.startTime;
          if (inputDelay > 100) {
            this.logger.warn(`Slow interaction detected: ${inputDelay}ms`);
          }
        }
      });
    });
    if (!observer) return;
    observer.observe({ type: 'first-input', buffered: true });
    this.observers.push(observer);
  }

  private observeCLS(): void {
    const observer = this.performanceObserverFactory((list) => {
      let clsScore = this.metrics.cumulativeLayoutShift ?? 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsScore += (entry as any).value;
        }
      }
      this.metrics.cumulativeLayoutShift = clsScore;
    });
    if (!observer) return;
    observer.observe({ type: 'layout-shift', buffered: true });
    this.observers.push(observer);
  }

  private monitorMemory(): void {
    const perf = this.performanceRef as (Performance & {
      memory?: { usedJSHeapSize: number };
    }) | null;
    if (!perf?.memory) return;
    if (this.memoryIntervalId !== null) {
      this.clearIntervalFn(this.memoryIntervalId);
    }
    this.memoryIntervalId = this.setIntervalFn(() => {
      const memory = perf.memory!;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
      if (memory.usedJSHeapSize > 100 * 1024 * 1024) {
        const mb = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        this.logger.warn(`High memory usage detected: ${mb}MB`);
      }
    }, 10000);
  }

  private setupImageLazyLoading(): void {
    if (!this.documentRef) return;
    const observer = this.intersectionObserverFactory?.((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as ImageElementLike;
          const src = img.dataset?.src;
          if (src) {
            img.src = src;
            img.removeAttribute?.('data-src');
            (obs as IntersectionObserverLike | undefined)?.unobserve?.(img);
          }
        }
      });
    });
    if (!observer) return;
    Array.from(this.documentRef.querySelectorAll('img[data-src]')).forEach((img) => {
      observer.observe(img);
    });
  }

  private prefetchCriticalResources(): void {
    if (!this.documentRef?.head) return;
    const criticalRoutes = ['/dashboard', '/transactions', '/accounts'];
    criticalRoutes.forEach((route) => {
      const link = this.documentRef.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      this.documentRef.head!.appendChild(link);
    });
  }

  /**
   * Optimize list rendering with virtualization
   */
  recommendVirtualization(itemCount: number): boolean {
    return itemCount > 100;
  }

  /**
   * Debounce expensive operations
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle frequent operations
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up observers and timers
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect?.());
    this.observers = [];
    if (this.memoryIntervalId !== null) {
      this.clearIntervalFn(this.memoryIntervalId);
      this.memoryIntervalId = null;
    }
  }
}

export const performanceOptimizationService = new PerformanceOptimizationService();
