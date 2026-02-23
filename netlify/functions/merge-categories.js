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

exports.handler = async (event, context) => {
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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const body = JSON.parse(event.body);
    const {
      sourceCategoryId,
      targetCategoryId,
      categoryId,
      newName,
      newIcon,
      affectScope = 'future',
    } = body;

    // Validate input: must have either (source+target) for merge OR (categoryId+newName) for rename
    const hasMergeParams = sourceCategoryId !== undefined && targetCategoryId !== undefined;
    const hasRenameParams = categoryId !== undefined && newName !== undefined;

    if (!hasMergeParams && !hasRenameParams) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid input. Provide either (sourceCategoryId + targetCategoryId) for merge or (categoryId + newName) for rename.',
        }),
      };
    }

    await client.connect();

    // Calculate date ranges for scope filtering
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Format dates for SQL comparison (YYYY-MM-DD)
    const formatDate = (date) => date.toISOString().split('T')[0];

    let result;

    if (hasMergeParams) {
      // ===== MERGE OPERATION =====
      result = await performMerge(client, {
        sourceCategoryId,
        targetCategoryId,
        affectScope,
        currentMonthStart: formatDate(currentMonthStart),
        nextMonthStart: formatDate(nextMonthStart),
      });
    } else {
      // ===== RENAME OPERATION =====
      result = await performRename(client, {
        categoryId,
        newName,
        newIcon,
        affectScope,
        currentMonthStart: formatDate(currentMonthStart),
        nextMonthStart: formatDate(nextMonthStart),
      });
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Database error:', error.message);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

/**
 * Perform merge operation: move all data from source category to target category
 */
async function performMerge(client, params) {
  const { sourceCategoryId, targetCategoryId, affectScope, currentMonthStart, nextMonthStart } = params;

  // Get category names
  const sourceResult = await client.query(
    'SELECT name FROM categories WHERE id = $1',
    [sourceCategoryId]
  );

  if (sourceResult.rows.length === 0) {
    throw new Error(`Source category with ID ${sourceCategoryId} not found`);
  }

  const targetResult = await client.query(
    'SELECT name FROM categories WHERE id = $1',
    [targetCategoryId]
  );

  if (targetResult.rows.length === 0) {
    throw new Error(`Target category with ID ${targetCategoryId} not found`);
  }

  const sourceCategoryName = sourceResult.rows[0].name;
  const targetCategoryName = targetResult.rows[0].name;

  // Determine date filter based on affectScope
  let dateFilter = '';
  let queryParams = [sourceCategoryName, targetCategoryName];

  if (affectScope === 'future') {
    dateFilter = 'AND tx_date >= $3';
    queryParams.push(nextMonthStart);
  } else if (affectScope === 'current-and-future') {
    dateFilter = 'AND tx_date >= $3';
    queryParams.push(currentMonthStart);
  }
  // 'all' has no date filter

  // Update transactions: change source category name to target category name
  const updateTransactionsResult = await client.query(
    `UPDATE transactions 
     SET category = $2 
     WHERE category = $1 ${dateFilter}
     RETURNING id`,
    queryParams
  );

  const affectedTransactions = updateTransactionsResult.rows.length;

  // Update budget_templates: move source category_id to target category_id
  // First, check if there's already a budget template for the target category
  const existingBudgetResult = await client.query(
    'SELECT id FROM budget_templates WHERE category_id = $1',
    [targetCategoryId]
  );

  if (existingBudgetResult.rows.length > 0) {
    // Target already has a budget template, delete the source one
    await client.query(
      'DELETE FROM budget_templates WHERE category_id = $1',
      [sourceCategoryId]
    );
  } else {
    // Move source budget template to target category
    await client.query(
      'UPDATE budget_templates SET category_id = $1 WHERE category_id = $2',
      [targetCategoryId, sourceCategoryId]
    );
  }

  // Delete source category
  await client.query(
    'DELETE FROM categories WHERE id = $1',
    [sourceCategoryId]
  );

  return {
    success: true,
    operation: 'merge',
    affectedTransactions,
    from: sourceCategoryName,
    to: targetCategoryName,
  };
}

/**
 * Perform rename operation: update category name and optionally icon
 */
async function performRename(client, params) {
  const { categoryId, newName, newIcon, affectScope, currentMonthStart, nextMonthStart } = params;

  // Get current category info
  const categoryResult = await client.query(
    'SELECT name, icon FROM categories WHERE id = $1',
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    throw new Error(`Category with ID ${categoryId} not found`);
  }

  const oldCategoryName = categoryResult.rows[0].name;
  const oldIcon = categoryResult.rows[0].icon;

  // Build update fields for categories table
  const updateFields = ['name = $1'];
  const updateValues = [newName];
  let paramIndex = 2;

  if (newIcon !== undefined) {
    updateFields.push(`icon = $${paramIndex}`);
    updateValues.push(newIcon);
    paramIndex++;
  }

  updateValues.push(categoryId);

  // Update category in categories table
  await client.query(
    `UPDATE categories SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
    updateValues
  );

  // Update transactions based on affectScope
  let dateFilter = '';
  let queryParams = [oldCategoryName, newName];

  if (affectScope === 'future') {
    dateFilter = 'AND tx_date >= $3';
    queryParams.push(nextMonthStart);
  } else if (affectScope === 'current-and-future') {
    dateFilter = 'AND tx_date >= $3';
    queryParams.push(currentMonthStart);
  }
  // 'all' has no date filter

  const updateTransactionsResult = await client.query(
    `UPDATE transactions 
     SET category = $2 
     WHERE category = $1 ${dateFilter}
     RETURNING id`,
    queryParams
  );

  const affectedTransactions = updateTransactionsResult.rows.length;

  return {
    success: true,
    operation: 'rename',
    affectedTransactions,
    from: oldCategoryName,
    to: newName,
    iconChanged: newIcon !== undefined && newIcon !== oldIcon,
  };
}
