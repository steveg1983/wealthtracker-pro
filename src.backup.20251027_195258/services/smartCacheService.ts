import type {
  PreferenceValue,
  FilterConfig,
  CalculationParams
} from '../types/cache-types';
import { logger } from './loggingService';

interface CacheRecord<T> {
  data: T;
  timestamp: number;
  hits: number;
  dependencies?: string[];
  etag?: string;
  ttl?: number;
}

interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  staleWhileRevalidate?: boolean;
  persistToStorage?: boolean;
  compressionThreshold?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  avgHitRate: number;
}

type GetOptions = {
  ttl?: number;
  dependencies?: string[];
  forceRefresh?: boolean;
  staleWhileRevalidate?: boolean;
  compress?: boolean;
};

type SetOptions = {
  ttl?: number;
  dependencies?: string[];
  compress?: boolean;
};

/**
 * Smart Cache Service
 * Design principles:
 * 1. Intelligent cache invalidation
 * 2. Dependency tracking
 * 3. Stale-while-revalidate pattern
 * 4. Automatic compression for large data
 * 5. Performance metrics tracking
 */
class SmartCacheService {
  private memoryCache: SimpleLRUCache<string, CacheRecord<unknown>>;
  private stats: CacheStats;
  private dependencies: Map<string, Set<string>>;
  private revalidationQueue: Set<string>;
  private compressionWorker?: Worker;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    const {
      maxSize = 100,
      ttl = 5 * 60 * 1000, // 5 minutes default
      persistToStorage = true
    } = options;

