-- Maybank Budget Tracker Database Schema
-- Ghost.build PostgreSQL

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT UNIQUE NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT,
    available_balance DECIMAL(12,2),
    current_balance DECIMAL(12,2),
    balance_date DATE,
    bank_name TEXT DEFAULT 'Maybank',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    account_id TEXT REFERENCES accounts(account_id),
    tx_date DATE NOT NULL,
    description TEXT,
    amount DECIMAL(12,2),
    category TEXT,
    notes TEXT,
    categorized_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Budget Categories (Monthly)
CREATE TABLE budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT REFERENCES accounts(account_id),
    month_year DATE NOT NULL,
    category_name TEXT NOT NULL,
    monthly_budget DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id, month_year, category_name)
);

-- Budget History (Archive)
CREATE TABLE budget_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT REFERENCES accounts(account_id),
    month_year DATE NOT NULL,
    category_name TEXT,
    budgeted DECIMAL(12,2),
    actual_spent DECIMAL(12,2),
    variance DECIMAL(12,2),
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Balance Snapshots
CREATE TABLE balance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT REFERENCES accounts(account_id),
    balance_date DATE NOT NULL,
    available_balance DECIMAL(12,2),
    current_balance DECIMAL(12,2),
    one_day_float DECIMAL(12,2) DEFAULT 0,
    two_day_float DECIMAL(12,2) DEFAULT 0,
    late_clearing_float DECIMAL(12,2) DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id, balance_date)
);

-- Indexes for performance
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_tx_date ON transactions(tx_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_budget_categories_account_month ON budget_categories(account_id, month_year);
CREATE INDEX idx_budget_history_account_month ON budget_history(account_id, month_year);
