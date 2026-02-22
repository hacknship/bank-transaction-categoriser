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

    const { categoryId, amount, periodType, showInTracker, effectiveFrom } = JSON.parse(event.body);

    if (!categoryId || amount === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'categoryId and amount are required' })
      };
    }

    const effectiveDate = effectiveFrom || new Date().toISOString().slice(0, 10);

    // Use the database function to update template and handle versioning
    await client.query(
      'SELECT update_budget_template($1, $2, $3, $4, $5)',
      [categoryId, amount, periodType || 'monthly', showInTracker !== false, effectiveDate]
    );

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Budget updated successfully' })
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
