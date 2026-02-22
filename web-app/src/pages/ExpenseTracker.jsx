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
      
      // Reload budget data
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

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>📤 Expense Tracker</h1>
        <p>Track your spending against budgeted amounts</p>
      </header>

      {/* Period Selector */}
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

      {/* Summary Stats */}
      {budgetData?.summary && (
        <div className="stats-bar">
          <div className="stat-box">
            <div className="stat-label">Total Budgeted</div>
            <div className="stat-value">{formatCurrency(budgetData.summary.totalBudgeted)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>
              {formatCurrency(budgetData.summary.totalSpent)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Remaining</div>
            <div className="stat-value" style={{ 
              color: budgetData.summary.remaining >= 0 ? 'var(--green)' : 'var(--red)'
            }}>
              {formatCurrency(budgetData.summary.remaining)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Used</div>
            <div className="stat-value yellow">{budgetData.summary.percentUsed}%</div>
          </div>
        </div>
      )}

      {/* Budget Categories Grid */}
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
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {budgetData.budgets.map((category) => {
              const isEditing = editingCategory?.category_id === category.category_id;
              const remaining = parseFloat(category.budgeted_amount || 0) - parseFloat(category.actual_spent || 0);
              const percentUsed = category.budgeted_amount > 0 
                ? Math.min(100, (category.actual_spent / category.budgeted_amount) * 100)
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
                        Budget: {formatCurrency(category.budgeted_amount)}
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
                      <span>Spent: <strong>{formatCurrency(category.actual_spent)}</strong></span>
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
                        width: `${percentUsed}%`,
                        background: getProgressBarColor(category.actual_spent, category.budgeted_amount),
                        transition: 'width 0.3s ease'
                      }} />
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
        )}
      </div>
    </div>
  );
}

export default ExpenseTracker;
