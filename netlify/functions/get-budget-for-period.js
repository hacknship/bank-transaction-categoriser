const { Client } = require('pg');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const params = event.queryStringParameters || {};
    const { period, type } = params;

    if (!period) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Period parameter is required (format: YYYY-MM)' })
      };
    }

    // Parse period (e.g., "2025-03" -> "2025-03-01")
    const periodStart = `${period}-01`;
    const periodType = 'monthly';

    // Get or create budget snapshot for this period
    const result = await client.query(
      'SELECT * FROM get_or_create_budget_snapshot($1, $2)',
      [periodStart, periodType]
    );

    // Filter by type if specified
    let budgets = result.rows;
    if (type) {
      budgets = budgets.filter(b => b.category_type === type);
    }

    // Filter to only show tracker-enabled items (for current/future months)
    const today = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (period >= today) {
      // For current/future, only show templates marked for tracker
      const templateResult = await client.query(
        'SELECT category_id FROM budget_templates WHERE show_in_tracker = TRUE'
      );
      const trackerCategories = new Set(templateResult.rows.map(r => r.category_id));
      budgets = budgets.filter(b => trackerCategories.has(b.category_id));
    }

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.actual_spent || 0), 0);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period,
        periodType,
        budgets,
        summary: {
          totalBudgeted,
          totalSpent,
          remaining: totalBudgeted - totalSpent,
          percentUsed: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
        }
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
