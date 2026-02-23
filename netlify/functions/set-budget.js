const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
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

    const { accountId, monthYear, categoryName, monthlyBudget, isActive } = JSON.parse(event.body);

    const result = await client.query(`
      INSERT INTO budget_categories (account_id, month_year, category_name, monthly_budget, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (account_id, month_year, category_name)
      DO UPDATE SET 
        monthly_budget = EXCLUDED.monthly_budget,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `, [accountId, monthYear, categoryName, monthlyBudget, isActive ?? true]);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, budget: result.rows[0] })
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
