import { useState, useEffect, useCallback } from 'react';
import { API } from '../utils/api';

function ExpenseTracker() {
  const [period, setPeriod] = useState('');
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setPeriod(currentPeriod);
  }, []);

  // Load available periods
  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  // Load budget when period changes
  useEffect(() => {
    if (period) {
      loadBudgetForPeriod(period);
    }
  }, [period]);

  const loadAvailablePeriods = async () => {
    try {
      const data = await API.getAvailablePeriods();
      setAvailablePeriods(data.periods || []);
    } catch (error) {
      console.error('Failed to load periods:', error);
    }
  };

  const loadBudgetForPeriod = async (selectedPeriod) => {
    setLoading(true);
    try {
      const data = await API.getBudgetForPeriod(selectedPeriod, 'expense');
      setBudgetData(data);
    } catch (error) {
      console.error('Failed to load budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (category) => {
    setEditingCategory(category);
    setEditAmount(category.budgeted_amount);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editAmount) return;

    try {
      await API.updateSnapshotBudget({
        period,
        categoryId: editingCategory.category_id,
        newAmount: parseFloat(editAmount),
        reason: 'Manual adjustment from tracker'
      });
      
      await loadBudgetForPeriod(period);
      setEditingCategory(null);
      setEditAmount('');
    } catch (error) {
      console.error('Failed to update budget:', error);
      alert('Failed to update budget: ' + error.message);
    }
  };

  const getProgressBarColor = (spent, budgeted) => {
    if (budgeted === 0) return '#ccc';
    const percent = (spent / budgeted) * 100;
    if (percent >= 100) return 'var(--red)';
    if (percent >= 80) return 'var(--yellow)';
    return 'var(--green)';
  };

  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount || 0).toLocaleString('en-MY', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    })}`;
  };

  const isPastMonth = () => {
    const today = new Date().toISOString().slice(0, 7);
    return period < today;
  };

  // Group budgets by period type
  const getBudgetsByPeriodType = () => {
    if (!budgetData?.budgets) return {};
    
    const grouped = {};
    budgetData.budgets.forEach(budget => {
      const periodType = budget.period_type || 'monthly';
      if (!grouped[periodType]) {
        grouped[periodType] = [];
      }
      grouped[periodType].push(budget);
    });
    return grouped;
  };

  const budgetsByType = getBudgetsByPeriodType();

  // Calculate summary for a group of budgets
  const calculateSummary = (budgets) => {
    // Use absolute values for spending since transactions are negative
    const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + Math.abs(parseFloat(b.actual_spent || 0)), 0);
    return {
      totalBudgeted,
      totalSpent,
      remaining: totalBudgeted - totalSpent,
      percentUsed: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
    };
  };

  // Render a budget section
  const renderBudgetSection = (title, periodType, budgets) => {
    if (!budgets || budgets.length === 0) return null;

    const summary = calculateSummary(budgets);

    return (
      <div key={periodType} style={{ marginBottom: '48px' }}>
        {/* Section Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h2 style={{ 
            margin: 0,
            background: '#FFD600',
            padding: '8px 16px',
            border: '3px solid #000',
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {title}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="filter-label">
              {periodType === 'yearly' ? 'Year:' : 'Month:'}
            </span>
            <select
              className="filter-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading}
            >
              {availablePeriods.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Description */}
        <p style={{ 
          color: '#666', 
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          In total, {formatCurrency(summary.totalSpent)} out of budgeted {formatCurrency(summary.totalBudgeted)} has been spent. 
          Balance: {formatCurrency(summary.remaining)}.
        </p>

        {/* Summary Stats for this section */}
        <div className="stats-bar" style={{ marginBottom: '24px' }}>
          <div className="stat-box">
            <div className="stat-label">Total Budgeted</div>
            <div className="stat-value">{formatCurrency(summary.totalBudgeted)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>
              {formatCurrency(summary.totalSpent)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Remaining</div>
            <div className="stat-value" style={{ 
              color: summary.remaining >= 0 ? 'var(--green)' : 'var(--red)'
            }}>
              {formatCurrency(summary.remaining)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Used</div>
            <div className="stat-value yellow">{summary.percentUsed}%</div>
          </div>
        </div>

        {/* Category Cards Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {budgets.map((category) => {
            const isEditing = editingCategory?.category_id === category.category_id;
            // Use absolute value for spent since transactions are negative
            const spent = Math.abs(parseFloat(category.actual_spent || 0));
            const budgeted = parseFloat(category.budgeted_amount || 0);
            const remaining = budgeted - spent;
            const percentUsed = budgeted > 0 
              ? Math.min(100, (spent / budgeted) * 100)
              : 0;
            const isOverBudget = remaining < 0;

            return (
              <div 
                key={category.category_id}
                style={{
                  background: '#fff',
                  border: '4px solid #000',
                  boxShadow: '6px 6px 0 #000',
                  padding: '20px',
                  position: 'relative'
                }}
              >
                {/* Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#FFD600',
                    border: '3px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    {category.category_icon || '📦'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '16px',
                      textTransform: 'uppercase'
                    }}>
                      {category.category_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Budget: {formatCurrency(budgeted)}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}>
                    <span>Spent: <strong>{formatCurrency(spent)}</strong></span>
                    <span style={{ color: isOverBudget ? 'var(--red)' : 'var(--green)' }}>
                      {isOverBudget ? 'Over: ' : 'Left: '}
                      <strong>{formatCurrency(Math.abs(remaining))}</strong>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    height: '12px',
                    background: '#e0e0e0',
                    border: '2px solid #000',
                    position: 'relative'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, percentUsed)}%`,
                      background: getProgressBarColor(spent, budgeted),
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  
                  <div style={{ 
                    textAlign: 'right', 
                    fontSize: '11px', 
                    marginTop: '4px',
                    color: '#888'
                  }}>
                    {Math.round(percentUsed)}% used
                  </div>
                </div>

                {/* Edit Button (only for past months) */}
                {isPastMonth() && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isEditing ? (
                      <>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '3px solid #000',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                        <button 
                          className="btn-small btn-yellow"
                          onClick={handleSaveEdit}
                        >
                          Save
                        </button>
                        <button 
                          className="btn-small"
                          onClick={() => setEditingCategory(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button 
                        className="btn-small"
                        onClick={() => handleEditClick(category)}
                        style={{ width: '100%' }}
                      >
                        ✏️ Edit Budget
                      </button>
                    )}
                  </div>
                )}

                {/* Over budget warning */}
                {isOverBudget && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: 'var(--red)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'center',
                    border: '2px solid #000'
                  }}>
                    ⚠️ Over Budget!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>📤 Expense Tracker</h1>
        <p>Track your spending against budgeted amounts</p>
      </header>

      {/* Period Selector Bar */}
      <div className="filter-bar" style={{ background: '#f5f5f5' }}>
        <span className="filter-label">Period:</span>
        <select
          className="filter-input"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={loading}
        >
          {availablePeriods.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {isPastMonth() && (
          <span style={{ 
            background: '#000', 
            color: '#FFD600', 
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            📜 Historical View
          </span>
        )}
      </div>

      {/* Budget Sections */}
      <div style={{ padding: '32px' }}>
        {loading ? (
          <div className="empty-state">
            <h2>Loading...</h2>
          </div>
        ) : !budgetData?.budgets?.length ? (
          <div className="empty-state">
            <h2>No Expense Categories</h2>
            <p>
              No expense categories found for this period. 
              Go to Settings → Categories to set up your budget categories with amounts.
            </p>
          </div>
        ) : (
          <>
            {/* Monthly Budgets */}
            {renderBudgetSection('Monthly Budget', 'monthly', budgetsByType['monthly'])}
            
            {/* Yearly Budgets */}
            {renderBudgetSection('Yearly Budget', 'yearly', budgetsByType['yearly'])}
            
            {/* Open Budgets */}
            {renderBudgetSection('Open Budget', 'open', budgetsByType['open'])}
          </>
        )}
      </div>
    </div>
  );
}

export default ExpenseTracker;
