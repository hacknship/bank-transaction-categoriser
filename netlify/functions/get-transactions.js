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

exports.handler = async (event, context) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Validate API key (allow health check key for this read-only endpoint)
  const auth = validateApiKey(event, true);
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

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { accountId, category, limit = '20', offset = '0', startDate, endDate, useBudgetDate = 'false' } = event.queryStringParameters || {};
    const isBudgetMode = useBudgetDate === 'true';

    let query = 'SELECT * FROM transactions';
    const params = [];
    const conditions = [];

    if (accountId) {
      params.push(accountId);
      conditions.push(`account_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`LOWER(category) = LOWER($${params.length})`);
    }

    // Date Filtering based on mode
    const dateField = isBudgetMode ? 'COALESCE(budget_date, tx_date)' : 'tx_date';

    if (startDate) {
      params.push(startDate);
      if (isBudgetMode) {
        conditions.push(`DATE_TRUNC('month', ${dateField}::date) >= DATE_TRUNC('month', $${params.length}::date)`);
      } else {
        conditions.push(`${dateField} >= $${params.length}`);
      }
    }
    if (endDate) {
      params.push(endDate);
      if (isBudgetMode) {
        conditions.push(`DATE_TRUNC('month', ${dateField}::date) <= DATE_TRUNC('month', $${params.length}::date)`);
      } else {
        conditions.push(`${dateField} <= $${params.length}`);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sorting: Budget mode sorts by budget date, Audit mode (default) sorts by bank transaction date
    if (isBudgetMode) {
      query += ` ORDER BY COALESCE(budget_date, tx_date) DESC, tx_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    } else {
      query += ` ORDER BY tx_date DESC, tx_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    }
    params.push(parseInt(limit), parseInt(offset));

    const result = await client.query(query, params);
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transactions: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.rows.length === parseInt(limit)
        }
      })
    };

  } catch (error) {
    console.error('Database error:', error.message);
    try { await client.end(); } catch (e) { }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
