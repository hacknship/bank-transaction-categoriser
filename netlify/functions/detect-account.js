const { Client } = require('pg');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
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
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
