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
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // ===== SYNC SNAPSHOTS WITH CURRENT CATEGORIES =====
    
    // 1. Delete snapshots for categories that no longer exist
    const deletedResult = await client.query(`
      DELETE FROM budget_snapshots bs
      WHERE bs.period_start = $1::date
      AND NOT EXISTS (
        SELECT 1 FROM categories c WHERE c.id = bs.category_id
      )
      RETURNING bs.category_name
    `, [periodStart]);
    
    if (deletedResult.rows.length > 0) {
      console.log('Deleted snapshots for removed categories:', deletedResult.rows.map(r => r.category_name));
    }

    // 2. Update snapshot names/icons to match current categories (in case they were renamed)
    const updatedResult = await client.query(`
      UPDATE budget_snapshots bs
      SET 
        category_name = c.name,
        category_icon = c.icon,
        category_type = c.type,
        updated_at = NOW()
      FROM categories c
      WHERE bs.category_id = c.id
      AND bs.period_start = $1::date
      AND (
        bs.category_name IS DISTINCT FROM c.name
        OR bs.category_icon IS DISTINCT FROM c.icon
        OR bs.category_type IS DISTINCT FROM c.type
      )
      RETURNING bs.category_name as old_name, c.name as new_name
    `, [periodStart]);
    
    if (updatedResult.rows.length > 0) {
      console.log('Updated snapshot names:', updatedResult.rows);
    }

    // 3. Ensure budget snapshots exist for all categories with budget_templates
    // First, get or create the budget version
    let versionResult = await client.query(`
      SELECT id FROM budget_versions 
      WHERE effective_from <= $1 
      AND (effective_to IS NULL OR effective_to >= $1)
      ORDER BY effective_from DESC 
      LIMIT 1
    `, [periodStart]);

    let versionId;
    if (versionResult.rows.length === 0) {
      // Create initial version
      const newVersion = await client.query(`
        INSERT INTO budget_versions (name, effective_from, effective_to)
        VALUES ($1, $2, NULL)
        RETURNING id
      `, ['Initial Budget', periodStart]);
      versionId = newVersion.rows[0].id;
    } else {
      versionId = versionResult.rows[0].id;
    }

    // 4. Create snapshots for categories with budget_templates that don't have one for this period
    await client.query(`
      INSERT INTO budget_snapshots (
        period_type, period_start, period_end,
        category_id, category_name, category_icon, category_type,
        budgeted_amount, budget_version_id
      )
      SELECT 
        COALESCE(bt.period_type, 'monthly'),
        $1::date,
        $2::date,
        c.id,
        c.name,
        c.icon,
        c.type,
        COALESCE(bt.amount, 0),
        $3
      FROM categories c
      INNER JOIN budget_templates bt ON bt.category_id = c.id
      WHERE NOT EXISTS (
        SELECT 1 FROM budget_snapshots bs
        WHERE bs.period_start = $1::date
        AND bs.category_id = c.id
      )
    `, [periodStart, periodEndStr, versionId]);

    // 5. Update existing snapshots if the template amount has changed
    const amountUpdateResult = await client.query(`
      UPDATE budget_snapshots bs
      SET 
        budgeted_amount = COALESCE(bt.amount, 0),
        period_type = COALESCE(bt.period_type, 'monthly'),
        updated_at = NOW()
      FROM budget_templates bt
      WHERE bs.category_id = bt.category_id
      AND bs.period_start = $1::date
      AND (
        bs.budgeted_amount IS DISTINCT FROM COALESCE(bt.amount, 0)
        OR bs.period_type IS DISTINCT FROM COALESCE(bt.period_type, 'monthly')
      )
      RETURNING bs.category_name, bs.budgeted_amount, COALESCE(bt.amount, 0) as new_amount
    `, [periodStart]);
    
    if (amountUpdateResult.rows.length > 0) {
      console.log('Updated snapshot amounts:', amountUpdateResult.rows);
    }

    // Get all snapshots for this period with actual spending
    let query = `
      SELECT 
        bs.id,
        bs.category_id,
        bs.category_name,
        bs.category_icon,
        bs.category_type,
        bs.budgeted_amount,
        bs.period_type,
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.category = bs.category_name
           AND t.tx_date >= $1
           AND t.tx_date <= $2),
          0
        ) as actual_spent
      FROM budget_snapshots bs
      WHERE bs.period_start = $1
    `;
    const queryParams = [periodStart, periodEndStr];

    if (type) {
      query += ` AND bs.category_type = $3`;
      queryParams.push(type);
    }

    query += ` ORDER BY bs.period_type, bs.category_name`;

    const result = await client.query(query, queryParams);
    let budgets = result.rows;

    // Filter to only show tracker-enabled items (for current/future months)
    const today = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (period >= today) {
      const templateResult = await client.query(
        'SELECT category_id FROM budget_templates WHERE show_in_tracker = TRUE'
      );
      const trackerCategories = new Set(templateResult.rows.map(r => r.category_id));
      budgets = budgets.filter(b => trackerCategories.has(b.category_id));
    }

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + Math.abs(parseFloat(b.actual_spent || 0)), 0);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period,
        periodType: 'monthly',
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
    console.error('Function error:', error);
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        detail: error.detail,
        hint: error.hint
      })
    };
  }
};
