/**
 * @hook useCachedSearch
 * @description World-class search hook with intelligent caching, debouncing,
 * and result optimization. Provides instant search with smart caching strategies.
 * 
 * @example
 * ```tsx
 * const { results, loading, query, setQuery } = useCachedSearch({
 *   key: 'transactions',
 *   searcher: searchTransactions,
 *   debounceMs: 300
 * });
 * ```
 * 
 * @features
 * - Debounced search
 * - Result caching
 * - Query normalization
 * - Minimum query length
 * - Result limiting
 * 
 * @performance
 * - Caches all searches
 * - Debounced API calls
 * - Instant cached results
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import smartCache from '../../services/smartCacheService';
import { 
  getSearchCacheKey,
  SearchCacheOptions 
} from '../../services/cache/cacheUtilities';

export function useCachedSearch<T>({
  key,
  searcher,
  debounceMs = 300,
  minQueryLength = 2,
  ttl = 5 * 60 * 1000,
  maxResults = 100
}: SearchCacheOptions<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const searcherRef = useRef(searcher);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Update searcher ref
  useEffect(() => {
    searcherRef.current = searcher;
  }, [searcher]);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    // Skip if query is too short
    if (searchQuery.length < minQueryLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cacheKey = getSearchCacheKey(key, searchQuery);

    try {
      setLoading(true);
      setError(null);

      const searchResults = await smartCache.get(
        cacheKey,
        () => searcherRef.current(searchQuery),
        { ttl }
      );

      // Limit results
      const limitedResults = searchResults ? searchResults.slice(0, maxResults) : [];
      setResults(limitedResults);
    } catch (err) {
      setError(err as Error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [key, minQueryLength, ttl, maxResults]);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Handle empty query
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Set loading immediately for user feedback
    setLoading(true);

    // Debounce the search
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceMs, performSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  // Refresh current search
  const refresh = useCallback(() => {
    if (query) {
      const cacheKey = getSearchCacheKey(key, query);
      smartCache.invalidate(cacheKey);
      performSearch(query);
    }
  }, [key, query, performSearch]);

  // Get search suggestions from cache
  const getSuggestions = useCallback((): string[] => {
    const stats = smartCache.getStats();
    const searchPattern = new RegExp(`^${key}:search:`);
    
    return Object.keys(stats)
      .filter(k => searchPattern.test(k))
      .map(k => k.replace(`${key}:search:`, ''))
      .slice(0, 10);
  }, [key]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearSearch,
    refresh,
    getSuggestions,
    hasResults: results.length > 0,
    isSearching: loading
  };
}