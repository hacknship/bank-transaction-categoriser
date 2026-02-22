-- ============================================
-- Budget Tracking Schema Extension
-- Adds budget versioning, templates, and snapshots
-- Compatible with existing INTEGER ID structure
-- ============================================

-- ============================================
-- 1. BUDGET TEMPLATES (Current Active Budgets)
-- These are the "template" budgets that users edit
-- Changes here apply to current and future periods
-- ============================================
CREATE TABLE IF NOT EXISTS budget_templates (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    period_type VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly', 'open'
    show_in_tracker BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category_id)
);

-- ============================================
-- 2. BUDGET VERSIONS (Track When Budget Structure Changes)
-- Each time user updates budget, we create a new version
-- with an effective date
-- ============================================
CREATE TABLE IF NOT EXISTS budget_versions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255), -- optional name like "March 2025 Adjustment"
    effective_from DATE NOT NULL, -- when this budget version became active
    effective_to DATE, -- null means currently active
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. BUDGET SNAPSHOTS (Immutable Period Copies)
-- Created lazily when a period is first viewed
-- Stores the exact budget that was active for that period
-- ============================================
CREATE TABLE IF NOT EXISTS budget_snapshots (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL, -- 'monthly', 'yearly'
    period_start DATE NOT NULL, -- e.g., 2025-03-01
    period_end DATE NOT NULL,   -- e.g., 2025-03-31
    category_id INTEGER REFERENCES categories(id),
    category_name VARCHAR(100) NOT NULL, -- denormalized for historical accuracy
    category_icon VARCHAR(10), -- denormalized
    category_type VARCHAR(20), -- 'expense' or 'savings'
    budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    actual_spent DECIMAL(12,2) DEFAULT 0, -- cached for performance
    budget_version_id INTEGER REFERENCES budget_versions(id),
    notes TEXT, -- for historical adjustments
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period_start, category_id)
);

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_budget_templates_category ON budget_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_period ON budget_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_category ON budget_snapshots(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_period_type ON budget_snapshots(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_budget_versions_effective ON budget_versions(effective_from, effective_to);

-- ============================================
-- 5. TRIGGER TO AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_budget_templates_updated_at ON budget_templates;
CREATE TRIGGER update_budget_templates_updated_at
    BEFORE UPDATE ON budget_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_snapshots_updated_at ON budget_snapshots;
CREATE TRIGGER update_budget_snapshots_updated_at
    BEFORE UPDATE ON budget_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. FUNCTION: Get or Create Budget Snapshot for a Period
-- This is called lazily when viewing a period
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_budget_snapshot(
    p_period_start DATE,
    p_period_type TEXT DEFAULT 'monthly'
)
RETURNS TABLE (
    id INTEGER,
    category_id INTEGER,
    category_name VARCHAR,
    category_icon VARCHAR,
    category_type VARCHAR,
    budgeted_amount DECIMAL,
    actual_spent DECIMAL
) AS $$
DECLARE
    v_period_end DATE;
    v_version_id INTEGER;
BEGIN
    -- Calculate period end
    IF p_period_type = 'monthly' THEN
        v_period_end := (p_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    ELSE
        v_period_end := (p_period_start + INTERVAL '1 year' - INTERVAL '1 day')::DATE;
    END IF;

    -- Get the active budget version for this period
    SELECT id INTO v_version_id
    FROM budget_versions
    WHERE effective_from <= p_period_start
      AND (effective_to IS NULL OR effective_to >= p_period_start)
    ORDER BY effective_from DESC
    LIMIT 1;

    -- If no version exists, create initial one
    IF v_version_id IS NULL THEN
        INSERT INTO budget_versions (name, effective_from, effective_to)
        VALUES ('Initial Budget', p_period_start, NULL)
        RETURNING id INTO v_version_id;
    END IF;

    -- Create snapshots for any missing categories
    INSERT INTO budget_snapshots (
        period_type, period_start, period_end,
        category_id, category_name, category_icon, category_type,
        budgeted_amount, budget_version_id
    )
    SELECT 
        p_period_type,
        p_period_start,
        v_period_end,
        c.id,
        c.name,
        c.icon,
        c.type,
        COALESCE(bt.amount, 0),
        v_version_id
    FROM categories c
    LEFT JOIN budget_templates bt ON bt.category_id = c.id
    WHERE NOT EXISTS (
        SELECT 1 FROM budget_snapshots bs
        WHERE bs.period_start = p_period_start
          AND bs.category_id = c.id
    );

    -- Return all snapshots for this period with actual spending
    RETURN QUERY
    SELECT 
        bs.id,
        bs.category_id,
        bs.category_name,
        bs.category_icon,
        bs.category_type,
        bs.budgeted_amount,
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             WHERE t.category = bs.category_name
               AND t.tx_date >= p_period_start
               AND t.tx_date <= v_period_end),
            0
        )::DECIMAL as actual_spent
    FROM budget_snapshots bs
    WHERE bs.period_start = p_period_start
    ORDER BY bs.category_type, bs.category_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION: Update Budget Template and Create New Version
-- ============================================
CREATE OR REPLACE FUNCTION update_budget_template(
    p_category_id INTEGER,
    p_amount DECIMAL,
    p_period_type TEXT,
    p_show_in_tracker BOOLEAN,
    p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
    v_old_version_id INTEGER;
    v_new_version_id INTEGER;
BEGIN
    -- Get current active version
    SELECT id INTO v_old_version_id
    FROM budget_versions
    WHERE effective_to IS NULL
    ORDER BY effective_from DESC
    LIMIT 1;

    -- Close old version if exists and different date
    IF v_old_version_id IS NOT NULL THEN
        UPDATE budget_versions
        SET effective_to = p_effective_from - INTERVAL '1 day'
        WHERE id = v_old_version_id
          AND effective_from < p_effective_from;
    END IF;

    -- Create new version
    INSERT INTO budget_versions (name, effective_from, effective_to)
    VALUES (
        'Budget Update ' || TO_CHAR(p_effective_from, 'YYYY-MM-DD'),
        p_effective_from,
        NULL
    )
    RETURNING id INTO v_new_version_id;

    -- Update or insert template
    INSERT INTO budget_templates (category_id, amount, period_type, show_in_tracker)
    VALUES (p_category_id, p_amount, p_period_type, p_show_in_tracker)
    ON CONFLICT (category_id) DO UPDATE SET
        amount = EXCLUDED.amount,
        period_type = EXCLUDED.period_type,
        show_in_tracker = EXCLUDED.show_in_tracker,
        updated_at = NOW();

    -- Refresh all future snapshots to use new budget
    UPDATE budget_snapshots
    SET budgeted_amount = p_amount,
        budget_version_id = v_new_version_id,
        updated_at = NOW()
    WHERE period_start >= p_effective_from
      AND category_id = p_category_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. MIGRATION: Create initial budget templates from existing data
-- This preserves existing budget data if any
-- ============================================

-- Migrate from existing budgets table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        INSERT INTO budget_templates (category_id, amount, period_type, show_in_tracker)
        SELECT 
            b.category_id,
            b.amount,
            COALESCE(b.cadence, 'monthly'),
            TRUE
        FROM budgets b
        WHERE b.effective_to IS NULL
          OR b.effective_to >= CURRENT_DATE
        ON CONFLICT (category_id) DO UPDATE SET
            amount = EXCLUDED.amount,
            period_type = EXCLUDED.period_type,
            updated_at = NOW();
    END IF;
END $$;

-- Create initial budget version if none exists
INSERT INTO budget_versions (name, effective_from, effective_to)
SELECT 
    'Initial Budget',
    CURRENT_DATE - INTERVAL '1 year',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM budget_versions);
