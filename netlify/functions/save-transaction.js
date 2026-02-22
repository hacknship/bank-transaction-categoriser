const { Client } = require('pg');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
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

    const { transactionId, accountId, txDate, description, amount, category, notes } = JSON.parse(event.body);

    const result = await client.query(`
      INSERT INTO transactions 
        (transaction_id, account_id, tx_date, description, amount, category, notes)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (transaction_id) DO UPDATE SET
        category = EXCLUDED.category,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `, [transactionId, accountId, txDate, description, amount, category, notes]);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, transaction: result.rows[0] })
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
