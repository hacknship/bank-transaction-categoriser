/**
 * CORS Utility for Netlify Functions
 * 
 * IMPORTANT: Update ALLOWED_ORIGINS with your actual production domain(s)
 * before deploying to production!
 */

// List of allowed origins for CORS
// In production, replace with your actual domain(s)
const ALLOWED_ORIGINS = [
  // Production domain
  process.env.URL, // Netlify's default environment variable for site URL
  process.env.DEPLOY_URL, // Netlify's deploy preview URL
  
  // Add your custom domains here:
  // 'https://your-domain.com',
  // 'https://app.your-domain.com',
  
  // Local development (only include in non-production)
  'http://localhost:5173',
  'http://localhost:8888',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8888',
].filter(Boolean); // Remove undefined/null values

/**
 * Get CORS headers based on the request origin
 * @param {string} requestOrigin - The origin from the request headers
 * @returns {Object} CORS headers
 */
function getCorsHeaders(requestOrigin) {
  // Check if the origin is allowed
  const isAllowed = ALLOWED_ORIGINS.includes(requestOrigin);
  
  // In development or if origin is allowed, return it; otherwise return the first allowed origin
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
