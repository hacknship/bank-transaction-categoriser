const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const table = event.queryStringParameters?.table || 'transactions';
    
    // Get column info for specified table
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [table]);
    
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        table: table,
        tableExists: tableCheck.rows[0].exists,
        columns: result.rows
      }, null, 2)
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
