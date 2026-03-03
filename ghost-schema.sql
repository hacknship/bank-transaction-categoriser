-- Maybank Budget Tracker Schema for Ghost.build
-- Run: ghost db create mbt_budget_tracker --schema ghost-schema.sql

-- Categories table (expense vs savings)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',
    color VARCHAR(7) DEFAULT '#FFD600',
    type VARCHAR(20) DEFAULT 'expense', -- 'expense' or 'savings'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(100) UNIQUE NOT NULL,
    account_id VARCHAR(100),
    account_name VARCHAR(255),
    tx_date DATE NOT NULL,
    budget_date DATE,
    description TEXT,
    amount DECIMAL(12,2),
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Budgets table (for future budget tracking)
CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    amount DECIMAL(12,2) NOT NULL,
    cadence VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly', etc.
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_tx_date ON transactions(tx_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_tx_id ON transactions(tx_id);

-- Default categories
INSERT INTO categories (name, icon, color, type) VALUES
    ('Food', '🍔', '#FFD600', 'expense'),
    ('Transport', '🚗', '#333333', 'expense'),
    ('Dining', '🍽️', '#FF3333', 'expense'),
    ('Shopping', '🛍️', '#00C853', 'expense'),
    ('Medical', '💊', '#FF5555', 'expense'),
    ('Entertainment', '🎬', '#9C27B0', 'expense'),
    ('Utilities', '💡', '#FFD600', 'expense'),
    ('Groceries', '🛒', '#4CAF50', 'expense'),
    ('Education', '📚', '#2196F3', 'expense'),
    ('Rent', '🏠', '#795548', 'expense'),
    ('Others', '📦', '#666666', 'expense'),
    ('Savings', '🏦', '#00BCD4', 'savings'),
    ('Investments', '📈', '#3F51B5', 'savings'),
    ('Emergency Fund', '🛡️', '#009688', 'savings');
