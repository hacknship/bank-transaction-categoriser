const { Client } = require('pg');

exports.handler = async (event) => {
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
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { period, categoryId, newAmount, reason } = JSON.parse(event.body);

    if (!period || !categoryId || newAmount === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'period, categoryId, and newAmount are required' })
      };
    }

    const periodStart = `${period}-01`;

    // Update the specific snapshot for this period
    const result = await client.query(`
      UPDATE budget_snapshots
      SET budgeted_amount = $1,
          updated_at = NOW(),
          notes = COALESCE(notes || '; ', '') || $2
      WHERE period_start = $3
        AND category_id = $4
      RETURNING *
    `, [newAmount, `Historical adjustment: ${reason || 'No reason provided'}`, periodStart, categoryId]);

    if (result.rowCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Budget snapshot not found for this period and category' })
      };
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Historical budget updated successfully',
        snapshot: result.rows[0]
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
