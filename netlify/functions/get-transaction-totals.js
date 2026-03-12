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

    const params = event.queryStringParameters || {};
    const { accountId, category, startDate, endDate, useBudgetDate = 'false' } = params;
    const isBudgetMode = useBudgetDate === 'true';

    // Build WHERE clause
    const conditions = [];
    const queryParams = [];

    if (accountId) {
      queryParams.push(accountId);
      conditions.push(`account_id = $${queryParams.length}`);
    }
    if (category) {
      queryParams.push(category);
      conditions.push(`LOWER(category) = LOWER($${queryParams.length})`);
    }

    const dateField = isBudgetMode ? 'COALESCE(budget_date, tx_date)' : 'tx_date';

    if (startDate) {
      queryParams.push(startDate);
      if (isBudgetMode) {
        conditions.push(`DATE_TRUNC('month', ${dateField}::date) >= DATE_TRUNC('month', $${queryParams.length}::date)`);
      } else {
        conditions.push(`${dateField} >= $${queryParams.length}`);
      }
    }
    if (endDate) {
      queryParams.push(endDate);
      if (isBudgetMode) {
        conditions.push(`DATE_TRUNC('month', ${dateField}::date) <= DATE_TRUNC('month', $${queryParams.length}::date)`);
      } else {
        conditions.push(`${dateField} <= $${queryParams.length}`);
      }
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Get totals
    const totalsResult = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_outgoing,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_incoming,
        COALESCE(SUM(amount), 0) as net_total
      FROM transactions
      ${whereClause}
    `, queryParams);

    // Get category breakdown
    const categoryResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent
      FROM transactions
      ${whereClause}
      GROUP BY category
      ORDER BY spent DESC
    `, queryParams);

    await client.end();

    const totals = totalsResult.rows[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totals: {
          count: parseInt(totals.total_count),
          outgoing: parseFloat(totals.total_outgoing),
          incoming: parseFloat(totals.total_incoming),
          net: parseFloat(totals.net_total)
        },
        categories: categoryResult.rows.map(r => ({
          category: r.category,
          count: parseInt(r.count),
          spent: parseFloat(r.spent)
        }))
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
