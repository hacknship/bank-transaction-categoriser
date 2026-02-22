import { useState, useEffect, useCallback } from 'react';
import { API } from '../utils/api';

function SavingsTracker() {
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
      const data = await API.getBudgetForPeriod(selectedPeriod, 'savings');
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
      <header className="header" style={{ background: '#FFD600', color: '#000', borderBottomColor: '#000' }}>
        <h1>📥 Savings & Investment Tracker</h1>
        <p style={{ color: '#333' }}>Track your savings goals and investment progress</p>
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
            <div className="stat-label">Target Savings</div>
            <div className="stat-value">{formatCurrency(budgetData.summary.totalBudgeted)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Actually Saved</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>
              {formatCurrency(Math.abs(budgetData.summary.totalSpent))}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Progress</div>
            <div className="stat-value" style={{ 
              color: budgetData.summary.percentUsed >= 100 ? 'var(--green)' : 'var(--black)'
            }}>
              {Math.min(100, budgetData.summary.percentUsed)}%
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Categories</div>
            <div className="stat-value yellow">{budgetData.budgets?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Savings Categories Grid */}
      <div style={{ padding: '32px' }}>
        {loading ? (
          <div className="empty-state">
            <h2>Loading...</h2>
          </div>
        ) : !budgetData?.budgets?.length ? (
          <div className="empty-state">
            <h2>No Savings Categories</h2>
            <p>
              No savings or investment categories found for this period. 
              Go to Settings → Categories to set up your savings categories with target amounts.
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
              const saved = Math.abs(parseFloat(category.actual_spent || 0));
              const target = parseFloat(category.budgeted_amount || 0);
              const remaining = target - saved;
              const percentComplete = target > 0 
                ? Math.min(100, (saved / target) * 100)
                : 0;
              const isGoalMet = saved >= target;

              return (
                <div 
                  key={category.category_id}
                  style={{
                    background: '#000',
                    border: '4px solid #000',
                    boxShadow: '6px 6px 0 #FFD600',
                    padding: '20px',
                    position: 'relative',
                    color: '#fff'
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
                      border: '3px solid #FFD600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      {category.category_icon || '🏦'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 700, 
                        fontSize: '16px',
                        textTransform: 'uppercase',
                        color: '#FFD600'
                      }}>
                        {category.category_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa' }}>
                        Target: {formatCurrency(target)}
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
                      <span style={{ color: '#ccc' }}>
                        Saved: <strong style={{ color: '#fff' }}>{formatCurrency(saved)}</strong>
                      </span>
                      <span style={{ color: isGoalMet ? 'var(--green)' : '#FFD600' }}>
                        {isGoalMet ? 'Goal Met! 🎉' : `Left: ${formatCurrency(remaining)}`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      height: '12px',
                      background: '#333',
                      border: '2px solid #FFD600',
                      position: 'relative'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${percentComplete}%`,
                        background: isGoalMet ? 'var(--green)' : '#FFD600',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    
                    <div style={{ 
                      textAlign: 'right', 
                      fontSize: '11px', 
                      marginTop: '4px',
                      color: '#888'
                    }}>
                      {Math.round(percentComplete)}% complete
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
                              border: '3px solid #FFD600',
                              fontSize: '14px',
                              background: '#000',
                              color: '#fff'
                            }}
                            autoFocus
                          />
                          <button 
                            className="btn-small"
                            onClick={handleSaveEdit}
                            style={{ background: '#FFD600', color: '#000', borderColor: '#FFD600' }}
                          >
                            Save
                          </button>
                          <button 
                            className="btn-small"
                            onClick={() => setEditingCategory(null)}
                            style={{ background: '#333', color: '#fff', borderColor: '#FFD600' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          className="btn-small"
                          onClick={() => handleEditClick(category)}
                          style={{ 
                            width: '100%',
                            background: '#333',
                            color: '#FFD600',
                            borderColor: '#FFD600'
                          }}
                        >
                          ✏️ Edit Target
                        </button>
                      )}
                    </div>
                  )}

                  {/* Goal met badge */}
                  {isGoalMet && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px',
                      background: 'var(--green)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'center',
                      border: '2px solid #FFD600'
                    }}>
                      🎯 Goal Achieved!
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

export default SavingsTracker;
