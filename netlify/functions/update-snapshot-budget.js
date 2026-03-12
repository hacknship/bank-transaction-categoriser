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

    const { period, categoryId, newAmount, reason } = JSON.parse(event.body);

    if (!period || !categoryId || newAmount === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'period, categoryId, and newAmount are required' })
      };
    }

    const periodStart = `${period}-01`;

    // Update the specific snapshot for this period
    const result = await client.query(`
      UPDATE budget_snapshots
      SET budgeted_amount = $1,
          updated_at = NOW(),
          notes = COALESCE(notes || '; ', '') || $2
      WHERE period_start = $3
        AND category_id = $4
      RETURNING *
    `, [newAmount, `Historical adjustment: ${reason || 'No reason provided'}`, periodStart, categoryId]);

    if (result.rowCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Budget snapshot not found for this period and category' })
      };
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Historical budget updated successfully',
        snapshot: result.rows[0]
      })
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
