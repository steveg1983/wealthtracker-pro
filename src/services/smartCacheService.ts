import LRUCache from 'lru-cache';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  dependencies?: string[];
  etag?: string;
}

interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  staleWhileRevalidate?: boolean;
  persistToStorage?: boolean;
  compressionThreshold?: number;
}

interface StorageLike {
  length?: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  clear?(): void;
  key?(index: number): string | null;
}

type Logger = Pick<Console, 'warn' | 'error'>;

type WorkerFactory = () => Worker | null;

interface SmartCacheServiceOptions extends CacheOptions {
  storage?: StorageLike | null;
  now?: () => number;
  createWorker?: WorkerFactory;
  logger?: Logger;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  avgHitRate: number;
}

/**
 * Smart Cache Service
 * Design principles:
 * 1. Intelligent cache invalidation
 * 2. Dependency tracking
 * 3. Stale-while-revalidate pattern
 * 4. Automatic compression for large data
 * 5. Performance metrics tracking
 */
export class SmartCacheService {
  private memoryCache: LRUCache<string, CacheEntry<any>>;
  private stats: CacheStats;
  private dependencies: Map<string, Set<string>>;
  private revalidationQueue: Set<string>;
  private compressionWorker?: Worker;
  private storage: StorageLike | null;
  private readonly nowFn: () => number;
  private readonly createWorker?: WorkerFactory;
  private readonly logger: Logger;

  constructor(options: SmartCacheServiceOptions = {}) {
    const {
      maxSize = 100,
      ttl = 5 * 60 * 1000, // 5 minutes default
      staleWhileRevalidate = true,
      persistToStorage = true,
      storage,
      now,
      createWorker,
      logger
    } = options;

    this.memoryCache = new LRUCache({
      max: maxSize,
      maxSize,
      ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      // Size calculation based on JSON string length
      sizeCalculation: (value: CacheEntry<any>) => {
        return JSON.stringify(value.data).length;
      },
      dispose: (value: CacheEntry<any>, key: string) => {
        this.stats.evictions++;
        this.removeDependencies(key);
      }
    });

    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
      avgHitRate: 0
    };

