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
    console.error('Database error:', error.message);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
