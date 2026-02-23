const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
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
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
