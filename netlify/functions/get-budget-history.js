const { Client } = require('pg');

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
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get all budget versions with their periods
    const versionsResult = await client.query(`
      SELECT 
        bv.id,
        bv.name,
        bv.effective_from,
        bv.effective_to,
        bv.created_at,
        COUNT(DISTINCT bs.period_start) as period_count,
        COUNT(DISTINCT bs.category_id) as category_count
      FROM budget_versions bv
      LEFT JOIN budget_snapshots bs ON bs.budget_version_id = bv.id
      GROUP BY bv.id, bv.name, bv.effective_from, bv.effective_to, bv.created_at
      ORDER BY bv.effective_from DESC
    `);

    // Get available periods with data
    const periodsResult = await client.query(`
      SELECT DISTINCT 
        TO_CHAR(bs.period_start, 'YYYY-MM') as period,
        bs.period_start as period_date,
        COUNT(DISTINCT bs.category_id) as category_count,
        SUM(bs.budgeted_amount) as total_budgeted,
        SUM(bs.actual_spent) as total_spent
      FROM budget_snapshots bs
      GROUP BY bs.period_start
      ORDER BY bs.period_start DESC
      LIMIT 24
    `);

    // Get current budget templates
    const templatesResult = await client.query(`
      SELECT 
        bt.*,
        c.name as category_name,
        c.icon as category_icon,
        c.type as category_type
      FROM budget_templates bt
      JOIN categories c ON c.id = bt.category_id
      WHERE bt.show_in_tracker = TRUE
      ORDER BY c.type, c.name
    `);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        versions: versionsResult.rows,
        periods: periodsResult.rows,
        currentTemplates: templatesResult.rows
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
