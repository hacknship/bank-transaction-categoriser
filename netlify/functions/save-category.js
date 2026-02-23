const { Client } = require('pg');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event, context) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(headers);
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { id, name, icon, color, type, affectScope } = JSON.parse(event.body);

    let result;
    
    if (id) {
      // Get current category to check for name/icon changes
      const currentCategoryResult = await client.query(
        'SELECT name, icon FROM categories WHERE id = $1',
        [id]
      );
      
      if (currentCategoryResult.rows.length === 0) {
        await client.end();
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Category not found' })
        };
      }
      
      const oldCategory = currentCategoryResult.rows[0];
      const oldName = oldCategory.name;
      const oldIcon = oldCategory.icon;
      const nameChanged = oldName !== name;
      const iconChanged = oldIcon !== icon;

      // Update existing category
      result = await client.query(`
        UPDATE categories 
        SET name = $1, icon = $2, color = $3, type = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [name, icon, color, type, id]);

      // Update budget_snapshots if name or icon changed
      if (nameChanged || iconChanged) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (nameChanged) {
          updates.push(`category_name = $${paramIndex++}`);
          params.push(name);
        }
        if (iconChanged) {
          updates.push(`category_icon = $${paramIndex++}`);
          params.push(icon);
        }

        params.push(id);
        await client.query(`
          UPDATE budget_snapshots 
          SET ${updates.join(', ')}
          WHERE category_id = $${paramIndex}
        `, params);
      }

      // Update transactions if affectScope is provided and name changed
      if (nameChanged && affectScope) {
        let dateCondition = '';
        const params = [oldName, name];

        if (affectScope === 'future') {
          // First day of next month
          dateCondition = `AND tx_date >= DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')`;
        } else if (affectScope === 'current-and-future') {
          // First day of current month
          dateCondition = `AND tx_date >= DATE_TRUNC('month', CURRENT_DATE)`;
        }
        // 'all' scope has no date condition

        await client.query(`
          UPDATE transactions 
          SET category = $2
          WHERE category = $1 ${dateCondition}
        `, params);
      }
    } else {
      // Insert new category
      result = await client.query(`
        INSERT INTO categories (name, icon, color, type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          type = EXCLUDED.type,
          updated_at = NOW()
        RETURNING *
      `, [name, icon, color, type]);
    }

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, category: result.rows[0] })
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
