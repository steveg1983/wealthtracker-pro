/**
 * Performance Optimization Service
 * Monitors and improves app performance
 */

interface PerformanceMetrics {
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  bundleSize?: number;
  memoryUsage?: number;
}

class PerformanceOptimizationService {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  initialize(): void {
    if (typeof window === 'undefined') return;

    // Monitor Core Web Vitals
    this.observeLCP();
    this.observeFCP();
    this.observeFID();
    this.observeCLS();

    // Monitor memory usage
    this.monitorMemory();

    // Lazy load images
    this.setupImageLazyLoading();

    // Prefetch critical resources
    this.prefetchCriticalResources();
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      // LCP not supported
    }
  }

  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.firstContentfulPaint = fcpEntry.startTime;
        }
      });
      observer.observe({ type: 'paint', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      // FCP not supported
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        // Handle First Input Delay
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const inputDelay = entry.processingStart - entry.startTime;
            // Log slow interactions
            if (inputDelay > 100) {
              console.warn(`Slow interaction detected: ${inputDelay}ms`);
            }
          }
        });
      });
      observer.observe({ type: 'first-input', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      // FID not supported
    }
  }

  private observeCLS(): void {
    try {
      let clsScore = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      // CLS not supported
    }
  }

  private monitorMemory(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize;

        // Warn if memory usage is high (>100MB)
        if (memory.usedJSHeapSize > 100 * 1024 * 1024) {
          console.warn('High memory usage detected:', Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB');
        }
      }, 10000);
    }
  }

  private setupImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }

  private prefetchCriticalResources(): void {
    // Prefetch critical routes
    const criticalRoutes = ['/dashboard', '/transactions', '/accounts'];

    criticalRoutes.forEach((route) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize list rendering with virtualization
   */
  recommendVirtualization(itemCount: number): boolean {
    // Recommend virtualization for lists with more than 100 items
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
   * Clean up observers
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

export const performanceOptimizationService = new PerformanceOptimizationService();