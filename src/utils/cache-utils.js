// src/utils/cache-utils.js
/**
 * In-memory cache utility with TTL (time to live) for API responses.
 * This utility helps reduce the number of API calls by caching frequently accessed data.
 */

const cache = {};

/**
 * Set a value in the cache with a TTL (time to live) in milliseconds.
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttl - The time to live in milliseconds.
 */
function setCache(key, value, ttl) {
  const now = Date.now();
  cache[key] = { value, expires: now + ttl };
}

/**
 * Get a value from the cache.
 * @param {string} key - The cache key.
 * @returns {any} The cached value or null if not found or expired.
 */
function getCache(key) {
  const now = Date.now();
  if (cache[key] && cache[key].expires > now) {
    return cache[key].value;
  }
  return null;
}

/**
 * Clear the cache.
 */
function clearCache() {
  cache = {};
}

/**
 * Check if a key exists in the cache.
 * @param {string} key - The cache key.
 * @returns {boolean} True if the key exists in the cache, false otherwise.
 */
function hasCache(key) {
  return cache[key] !== undefined;
}

/**
 * Get the TTL (time to live) of a cached value.
 * @param {string} key - The cache key.
 * @returns {number} The TTL in milliseconds or -1 if not found.
 */
function getTTL(key) {
  if (cache[key]) {
    return cache[key].expires - Date.now();
  }
  return -1;
}

// Example usage:
// Set a value in the cache with a TTL of 1 minute (60000 milliseconds)
setCache('apiResponse', { data: 'example data' }, 60000);

// Get the cached value
const cachedValue = getCache('apiResponse');
console.log(cachedValue); // Output: { data: 'example data' }

// Clear the cache
clearCache();

// Check if a key exists in the cache
console.log(hasCache('apiResponse')); // Output: false

// Get the TTL of a cached value
console.log(getTTL('apiResponse')); // Output: -1

// Export the cache utility functions
export { setCache, getCache, clearCache, hasCache, getTTL };