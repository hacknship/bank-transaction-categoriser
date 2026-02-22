const { Client } = require('pg');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get column info
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `);
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'transactions'
      )
    `);
    
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
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
