const { Client } = require('pg');

const getCorsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
};

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
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

  const client = new Client({
    connectionString: process.env.GHOST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const params = event.queryStringParameters || {};
    const { accountId, monthYear } = params;

    if (!accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'accountId is required' })
      };
    }

    // Get account info
    const accountResult = await client.query(
      'SELECT * FROM accounts WHERE account_id = $1',
      [accountId]
    );

    // Get total spent for the month
    const spentQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_spent,
             COUNT(*) as transaction_count,
             COUNT(CASE WHEN category IS NULL OR category = '' THEN 1 END) as uncategorized_count
      FROM transactions
      WHERE account_id = $1
      ${monthYear ? "AND DATE_TRUNC('month', tx_date) = $2" : ''}
    `;

    const spentParams = monthYear ? [accountId, monthYear] : [accountId];
    const spentResult = await client.query(spentQuery, spentParams);

    // Get budget summary
    const budgetQuery = `
      SELECT COALESCE(SUM(monthly_budget), 0) as total_budget
      FROM budget_categories
      WHERE account_id = $1 AND is_active = true
      ${monthYear ? "AND month_year = $2" : ''}
    `;

    const budgetResult = await client.query(budgetQuery, spentParams);

    await client.end();

    const account = accountResult.rows[0];
    const spent = spentResult.rows[0];
    const budget = budgetResult.rows[0];

    const reconciliation = {
      account: account,
      bankBalance: account?.available_balance || 0,
      totalSpent: parseFloat(spent.total_spent),
      totalBudget: parseFloat(budget.total_budget),
      transactionCount: parseInt(spent.transaction_count),
      uncategorizedCount: parseInt(spent.uncategorized_count),
      remainingBudget: parseFloat(budget.total_budget) - parseFloat(spent.total_spent),
      variance: parseFloat(account?.available_balance || 0) + parseFloat(spent.total_spent)
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(reconciliation)
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
