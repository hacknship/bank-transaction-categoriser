const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://tsdbadmin:MpU0fxLGpo6Lav1Q5nUKgJ5uV2xV3F1x@ixsj46nh85.ammqrgom7n.tsdb.cloud.timescale.com:39414/tsdb',
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('Attempting to connect to the database...');
    await client.connect();
    console.log('Successfully connected to the database.');
    
    console.log('Running test query (checking tables)...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:', tablesRes.rows.map(r => r.table_name).join(', '));

    console.log('Running test query (checking transactions count)...');
    const txRes = await client.query('SELECT COUNT(*) FROM transactions');
    console.log('Transactions count:', txRes.rows[0].count);

  } catch (error) {
    console.error('Database error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    try {
      await client.end();
      console.log('Connection closed.');
    } catch (e) {}
  }
}

testConnection();
