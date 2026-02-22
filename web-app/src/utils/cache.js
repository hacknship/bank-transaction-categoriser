// Simple in-memory cache for API responses
// Data persists during the session (until page refresh)

const cache = new Map();
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export const apiCache = {
  // Get cached data if it exists and isn't stale
  get(key) {
    const item = cache.get(key);
    if (!item) return null;
    
    const isStale = Date.now() - item.timestamp > DEFAULT_STALE_TIME;
    if (isStale) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  // Store data in cache
  set(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  },
  
  // Clear specific key or all cache
  clear(key) {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  },
  
  // Get all cache keys (for debugging)
  keys() {
    return Array.from(cache.keys());
  }
};

// Helper to create cache key from endpoint and params
export function createCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return sortedParams ? `${endpoint}?${sortedParams}` : endpoint;
}
