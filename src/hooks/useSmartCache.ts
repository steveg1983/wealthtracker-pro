import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import smartCache from '../services/smartCacheService';
import { formatDecimal } from '../utils/decimal-format';

interface UseCachedDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  dependencies?: string[];
  staleWhileRevalidate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * Hook for cached data with automatic revalidation
 */
export function useCachedData<T>({
  key,
  fetcher,
  ttl = 5 * 60 * 1000,
  dependencies = [],
  staleWhileRevalidate = true,
  onSuccess,
  onError,
  enabled = true
}: UseCachedDataOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const fetcherRef = useRef(fetcher);

  // Update fetcher ref
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Fetch data
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const result = await smartCache.get<T>(
        key,
        fetcherRef.current,
        {
          ttl,
          dependencies,
          forceRefresh,
          staleWhileRevalidate
        }
      );

      if (result !== null) {
        setData(result);
        onSuccess?.(result);
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [key, ttl, dependencies, staleWhileRevalidate, enabled, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch function
  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    smartCache.invalidate(key);
    return fetchData(true);
  }, [key, fetchData]);

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
    invalidate
  };
}

/**
 * Hook for caching user preferences
 */
export function useCachedPreference<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    smartCache.getPreference(key, defaultValue).then((cached) => {
      if (cached !== undefined) {
        setValue(cached);
      }
    });
  }, [key, defaultValue]);

  const updateValue = useCallback((newValue: T) => {
    setValue(newValue);
    smartCache.cachePreference(key, newValue);
  }, [key]);

  return [value, updateValue];
}

/**
 * Hook for caching filter state
 */
export function useCachedFilters(page: string) {
  const [filters, setFilters] = useState<any>({});

  useEffect(() => {
    smartCache.getCachedFilters(page).then((cached) => {
      if (cached) {
        setFilters(cached);
      }
    });
  }, [page]);

  const updateFilters = useCallback((newFilters: any) => {
    setFilters(newFilters);
    smartCache.cacheFilters(page, newFilters);
  }, [page]);

  const clearFilters = useCallback(() => {
    setFilters({});
    smartCache.invalidate(`filters:${page}`);
  }, [page]);

  return {
    filters,
    updateFilters,
    clearFilters
  };
}

/**
 * Hook for memoizing expensive calculations
 */
export function useMemoizedCalculation<TArgs extends any[], TResult>(
  calculator: (...args: TArgs) => TResult | Promise<TResult>,
  deps: any[] = []
) {
  const memoized = useMemo(
    () => smartCache.memoize(calculator, {
      ttl: 60 * 1000, // 1 minute
      maxArgs: 50
    }),
    deps
  );

  return memoized;
}

/**
 * Hook for caching API responses with pagination
 */
export function useCachedPagination<T>({
  baseKey,
  fetcher,
  pageSize = 20,
  ttl = 5 * 60 * 1000
}: {
  baseKey: string;
  fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>;
  pageSize?: number;
  ttl?: number;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const totalPages = Math.ceil(totalItems / pageSize);

  const fetchPage = useCallback(async (page: number) => {
    const cacheKey = `${baseKey}:page:${page}:size:${pageSize}`;
    
    setLoading(true);
    setError(null);

    try {
      const result = await smartCache.get(
        cacheKey,
        () => fetcher(page, pageSize),
        { ttl }
      );

      if (result) {
        setData(result.data);
        setTotalItems(result.total);
        setCurrentPage(page);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [baseKey, fetcher, pageSize, ttl]);

  useEffect(() => {
    fetchPage(currentPage);
  }, [currentPage, fetchPage]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const refresh = useCallback(() => {
    smartCache.invalidate(new RegExp(`^${baseKey}:page:`));
    fetchPage(currentPage);
  }, [baseKey, currentPage, fetchPage]);

  return {
    data,
    loading,
    error,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    refresh,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };
}

/**
 * Hook for caching search results
 */
export function useCachedSearch<T>({
  searchFn,
  debounceMs = 300,
  minQueryLength = 2,
  maxResults = 50,
  ttl = 2 * 60 * 1000
}: {
  searchFn: (query: string) => Promise<T[]>;
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
  ttl?: number;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minQueryLength) {
      setResults([]);
      return;
    }

    const cacheKey = `search:${searchQuery}`;
    
    setLoading(true);
    setError(null);

    try {
      const cached = await smartCache.get<T[]>(
        cacheKey,
        () => searchFn(searchQuery),
        { ttl }
      );

      if (cached) {
        setResults(cached.slice(0, maxResults));
      }
    } catch (err) {
      setError(err as Error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchFn, minQueryLength, maxResults, ttl]);

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      performSearch(newQuery);
    }, debounceMs);
  }, [performSearch, debounceMs]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    results,
    loading,
    error,
    search,
    clearSearch
  };
}

/**
 * Hook for cache statistics
 */
export function useCacheStats() {
  const [stats, setStats] = useState(smartCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(smartCache.getStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const clearCache = useCallback(() => {
    smartCache.clear();
    setStats(smartCache.getStats());
  }, []);

  return {
    ...stats,
    clearCache,
    hitRate: `${formatDecimal(stats.avgHitRate * 100, 1)}%`
  };
}

/**
 * Hook for warming up cache with predicted data
 */
export function useCacheWarmup(
  predictions: Array<{
    key: string;
    fetcher: () => Promise<any>;
    priority?: number;
  }>,
  enabled = true
) {
  const [warming, setWarming] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled || predictions.length === 0) return;

    const warmUp = async () => {
      setWarming(true);
      setProgress(0);

      for (let i = 0; i < predictions.length; i++) {
        await smartCache.get(
          predictions[i].key,
          predictions[i].fetcher
        );
        setProgress((i + 1) / predictions.length);
      }

      setWarming(false);
      setProgress(1);
    };

    warmUp();
  }, [enabled, predictions]);

  return {
    warming,
    progress
  };
}

/**
 * Hook for batch cache operations
 */
export function useBatchCache<T>(
  operations: Array<{
    key: string;
    fetcher: () => Promise<T>;
    ttl?: number;
  }>
) {
  const [data, setData] = useState<(T | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<(Error | null)[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      
      const results = await Promise.allSettled(
        operations.map(op => 
          smartCache.get(op.key, op.fetcher, { ttl: op.ttl })
        )
      );

      const data: (T | null)[] = [];
      const errors: (Error | null)[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          data.push(result.value);
          errors.push(null);
        } else {
          data.push(null);
          errors.push(result.reason);
        }
      });

      setData(data);
      setErrors(errors);
      setLoading(false);
    };

    fetchAll();
  }, [operations]);

  return {
    data,
    loading,
    errors
  };
}
