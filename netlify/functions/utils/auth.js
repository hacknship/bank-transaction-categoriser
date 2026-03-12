/**
 * Authentication utility for Netlify Functions
 * 
 * All API endpoints require authentication via:
 * 1. API_KEY (main key for web app) - stored in Netlify env vars
 * 2. HEALTH_CHECK_KEY (for uptime monitoring only) - stored in Netlify env vars
 */

// Get keys from environment
const API_KEY = process.env.API_KEY;
const HEALTH_CHECK_KEY = process.env.HEALTH_CHECK_KEY;

/**
 * Validate API key from request
 * @param {Object} event - Netlify function event
 * @param {boolean} allowHealthCheck - Whether to allow health check key (for read-only endpoints)
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateApiKey(event, allowHealthCheck = false) {
  // Check if API keys are configured
  if (!API_KEY) {
    console.error('API_KEY not configured in environment variables');
    return { 
      valid: false, 
      error: 'Server configuration error: API_KEY not set' 
    };
  }

  // Get key from query string or headers
  const queryKey = event.queryStringParameters?.key;
  const headerKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  const providedKey = queryKey || headerKey;

  if (!providedKey) {
    return { 
      valid: false, 
      error: 'Authentication required. Provide key via ?key=XXX query param or X-API-Key header' 
    };
  }

  // Check against main API key
  if (providedKey === API_KEY) {
    return { valid: true };
  }

  // Check against health check key (if allowed for this endpoint)
  if (allowHealthCheck && HEALTH_CHECK_KEY && providedKey === HEALTH_CHECK_KEY) {
    return { valid: true, isHealthCheck: true };
  }

  return { 
    valid: false, 
    error: 'Invalid API key' 
  };
}

/**
 * Create unauthorized response
 * @param {string} message - Error message
 * @param {Object} corsHeaders - CORS headers
 * @returns {Object} - Netlify response object
 */
function unauthorizedResponse(message, corsHeaders) {
  return {
    statusCode: 401,
    headers: corsHeaders,
    body: JSON.stringify({ 
      error: 'Unauthorized',
      message: message 
    })
  };
}

module.exports = {
  validateApiKey,
  unauthorizedResponse,
  API_KEY,
  HEALTH_CHECK_KEY
};
