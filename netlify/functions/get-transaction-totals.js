const { Client } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const params = event.queryStringParameters || {};
    const { accountId, category, startDate, endDate } = params;

    // Build WHERE clause
    const conditions = [];
    const queryParams = [];

    if (accountId) {
      queryParams.push(accountId);
      conditions.push(`account_id = $${queryParams.length}`);
    }
    if (category) {
      queryParams.push(category);
      conditions.push(`category = $${queryParams.length}`);
    }
    if (startDate) {
      queryParams.push(startDate);
      conditions.push(`tx_date >= $${queryParams.length}`);
    }
    if (endDate) {
      queryParams.push(endDate);
      conditions.push(`tx_date <= $${queryParams.length}`);
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
    console.error('Error:', error);
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
