const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get all months that have transaction data or budget snapshots
    const result = await client.query(`
      WITH all_periods AS (
        -- Periods from transactions
        SELECT DISTINCT 
          TO_CHAR(tx_date, 'YYYY-MM') as period,
          DATE_TRUNC('month', tx_date) as period_date
        FROM transactions
        WHERE tx_date IS NOT NULL
        
        UNION
        
        -- Periods from budget snapshots
        SELECT DISTINCT 
          TO_CHAR(period_start, 'YYYY-MM') as period,
          DATE_TRUNC('month', period_start) as period_date
        FROM budget_snapshots
        
        UNION
        
        -- Current month (always include)
        SELECT 
          TO_CHAR(CURRENT_DATE, 'YYYY-MM') as period,
          DATE_TRUNC('month', CURRENT_DATE) as period_date
      )
      SELECT 
        period,
        period_date,
        TO_CHAR(period_date, 'Month YYYY') as display_name
      FROM all_periods
      ORDER BY period DESC
    `);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        periods: result.rows.map(r => ({
          value: r.period,
          label: r.display_name.trim(),
          date: r.period_date
        }))
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