    this.defaultTtl = Number.isFinite(ttl) ? ttl : 5 * 60 * 1000;
    this.memoryCache = new SimpleLRUCache({
      max: maxSize,
      updateAgeOnGet: true,
      // Size calculation based on JSON string length
      sizeCalculation: (value: CacheRecord<unknown>) => {
        return JSON.stringify(value.data).length;
      },
      dispose: (value, key) => {
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

    // Initialize compression worker if available
    if (typeof Worker !== 'undefined') {
      this.initCompressionWorker();
    }

    // Load persisted cache if enabled
    if (persistToStorage) {
      this.loadFromStorage();
    }
  }

  /**
   * Get value from cache with smart revalidation
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options: GetOptions = {}
  ): Promise<T | null> {
    const {
      forceRefresh = false,
      staleWhileRevalidate = true
    } = options;

    // Force refresh if requested
    if (forceRefresh && fetcher) {
      return this.fetchAndCache(key, fetcher, options);
    }

    // Try to get from memory cache
    const cached = this.memoryCache.get(key) as CacheRecord<T> | undefined;
    
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
   * Peek at the in-memory cache without triggering fetch or stats updates
   */
  private peek<T>(key: string, ttlOverride?: number): T | undefined {
    const entry = this.memoryCache.get(key) as CacheRecord<T> | undefined;
    if (!entry) {
      return undefined;
    }

    if (this.isStale(entry, ttlOverride)) {
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set value in cache with dependencies
   */
  set<T>(
    key: string,
    data: T,
    options: SetOptions = {}
  ): void {
    const entry: CacheRecord<T> = {
      data,
      timestamp: Date.now(),
      hits: 0,
      ...(options.dependencies && { dependencies: options.dependencies })
    };

    if (options.ttl !== undefined) {
      entry.ttl = options.ttl;
    }

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
  memoize<TArgs extends unknown[], TResult>(
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
  cachePreference(key: string, value: PreferenceValue): void {
    const prefKey = `pref:${key}`;
    this.set(prefKey, value, { ttl: Infinity }); // Never expire preferences
    
    // Persist to localStorage
    try {
      localStorage.setItem(prefKey, JSON.stringify(value));
    } catch (error) {
      logger.warn('Failed to persist preference:', error);
    }
  }

  /**
   * Get cached preference
   */
  getPreference<T>(key: string, defaultValue?: T): T | undefined {
    const prefKey = `pref:${key}`;

    let value = this.peek<T>(prefKey, Infinity);

    if (value === undefined) {
      try {
        const stored = localStorage.getItem(prefKey);
        if (stored !== null) {
          const parsed = JSON.parse(stored) as T;
          value = parsed;
          this.set(prefKey, parsed, { ttl: Infinity });
        }
      } catch (error) {
        logger.warn('Failed to load preference:', error);
      }
    }

    return value ?? defaultValue;
  }

  /**
   * Cache filter states
   */
  cacheFilters(page: string, filters: FilterConfig): void {
    const filterKey = `filters:${page}`;
    this.set(filterKey, filters, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
    
    // Track recent filters
    const recentKey = 'filters:recent';
    const recent = this.peek<FilterConfig[]>(recentKey) ?? [];
    const updated = [filters, ...recent.filter(f => 
      JSON.stringify(f) !== JSON.stringify(filters)
    )].slice(0, 10);
    this.set(recentKey, updated);
  }

  /**
   * Get cached filters
   */
  getCachedFilters(page: string): FilterConfig | null {
    return this.peek<FilterConfig>(`filters:${page}`) ?? null;
  }

  /**
   * Cache calculation results
   */
  cacheCalculation<T>(
    type: string,
    params: CalculationParams,
    result: T,
    dependencies?: string[]
  ): void {
    const key = `calc:${type}:${JSON.stringify(params)}`;
    const setOptions: SetOptions = {
      ttl: 5 * 60 * 1000 // 5 minutes
    };
    if (dependencies && dependencies.length > 0) {
      setOptions.dependencies = dependencies;
    }
    this.set(key, result, setOptions);
  }

  /**
   * Get cached calculation
   */
  getCachedCalculation<T>(type: string, params: CalculationParams): T | null {
    const key = `calc:${type}:${JSON.stringify(params)}`;
    return this.peek<T>(key) ?? null;
  }

  /**
   * Batch cache operations
   */
  async batch<T>(operations: Array<{
    key: string;
    fetcher: () => Promise<T>;
    options?: GetOptions;
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
    fetcher: () => Promise<unknown>;
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
    options: GetOptions
  ): Promise<T> {
    try {
      const data = await fetcher();
      this.set(key, data, this.toSetOptions(options));
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
    fetcher: () => Promise<unknown>,
    options: GetOptions
  ): void {
    if (this.revalidationQueue.has(key)) return;
    
    this.revalidationQueue.add(key);
    
    fetcher()
      .then(data => {
        this.set(key, data, this.toSetOptions(options));
      })
      .catch(error => {
        logger.warn(`Failed to revalidate cache for ${key}:`, error);
      })
      .finally(() => {
        this.revalidationQueue.delete(key);
      });
  }

  private toSetOptions(options: GetOptions): SetOptions {
    const setOptions: SetOptions = {};
    if (options.ttl !== undefined) {
      setOptions.ttl = options.ttl;
    }
    if (options.dependencies) {
      setOptions.dependencies = options.dependencies;
    }
    if (options.compress !== undefined) {
      setOptions.compress = options.compress;
    }
    return setOptions;
  }

  private isStale(entry: CacheRecord<unknown>, ttlOverride?: number): boolean {
    const ttl = ttlOverride ?? entry.ttl ?? this.defaultTtl;
    if (ttl === Infinity) {
      return false;
    }
    if (ttl === undefined || ttl <= 0) {
      return false;
    }
    return Date.now() - entry.timestamp > ttl;
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

  private shouldCompress(data: unknown): boolean {
    const size = JSON.stringify(data).length;
    return size > 10000; // Compress if larger than 10KB
  }

  private async compressAndStore(key: string, entry: CacheRecord<unknown>): Promise<void> {
    // Simplified compression - in production, use proper compression
    const compressed = JSON.stringify(entry.data);
    entry.data = compressed;
    this.memoryCache.set(key, entry);
  }

  private initCompressionWorker(): void {
    // Initialize web worker for compression if needed
  }

  private loadFromStorage(): void {
    try {
      // Load preferences from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('pref:')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              this.set(key, JSON.parse(value), { ttl: Infinity });
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load cache from storage:', error);
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

interface SimpleLRUCacheOptions<K, V> {
  max?: number;
  updateAgeOnGet?: boolean;
  sizeCalculation?: (value: V, key: K) => number;
  dispose?: (value: V, key: K) => void;
}

class SimpleLRUCache<K, V> {
  private readonly entries = new Map<K, { value: V; size: number }>();
  private readonly maxSize: number;
  private readonly updateAgeOnGet: boolean;
  private sizeCalculation?: (value: V, key: K) => number;
  private dispose?: (value: V, key: K) => void;
  private totalSize = 0;

  constructor(options: SimpleLRUCacheOptions<K, V>) {
    this.maxSize = options.max ?? 100;
    this.updateAgeOnGet = options.updateAgeOnGet ?? true;
    if (options.sizeCalculation) {
      this.sizeCalculation = options.sizeCalculation;
    }
    if (options.dispose) {
      this.dispose = options.dispose;
    }
  }

  get(key: K): V | undefined {
    const record = this.entries.get(key);
    if (!record) {
      return undefined;
    }

    if (this.updateAgeOnGet) {
      this.entries.delete(key);
      this.entries.set(key, record);
    }

    return record.value;
  }

  set(key: K, value: V): void {
    const size = this.calculateSize(key, value);

    if (this.entries.has(key)) {
      this.totalSize -= this.entries.get(key)!.size;
    }

    this.entries.set(key, { value, size });
    this.totalSize += size;

    this.enforceMaxSize();
  }

  delete(key: K): boolean {
    const record = this.entries.get(key);
    if (!record) {
      return false;
    }

    this.entries.delete(key);
    this.totalSize -= record.size;

    if (this.dispose) {
      try {
        this.dispose(record.value, key);
      } catch (error) {
        logger.warn('Cache dispose callback failed', error);
      }
    }

    return true;
  }

  clear(): void {
    if (this.dispose) {
      for (const [key, record] of this.entries.entries()) {
        try {
          this.dispose(record.value, key);
        } catch (error) {
          logger.warn('Cache dispose callback failed', error);
        }
      }
    }

    this.entries.clear();
    this.totalSize = 0;
  }

  keys(): IterableIterator<K> {
    return this.entries.keys();
  }

  get size(): number {
    return this.totalSize;
  }

  private calculateSize(key: K, value: V): number {
    if (this.sizeCalculation) {
      try {
        const computed = this.sizeCalculation(value, key);
        if (Number.isFinite(computed) && computed > 0) {
          return computed;
        }
      } catch (error) {
        logger.warn('Cache size calculation failed', error);
      }
    }
    return 1;
  }

  private enforceMaxSize(): void {
    while (this.entries.size > 0 && this.totalSize > this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.delete(oldestKey);
    }
  }
}

export default smartCache;
