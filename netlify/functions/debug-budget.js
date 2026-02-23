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

    // Check if function exists
    const functionCheck = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'get_or_create_budget_snapshot'
    `);

    // Check tables
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('budget_templates', 'budget_versions', 'budget_snapshots', 'categories')
    `);

    // Check budget templates
    const templates = await client.query(`
      SELECT bt.*, c.name as category_name
      FROM budget_templates bt
      JOIN categories c ON c.id = bt.category_id
      LIMIT 5
    `);

    // Try calling the function with error details
    let functionResult = null;
    let functionError = null;
    try {
      const result = await client.query(
        'SELECT * FROM get_or_create_budget_snapshot($1, $2)',
        ['2026-02-01', 'monthly']
      );
      functionResult = result.rows;
    } catch (err) {
      functionError = err.message;
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        database_url_set: !!process.env.DATABASE_URL,
        function_exists: functionCheck.rows.length > 0,
        tables: tablesCheck.rows.map(r => r.table_name),
        templates: templates.rows,
        function_test: {
          success: !functionError,
          error: functionError,
          result_count: functionResult?.length
        }
      }, null, 2)
    };

  } catch (error) {
    console.error('Database error:', error.message);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};
