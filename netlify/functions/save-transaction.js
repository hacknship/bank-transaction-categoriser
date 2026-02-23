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

exports.handler = async (event, context) => {
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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { txId, accountId, txDate, description, amount, category, notes } = JSON.parse(event.body);

    const result = await client.query(`
      INSERT INTO transactions 
        (tx_id, account_id, tx_date, description, amount, category, notes)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tx_id) DO UPDATE SET
        category = EXCLUDED.category,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `, [txId, accountId, txDate, description, amount, category, notes]);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, transaction: result.rows[0] })
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
