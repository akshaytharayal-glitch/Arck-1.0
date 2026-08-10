/**
 * In-memory cache with TTL for API responses
 * 
 * This utility provides a simple caching mechanism for API responses.
 * It uses a Map to store cached responses and automatically removes
 * expired entries based on the TTL (time to live) value.
 */

const cache = new Map();

/**
 * Set a value in the cache with a TTL
 * 
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number} ttl - The time to live in milliseconds
 */
function setCache(key, value, ttl) {
  const now = Date.now();
  const expiresAt = now + ttl;
  cache.set(key, { value, expiresAt });
}

/**
 * Get a value from the cache
 * 
 * @param {string} key - The cache key
 * @returns {any} The cached value or undefined if not found or expired
 */
function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  const now = Date.now();
  if (now > cached.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

/**
 * Clear the cache
 */
function clearCache() {
  cache.clear();
}

/**
 * Cache API responses
 * 
 * This function takes an API endpoint and a callback function.
 * It checks the cache first and returns the cached response if found.
 * If not found, it calls the callback function to fetch the response,
 * caches the response, and returns it.
 * 
 * @param {string} endpoint - The API endpoint
 * @param {function} callback - The callback function to fetch the response
 * @param {number} ttl - The time to live in milliseconds
 * @returns {Promise<any>} The API response
 */
async function cacheApiResponse(endpoint, callback, ttl) {
  const cached = getCache(endpoint);
  if (cached) return cached;
  const response = await callback();
  setCache(endpoint, response, ttl);
  return response;
}

// Example usage:
// const response = await cacheApiResponse('/api/models', async () => {
//   const res = await fetch('/api/models');
//   return res.json();
// }, 30000); // 30 seconds TTL

// Export the cache utility
export { setCache, getCache, clearCache, cacheApiResponse };