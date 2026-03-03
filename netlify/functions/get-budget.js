const { Client } = require('pg');
require('./utils/db');

const getCorsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
};

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
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
    connectionString: process.env.GHOST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const params = event.queryStringParameters || {};
    const { accountId, monthYear } = params;

    let query = `
      SELECT 
        bc.*,
        COALESCE(SUM(t.amount), 0) as actual_spent
      FROM budget_categories bc
      LEFT JOIN transactions t ON 
        bc.account_id = t.account_id 
        AND bc.category_name = t.category
        AND DATE_TRUNC('month', t.tx_date) = bc.month_year
      WHERE bc.is_active = true
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (accountId) {
      query += ` AND bc.account_id = $${paramIndex++}`;
      queryParams.push(accountId);
    }

    if (monthYear) {
      query += ` AND bc.month_year = $${paramIndex++}`;
      queryParams.push(monthYear);
    }

    query += ' GROUP BY bc.id ORDER BY bc.category_name';

    const result = await client.query(query, queryParams);
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ budgets: result.rows })
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
