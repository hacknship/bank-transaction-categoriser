const { Client } = require('pg');
require('./utils/db');
const { validateApiKey, unauthorizedResponse } = require('./utils/auth');

const getCorsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
};

exports.handler = async (event, context) => {
  const headers = getCorsHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Validate API key (do NOT allow health check key for write operations)
  const auth = validateApiKey(event, false);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error, headers);
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

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { id, mode = 'unused' } = JSON.parse(event.body);

    // Validate ID
    if (!id) {
      await client.end();
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'ID required' }) 
      };
    }

    // Validate mode
    const validModes = ['unused', 'current-month', 'all-months'];
    if (!validModes.includes(mode)) {
      await client.end();
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Invalid mode. Must be one of: unused, current-month, all-months' }) 
      };
    }

    // Get category info first
    const categoryResult = await client.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );

    if (categoryResult.rowCount === 0) {
      await client.end();
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ error: 'Category not found' }) 
      };
    }

    const category = categoryResult.rows[0];

    // Count transactions using this category (by category name)
    const transactionCountResult = await client.query(
      'SELECT COUNT(*) as count FROM transactions WHERE category = $1',
      [category.name]
    );
    const transactionCount = parseInt(transactionCountResult.rows[0].count, 10);

    // Check if category has budget_templates
    const budgetTemplateResult = await client.query(
      'SELECT COUNT(*) as count FROM budget_templates WHERE category_id = $1',
      [id]
    );
    const hasBudgetTemplate = parseInt(budgetTemplateResult.rows[0].count, 10) > 0;

    // Mode: unused - only delete if no transactions use it
    if (mode === 'unused') {
      if (transactionCount > 0) {
        await client.end();
        return { 
          statusCode: 409, 
          headers, 
          body: JSON.stringify({ 
            error: 'Category in use', 
            transactionCount: transactionCount,
            modeRequired: true 
          }) 
        };
      }
      // No transactions, proceed to delete (budget_templates will be handled below)
    }

    let affectedTransactions = 0;

    // Mode: current-month - set current month's transactions to 'Uncategorized'
    if (mode === 'current-month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const updateResult = await client.query(
        `UPDATE transactions 
         SET category = 'Uncategorized', updated_at = NOW()
         WHERE category = $1 
           AND tx_date >= $2 
           AND tx_date <= $3`,
        [category.name, startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
      );
      affectedTransactions = updateResult.rowCount;
    }

    // Mode: all-months - set ALL transactions to 'Uncategorized'
    if (mode === 'all-months') {
      const updateResult = await client.query(
        `UPDATE transactions 
         SET category = 'Uncategorized', updated_at = NOW()
         WHERE category = $1`,
        [category.name]
      );
      affectedTransactions = updateResult.rowCount;
    }

    // Delete from budget_templates first (foreign key constraint)
    await client.query(
      'DELETE FROM budget_templates WHERE category_id = $1',
      [id]
    );

    // Also clean up budget_snapshots (keep historical record but category is being deleted)
    // Note: budget_snapshots has a foreign key to categories(id), so we need to handle it
    // Options: 1) Delete snapshots, 2) Set category_id to null (if nullable), 3) Keep category
    // Since the requirement is to delete the category, we'll delete related snapshots
    await client.query(
      'DELETE FROM budget_snapshots WHERE category_id = $1',
      [id]
    );

    // Finally delete the category
    const deleteResult = await client.query(
      'DELETE FROM categories WHERE id = $1 RETURNING *',
      [id]
    );

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        deleted: { 
          id: deleteResult.rows[0].id, 
          name: deleteResult.rows[0].name 
        },
        affectedTransactions: affectedTransactions
      })
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
