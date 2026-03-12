const { Client } = require('pg');
require('./utils/db');
const { validateApiKey, unauthorizedResponse } = require('./utils/auth');

const getCorsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
};

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Validate API key (do NOT allow health check key for write operations)
  const auth = validateApiKey(event, false);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error, headers);
  }

  // Validate DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'DATABASE_URL environment variable is not set' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { categoryId, amount, periodType, showInTracker, effectiveFrom } = JSON.parse(event.body);

    if (!categoryId || amount === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'categoryId and amount are required' })
      };
    }

    const effectiveDate = effectiveFrom || new Date().toISOString().slice(0, 10);

    // Use the database function to update template and handle versioning
    await client.query(
      'SELECT update_budget_template($1, $2, $3, $4, $5)',
      [categoryId, amount, periodType || 'monthly', showInTracker !== false, effectiveDate]
    );

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Budget updated successfully' })
    };

  } catch (error) {
    console.error('Database error:', error.message);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
