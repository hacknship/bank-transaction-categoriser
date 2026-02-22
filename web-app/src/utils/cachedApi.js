import { API } from './api';
import { apiCache, createCacheKey } from './cache';

/**
 * Cached API wrapper
 * All methods return cached data immediately if available,
 * then fetch fresh data in background
 */
export const CachedAPI = {
  // Categories
  getCategories: async (forceRefresh = false) => {
    const cacheKey = 'getCategories';
    
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const data = await API.getCategories();
    apiCache.set(cacheKey, data);
    return data;
  },
  
  // Transactions
  getTransactions: async (params = {}, forceRefresh = false) => {
    const cacheKey = createCacheKey('getTransactions', params);
    
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const data = await API.getTransactions(params);
    apiCache.set(cacheKey, data);
    return data;
  },
  
  // Budget
  getBudgetForPeriod: async (period, type, forceRefresh = false) => {
    const cacheKey = createCacheKey('getBudgetForPeriod', { period, type });
    
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const data = await API.getBudgetForPeriod(period, type);
    apiCache.set(cacheKey, data);
    return data;
  },
  
  getAvailablePeriods: async (forceRefresh = false) => {
    const cacheKey = 'getAvailablePeriods';
    
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const data = await API.getAvailablePeriods();
    apiCache.set(cacheKey, data);
    return data;
  },
  
  getBudgetHistory: async (forceRefresh = false) => {
    const cacheKey = 'getBudgetHistory';
    
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const data = await API.getBudgetHistory();
    apiCache.set(cacheKey, data);
    return data;
  },
  
  // Manual refresh - clears all cache
  refreshAll() {
    apiCache.clear();
  }
};
