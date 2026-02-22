import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCache, createCacheKey } from '../utils/cache';

/**
 * Hook for cached API calls
 * - Returns cached data immediately if available
 * - Fetches fresh data in background
 * - Shows loading state only on first fetch
 * - Manual refresh bypasses cache
 */
export function useCachedAPI(fetchFn, params = {}, options = {}) {
  const { 
    cacheKey: customCacheKey,
    staleTime = 5 * 60 * 1000, // 5 minutes
    enabled = true 
  } = options;
  
  // Generate cache key
  const cacheKey = customCacheKey || createCacheKey(fetchFn.name, params);
  
  // Try to get initial data from cache
  const cachedData = apiCache.get(cacheKey);
  
  const [data, setData] = useState(cachedData);
  const [isLoading, setIsLoading] = useState(!cachedData && enabled);
  const [isFetching, setIsFetching] = useState(false); // Background fetching
  const [error, setError] = useState(null);
  
  // Use ref to track if component is mounted
  const isMounted = useRef(true);
  
  const fetchData = useCallback(async (skipCache = false) => {
    if (!enabled) return;
    
    // Check cache first (unless skipCache)
    if (!skipCache) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
      }
    }
    
    // Always fetch in background to get fresh data
    setIsFetching(true);
    
    try {
      const result = await fetchFn(params);
      
      if (isMounted.current) {
        setData(result);
        setError(null);
        apiCache.set(cacheKey, result);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.message);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [fetchFn, params, cacheKey, enabled]);
  
  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchData();
    
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    apiCache.clear(cacheKey);
    return fetchData(true);
  }, [fetchData, cacheKey]);
  
  return {
    data,
    isLoading,    // True only on first load (no cache)
    isFetching,   // True when fetching in background
    error,
    refresh
  };
}
