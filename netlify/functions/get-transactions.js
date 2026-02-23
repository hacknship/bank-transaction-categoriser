const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event, context) => {
  // Get CORS headers based on request origin
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { accountId, category, limit = '20', offset = '0', startDate, endDate } = event.queryStringParameters || {};

    let query = 'SELECT * FROM transactions';
    const params = [];
    const conditions = [];

    if (accountId) {
      params.push(accountId);
      conditions.push(`account_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`tx_date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`tx_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY tx_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
