const { Client } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
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

    const { id, name, icon, color, type } = JSON.parse(event.body);

    let result;
    if (id) {
      // Update existing category
      result = await client.query(`
        UPDATE categories 
        SET name = $1, icon = $2, color = $3, type = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [name, icon, color, type, id]);
    } else {
      // Insert new category
      result = await client.query(`
        INSERT INTO categories (name, icon, color, type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          type = EXCLUDED.type,
          updated_at = NOW()
        RETURNING *
      `, [name, icon, color, type]);
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, category: result.rows[0] })
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
