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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.GHOST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { accountId, monthYear } = JSON.parse(event.body);

    // Get budget categories with actual spending
    const budgetResult = await client.query(`
      SELECT 
        bc.category_name,
        bc.monthly_budget as budgeted,
        COALESCE(SUM(t.amount), 0) as actual_spent
      FROM budget_categories bc
      LEFT JOIN transactions t ON 
        bc.account_id = t.account_id 
        AND bc.category_name = t.category
        AND DATE_TRUNC('month', t.tx_date) = bc.month_year
      WHERE bc.account_id = $1 AND bc.month_year = $2
      GROUP BY bc.id, bc.category_name, bc.monthly_budget
    `, [accountId, monthYear]);

    // Archive to budget_history
    for (const row of budgetResult.rows) {
      const variance = parseFloat(row.budgeted) - parseFloat(row.actual_spent);
      let status = 'ON_TRACK';
      if (variance < 0) status = 'OVERSPENT';
      else if (variance > parseFloat(row.budgeted) * 0.1) status = 'UNDER_BUDGET';

      await client.query(`
        INSERT INTO budget_history 
        (account_id, month_year, category_name, budgeted, actual_spent, variance, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [accountId, monthYear, row.category_name, row.budgeted, row.actual_spent, variance, status]);
    }

    // Mark budget categories as inactive
    await client.query(`
      UPDATE budget_categories 
      SET is_active = false, updated_at = NOW()
      WHERE account_id = $1 AND month_year = $2
    `, [accountId, monthYear]);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `Budget for ${monthYear} archived successfully`,
        archivedCategories: budgetResult.rows.length
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
