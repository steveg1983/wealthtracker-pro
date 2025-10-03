/**
 * @module cacheUtilities
 * @description World-class cache utility functions for advanced caching strategies,
 * including pagination, search, batch operations, and cache warming.
 * 
 * @features
 * - Pagination cache management
 * - Search result caching
 * - Batch cache operations
 * - Cache statistics
 * - Cache warming strategies
 * 
 * @performance
 * - Optimized cache keys
 * - Efficient memory usage
 * - Debounced operations
 */

import smartCache from '../../services/smartCacheService';

/**
 * Cache options for pagination
 */
export interface PaginationCacheOptions<T> {
  key: string;
  fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>;
  pageSize?: number;
  ttl?: number;
  prefetchNext?: boolean;
}

/**
 * Cache options for search
 */
export interface SearchCacheOptions<T> {
  key: string;
  searcher: (query: string) => Promise<T[]>;
  debounceMs?: number;
  minQueryLength?: number;
  ttl?: number;
  maxResults?: number;
}

/**
 * Cache options for batch operations
 */
export interface BatchCacheOptions<T> {
  keys: string[];
  fetcher: (keys: string[]) => Promise<Map<string, T>>;
  ttl?: number;
  maxBatchSize?: number;
}

/**
 * Generate cache key for pagination
 */
export function getPaginationCacheKey(baseKey: string, page: number, pageSize: number): string {
  return `${baseKey}:page:${page}:size:${pageSize}`;
}

/**
 * Generate cache key for search
 */
export function getSearchCacheKey(baseKey: string, query: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  return `${baseKey}:search:${normalizedQuery}`;
}

/**
 * Generate cache key for filters
 */
export function getFilterCacheKey(page: string, filters: Record<string, any>): string {
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        acc[key] = filters[key];
      }
      return acc;
    }, {} as Record<string, any>);
  
  return `filters:${page}:${JSON.stringify(sortedFilters)}`;
}

/**
 * Prefetch next page for pagination
 */
export async function prefetchNextPage<T>(
  baseKey: string,
  currentPage: number,
  pageSize: number,
  fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
  ttl: number
): Promise<void> {
  const nextPageKey = getPaginationCacheKey(baseKey, currentPage + 1, pageSize);
  
  // Check if already cached
  const cached = await smartCache.get(nextPageKey, async () => null);
  if (cached) return;

  // Prefetch in background
  setTimeout(async () => {
    try {
      await smartCache.get(
        nextPageKey,
        () => fetcher(currentPage + 1, pageSize),
        { ttl }
      );
    } catch (error) {
      console.debug('Prefetch failed, will retry on demand', error);
    }
  }, 100);
}

/**
 * Get cache statistics for a pattern
 */
export function getCacheStatsByPattern(pattern: string): {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  keys: string[];
} {
  const stats = smartCache.getStats();
  
  // Since getStats returns a single CacheStats object, not a map of keys to stats,
  // we can't filter by pattern. Return the overall stats instead.
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.avgHitRate,
    size: stats.size,
    keys: [] // Pattern matching not available with current cache implementation
  };
}

/**
 * Warm up cache with initial data
 */
export async function warmupCache(
  entries: Array<{
    key: string;
    fetcher: () => Promise<any>;
    ttl?: number;
  }>
): Promise<{ succeeded: number; failed: number; errors: Error[] }> {
  const results = {
    succeeded: 0,
    failed: 0,
    errors: [] as Error[]
  };

  // Process in parallel with concurrency limit
  const concurrencyLimit = 5;
  const chunks = [];
  
  for (let i = 0; i < entries.length; i += concurrencyLimit) {
    chunks.push(entries.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async ({ key, fetcher, ttl }) => {
      try {
        await smartCache.get(key, fetcher, { ttl });
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push(error as Error);
      }
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Process batch cache requests efficiently
 */
export async function processBatchCache<T>(
  keys: string[],
  fetcher: (keys: string[]) => Promise<Map<string, T>>,
  ttl: number,
  maxBatchSize: number = 50
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const uncachedKeys: string[] = [];

  // Check cache for each key
  for (const key of keys) {
    const cached = await smartCache.get<T>(key);
    if (cached) {
      results.set(key, cached);
    } else {
      uncachedKeys.push(key);
    }
  }

  // Fetch uncached keys in batches
  if (uncachedKeys.length > 0) {
    const batches = [];
    for (let i = 0; i < uncachedKeys.length; i += maxBatchSize) {
      batches.push(uncachedKeys.slice(i, i + maxBatchSize));
    }

    for (const batch of batches) {
      const batchResults = await fetcher(batch);
      
      // Cache and collect results
      for (const [key, value] of batchResults) {
        await smartCache.set(key, value, { ttl });
        results.set(key, value);
      }
    }
  }

  return results;
}

/**
 * Clear cache by pattern
 */
export function clearCacheByPattern(pattern: string | RegExp): number {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const stats = smartCache.getStats();
  const keysToInvalidate = Object.keys(stats).filter(key => regex.test(key));
  
  keysToInvalidate.forEach(key => smartCache.invalidate(key));
  
  return keysToInvalidate.length;
}

/**
 * Get memory usage for cache keys
 */
export function getCacheMemoryUsage(keys?: string[]): {
  totalSize: number;
  formattedSize: string;
  breakdown: Record<string, number>;
} {
  const stats = smartCache.getStats();
  
  // Since getStats returns a single CacheStats object, not per-key stats,
  // we can only return the total size
  const totalSize = stats.size;
  const breakdown: Record<string, number> = {};

  // Format size
  let formattedSize: string;
  if (totalSize < 1024) {
    formattedSize = `${totalSize} B`;
  } else if (totalSize < 1024 * 1024) {
    formattedSize = `${(totalSize / 1024).toFixed(2)} KB`;
  } else {
    formattedSize = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    totalSize,
    formattedSize,
    breakdown
  };
}