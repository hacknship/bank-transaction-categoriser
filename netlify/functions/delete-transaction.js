const { Client } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { txId } = JSON.parse(event.body);

    if (!txId) {
      await client.end();
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'txId required' }) };
    }

    // Delete the transaction
    const result = await client.query(`
      DELETE FROM transactions 
      WHERE tx_id = $1
      RETURNING *
    `, [txId]);

    await client.end();

    if (result.rowCount === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Transaction not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, deleted: result.rows[0] })
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
