const { Client } = require('pg');
require('./utils/db');
const { validateApiKey, unauthorizedResponse } = require('./utils/auth');

const getCorsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
};

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Validate API key (allow health check key for this endpoint)
  const auth = validateApiKey(event, true);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error, headers);
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.GHOST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { accountId, accountNumber, accountName, availableBalance, balanceDate } = JSON.parse(event.body);

    // Upsert account
    const result = await client.query(`
      INSERT INTO accounts (account_id, account_number, account_name, available_balance, balance_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (account_id)
      DO UPDATE SET 
        account_name = EXCLUDED.account_name,
        available_balance = EXCLUDED.available_balance,
        balance_date = EXCLUDED.balance_date,
        updated_at = NOW()
      RETURNING *;
    `, [accountId, accountNumber, accountName, availableBalance, balanceDate]);

    // Also save balance snapshot
    await client.query(`
      INSERT INTO balance_snapshots (account_id, balance_date, available_balance)
      VALUES ($1, $2, $3)
      ON CONFLICT (account_id, balance_date)
      DO UPDATE SET available_balance = EXCLUDED.available_balance, recorded_at = NOW();
    `, [accountId, balanceDate, availableBalance]);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, account: result.rows[0] })
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
