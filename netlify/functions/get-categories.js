const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event, context) => {
  // Get CORS headers based on request origin
  const headers = getCorsHeaders(event.headers.origin);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT * FROM categories
      ORDER BY type, name
    `);
    
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ categories: result.rows })
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
