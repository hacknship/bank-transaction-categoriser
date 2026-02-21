const { Client } = require('pg');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const client = new Client({
    connectionString: process.env.GHOST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const params = event.queryStringParameters || {};
    const { accountId, startDate, endDate, category, uncategorized } = params;

    let query = 'SELECT * FROM transactions WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (accountId) {
      query += ` AND account_id = $${paramIndex++}`;
      queryParams.push(accountId);
    }

    if (startDate) {
      query += ` AND tx_date >= $${paramIndex++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND tx_date <= $${paramIndex++}`;
      queryParams.push(endDate);
    }

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      queryParams.push(category);
    }

    if (uncategorized === 'true') {
      query += ` AND (category IS NULL OR category = '')`;
    }

    query += ' ORDER BY tx_date DESC';

    const result = await client.query(query, queryParams);
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ transactions: result.rows })
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