    this.dependencies = new Map();
    this.revalidationQueue = new Set();
    this.storage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.nowFn = now ?? (() => Date.now());
    this.createWorker = createWorker;
    const noop = () => {};
    const globalLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      warn: logger?.warn ?? (globalLogger?.warn?.bind(globalLogger) ?? noop),
      error: logger?.error ?? (globalLogger?.error?.bind(globalLogger) ?? noop)
    };

    // Initialize compression worker if available
    const injectedWorker = this.createWorker?.();
    if (injectedWorker) {
      this.compressionWorker = injectedWorker;
    } else if (typeof Worker !== 'undefined') {
      this.initCompressionWorker();
    }

    // Load persisted cache if enabled
    if (persistToStorage && this.storage) {
      this.loadFromStorage();
    }
  }

  /**
   * Get value from cache with smart revalidation
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options: {
      ttl?: number;
      dependencies?: string[];
      forceRefresh?: boolean;
      staleWhileRevalidate?: boolean;
    } = {}
  ): Promise<T | null> {
    const {
      forceRefresh = false,
      staleWhileRevalidate = true,
      dependencies = []
    } = options;

    // Force refresh if requested
    if (forceRefresh && fetcher) {
      return this.fetchAndCache(key, fetcher, options);
    }

    // Try to get from memory cache
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      this.stats.hits++;
      cached.hits++;
      this.updateHitRate();

      // Check if stale
      const isStale = this.isStale(cached, options.ttl);
      
      if (isStale && fetcher && staleWhileRevalidate) {
        // Return stale data and revalidate in background
        this.revalidateInBackground(key, fetcher, options);
        return cached.data as T;
      } else if (!isStale) {
        return cached.data as T;
      }
    }

    this.stats.misses++;
    this.updateHitRate();

    // Fetch if fetcher provided
    if (fetcher) {
      return this.fetchAndCache(key, fetcher, options);
    }

    return null;
  }

  /**
   * Set value in cache with dependencies
   */
  set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      dependencies?: string[];
      compress?: boolean;
    } = {}
  ): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: this.nowFn(),
      hits: 0,
      dependencies: options.dependencies
    };

    // Handle large data compression
    if (options.compress && this.shouldCompress(data)) {
      this.compressAndStore(key, entry);
    } else {
      this.memoryCache.set(key, entry);
    }

    // Track dependencies
    if (options.dependencies) {
      this.trackDependencies(key, options.dependencies);
    }

    // Update stats
    this.stats.size = this.memoryCache.size;
  }

  /**
   * Invalidate cache entries by key or pattern
   */
  invalidate(keyOrPattern: string | RegExp, includeDependents = true): void {
    const keys = this.findKeys(keyOrPattern);
    
    keys.forEach(key => {
      // Invalidate the key itself
      this.memoryCache.delete(key);
      
      // Invalidate dependent keys
      if (includeDependents) {
        const dependents = this.dependencies.get(key);
        if (dependents) {
          dependents.forEach(dependent => {
            this.memoryCache.delete(dependent);
          });
        }
      }
    });

    this.stats.size = this.memoryCache.size;
  }

  /**
   * Cache expensive calculations
   */
  memoize<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
    options: {
      keyGenerator?: (...args: TArgs) => string;
      ttl?: number;
      maxArgs?: number;
    } = {}
  ): (...args: TArgs) => Promise<TResult> {
    const {
      keyGenerator = (...args) => JSON.stringify(args),
      ttl = 60000,
      maxArgs = 100
    } = options;

    const memoCache = new Map<string, { result: TResult; timestamp: number }>();

    return async (...args: TArgs): Promise<TResult> => {
      const key = keyGenerator(...args);
      
      // Check memoization cache
      const cached = memoCache.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.result;
      }

      // Execute function
      const result = await fn(...args);
      
      // Cache result
      if (memoCache.size >= maxArgs) {
        // Remove oldest entry
        const firstKey = memoCache.keys().next().value;
        if (firstKey !== undefined) {
          memoCache.delete(firstKey);
        }
      }
      
      memoCache.set(key, { result, timestamp: Date.now() });
      
      return result;
    };
  }

  /**
   * Cache user preferences
   */
  cachePreference(key: string, value: any): void {
    const prefKey = `pref:${key}`;
    this.set(prefKey, value, { ttl: Infinity }); // Never expire preferences
    
    if (!this.storage) return;
    try {
      this.storage.setItem(prefKey, JSON.stringify(value));
    } catch (e) {
      this.logger.warn('Failed to persist preference:', e as Error);
    }
  }

  /**
   * Get cached preference
   */
  async getPreference<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const prefKey = `pref:${key}`;

    // Try memory cache first
    let value = await this.get<T>(prefKey);

    // Fall back to localStorage
    if (value === null && this.storage) {
      try {
        const stored = this.storage.getItem(prefKey);
        if (stored) {
          value = JSON.parse(stored);
          this.set(prefKey, value, { ttl: Infinity });
        }
      } catch (e) {
        this.logger.warn('Failed to load preference:', e as Error);
      }
    }

    return value ?? defaultValue;
  }

  /**
   * Cache filter states
   */
  async cacheFilters(page: string, filters: any): Promise<void> {
    const filterKey = `filters:${page}`;
    this.set(filterKey, filters, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours

    // Track recent filters
    const recentKey = 'filters:recent';
    const recent = await this.get<any[]>(recentKey) || [];
    const updated = [filters, ...recent.filter((f: any) =>
      JSON.stringify(f) !== JSON.stringify(filters)
    )].slice(0, 10);
    this.set(recentKey, updated);
  }

  /**
   * Get cached filters
   */
  async getCachedFilters(page: string): Promise<any> {
    return this.get(`filters:${page}`);
  }

  /**
   * Cache calculation results
   */
  cacheCalculation(
    type: string,
    params: any,
    result: any,
    dependencies?: string[]
  ): void {
    const key = `calc:${type}:${JSON.stringify(params)}`;
    this.set(key, result, {
      ttl: 5 * 60 * 1000, // 5 minutes
      dependencies
    });
  }

  /**
   * Get cached calculation
   */
  async getCachedCalculation<T>(type: string, params: any): Promise<T | null> {
    const key = `calc:${type}:${JSON.stringify(params)}`;
    return this.get<T>(key);
  }

  /**
   * Batch cache operations
   */
  async batch<T>(operations: Array<{
    key: string;
    fetcher: () => Promise<T>;
    options?: any;
  }>): Promise<(T | null)[]> {
    return Promise.all(
      operations.map(op => this.get(op.key, op.fetcher, op.options))
    );
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.dependencies.clear();
    this.revalidationQueue.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats, size: this.memoryCache.size };
  }

  /**
   * Warm up cache with predicted data
   */
  async warmUp(predictions: Array<{
    key: string;
    fetcher: () => Promise<any>;
    priority?: number;
  }>): Promise<void> {
    // Sort by priority
    const sorted = predictions.sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    // Fetch in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < sorted.length; i += concurrency) {
      const batch = sorted.slice(i, i + concurrency);
      await Promise.all(
        batch.map(p => this.get(p.key, p.fetcher))
      );
    }
  }

  // Private methods

  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: any
  ): Promise<T> {
    try {
      const data = await fetcher();
      this.set(key, data, options);
      return data;
    } catch (error) {
      // On error, try to return stale data if available
      const stale = this.memoryCache.get(key);
      if (stale) {
        return stale.data as T;
      }
      throw error;
    }
  }

  private revalidateInBackground(
    key: string,
    fetcher: () => Promise<any>,
    options: any
  ): void {
    if (this.revalidationQueue.has(key)) return;
    
    this.revalidationQueue.add(key);
    
    fetcher()
      .then(data => {
        this.set(key, data, options);
      })
      .catch(error => {
        this.logger.warn(`Failed to revalidate cache for ${key}:`, error as Error);
      })
      .finally(() => {
        this.revalidationQueue.delete(key);
      });
  }

  private isStale(entry: CacheEntry<any>, ttl?: number): boolean {
    const maxAge = ttl || 5 * 60 * 1000; // 5 minutes default
    return this.nowFn() - entry.timestamp > maxAge;
  }

  private trackDependencies(key: string, dependencies: string[]): void {
    dependencies.forEach(dep => {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)!.add(key);
    });
  }

  private removeDependencies(key: string): void {
    this.dependencies.forEach(deps => {
      deps.delete(key);
    });
  }

  private findKeys(pattern: string | RegExp): string[] {
    const keys: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (typeof pattern === 'string') {
        if (key === pattern || key.startsWith(pattern)) {
          keys.push(key);
        }
      } else if (pattern.test(key)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  private shouldCompress(data: any): boolean {
    const size = JSON.stringify(data).length;
    return size > 10000; // Compress if larger than 10KB
  }

  private async compressAndStore(key: string, entry: CacheEntry<any>): Promise<void> {
    // Simplified compression - in production, use proper compression
    const compressed = JSON.stringify(entry.data);
    entry.data = compressed;
    this.memoryCache.set(key, entry);
  }

  private initCompressionWorker(): void {
    // Initialize web worker for compression if needed
  }

  private loadFromStorage(): void {
    if (!this.storage) return;
    const length = this.storage.length ?? 0;
    const keyFn = this.storage.key;
    if (typeof keyFn !== 'function') {
      return;
    }
    try {
      for (let i = 0; i < length; i++) {
        const key = keyFn.call(this.storage, i);
        if (!key || !key.startsWith('pref:')) continue;
        const value = this.storage.getItem(key);
        if (!value) continue;
        try {
          this.set(key, JSON.parse(value), { ttl: Infinity });
        } catch {
          // Invalid JSON, skip
        }
      }
    } catch (e) {
      this.logger.warn('Failed to load cache from storage:', e as Error);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.avgHitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
      avgHitRate: 0
    };
  }
}

// Create singleton instance
export const smartCache = new SmartCacheService({
  maxSize: 200,
  ttl: 5 * 60 * 1000,
  staleWhileRevalidate: true,
  persistToStorage: true
});

// LRU Cache implementation (simplified version)
class SimpleLRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private ttl: number;
  private timers: Map<K, NodeJS.Timeout>;

  constructor(options: any) {
    this.cache = new Map();
    this.maxSize = options.max || 100;
    this.ttl = options.ttl || 0;
    this.timers = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.delete(firstKey);
      }
    }

    this.cache.set(key, value);

    // Set TTL if specified
    if (this.ttl > 0) {
      this.clearTimer(key);
      const timer = setTimeout(() => {
        this.delete(key);
      }, this.ttl);
      this.timers.set(key, timer);
    }
  }

  delete(key: K): boolean {
    this.clearTimer(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  get size(): number {
    return this.cache.size;
  }

  private clearTimer(key: K): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

export default smartCache;
