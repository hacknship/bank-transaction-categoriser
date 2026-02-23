/**
 * CORS Utility for Netlify Functions
 * 
 * IMPORTANT: Update ALLOWED_ORIGINS with your actual production domain(s)
 * before deploying to production!
 */

// List of allowed origins for CORS
// In production, replace with your actual domain(s)
const ALLOWED_ORIGINS = [
  // Production domain (Netlify provides these automatically)
  process.env.URL, // e.g., https://your-site.netlify.app
  process.env.DEPLOY_URL, // Deploy preview URL
  process.env.DEPLOY_PRIME_URL, // Production deploy URL
  
  // Add your custom domains here:
  'https://ss-transactions-tracker.netlify.app',
  
  // Local development
  'http://localhost:5173',
  'http://localhost:8888',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8888',
].filter(Boolean); // Remove undefined/null values

/**
 * Get CORS headers based on the request origin
 * @param {Object} headers - The event.headers object from Netlify function
 * @returns {Object} CORS headers
 */
function getCorsHeaders(headers = {}) {
  // Handle case-insensitive header access
  const requestOrigin = headers.origin || headers.Origin || '';
  
  // Check if the origin is allowed
  const isAllowed = ALLOWED_ORIGINS.includes(requestOrigin);
  
  // If origin is allowed, return it; otherwise use the first allowed origin or wildcard as fallback
  const allowedOrigin = isAllowed ? requestOrigin : (ALLOWED_ORIGINS[0] || '*');
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
}

/**
 * Handle CORS preflight requests
 * @param {Object} headers - CORS headers
 * @returns {Object} Response for OPTIONS request
 */
function handlePreflight(headers) {
  return {
    statusCode: 204,
    headers,
    body: ''
  };
}

module.exports = {
  ALLOWED_ORIGINS,
  getCorsHeaders,
  handlePreflight
};
