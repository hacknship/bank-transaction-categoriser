import { useState, useEffect, useMemo } from 'react';
import { useBudget, useAvailablePeriods, useUpdateSnapshotBudget } from '../hooks/useBudget';
import { queryClient } from '../lib/queryClient';
import { API } from '../utils/api';
import { parseISO } from '../utils/dateUtils';

function SavingsTracker() {
  const [period, setPeriod] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  // Modal state for transactions
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Initialize with current month (local-time aware)
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    setPeriod(`${year}-${month}`);
  }, []);

  // TanStack Query hooks
  const { data: availablePeriods = [] } = useAvailablePeriods();
  const {
    data: budgetData,
    isLoading,
    isFetching,
    refetch
  } = useBudget(period, 'savings');

  const updateSnapshotMutation = useUpdateSnapshotBudget();

  const handleEditClick = (category) => {
    setEditingCategory(category);
    setEditAmount(category.budgeted_amount);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editAmount) return;

    await updateSnapshotMutation.mutateAsync({
      period,
      categoryId: editingCategory.category_id,
      newAmount: parseFloat(editAmount),
      reason: 'Manual adjustment from tracker'
    });

    setEditingCategory(null);
    setEditAmount('');
  };

  const fetchTransactionsForCategory = async (categoryName) => {
    setLoadingTransactions(true);
    try {
      let startDate, endDate;
      if (period.length === 4) {
        // Year period
        startDate = `${period}-01-01`;
        endDate = `${period}-12-31`;
      } else {
        // Month period (Using parseISO for local calculation)
        const date = parseISO(`${period}-01`);
        startDate = `${period}-01`;

        // Go to next month 1st then back 1 day
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0);

        endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      }

      console.log('Fetching modal transactions for:', categoryName, 'Period:', startDate, 'to', endDate);

      const data = await API.getTransactions({
        category: categoryName,
        limit: '1000',
        startDate,
        endDate,
        useBudgetDate: 'true'
      });
      setCategoryTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCardClick = (category) => {
    setSelectedCategory(category);
    setShowTransactionsModal(true);
    fetchTransactionsForCategory(category.category_name);
  };

  const handleCloseModal = () => {
    setShowTransactionsModal(false);
    setSelectedCategory(null);
    setCategoryTransactions([]);
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
  const budgetsByType = useMemo(() => {
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
  }, [budgetData]);

  // Calculate summary for a group of budgets
  const calculateSummary = (budgets) => {
    const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalSaved = budgets.reduce((sum, b) => sum + Math.abs(parseFloat(b.actual_spent || 0)), 0);
    return {
      totalBudgeted,
      totalSaved,
      remaining: totalBudgeted - totalSaved,
      percentComplete: totalBudgeted > 0 ? Math.round((totalSaved / totalBudgeted) * 100) : 0
    };
  };

  // Render a savings section
  const renderSavingsSection = (title, periodType, budgets) => {
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
              disabled={isLoading}
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
          In total, {formatCurrency(summary.totalSaved)} saved out of target {formatCurrency(summary.totalBudgeted)}.
          Remaining: {formatCurrency(summary.remaining)}.
        </p>

        {/* Summary Stats for this section */}
        <div className="stats-bar" style={{ marginBottom: '24px' }}>
          <div className="stat-box">
            <div className="stat-label">Target Savings</div>
            <div className="stat-value">{formatCurrency(summary.totalBudgeted)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Actually Saved</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>
              {formatCurrency(summary.totalSaved)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Remaining</div>
            <div className="stat-value" style={{ color: '#000' }}>
              {formatCurrency(summary.remaining)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Progress</div>
            <div className="stat-value yellow">{summary.percentComplete}%</div>
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
                onClick={() => !isEditing && handleCardClick(category)}
                style={{
                  background: '#000',
                  border: '4px solid #000',
                  boxShadow: '6px 6px 0 #FFD600',
                  padding: '20px',
                  position: 'relative',
                  color: '#fff',
                  cursor: isEditing ? 'default' : 'pointer'
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
                  <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
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
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="header" style={{ background: '#FFD600', color: '#000', borderBottomColor: '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📥 Savings & Investment Tracker</h1>
          <p style={{ color: '#333' }}>Track your savings goals and investment progress</p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Refresh Button */}
          <button
            className="btn-small"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{ opacity: isFetching ? 0.7 : 1 }}
          >
            {isFetching ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>

          {/* Clear Cache Button */}
          <button
            className="btn-small"
            onClick={() => {
              queryClient.clear();
              window.location.reload();
            }}
            style={{
              background: '#ff5555',
              color: '#fff'
            }}
            title="Clear cache and reload if old categories still show"
          >
            🧹 Clear Cache
          </button>

          {isPastMonth() && (
            <span style={{
              background: '#000',
              color: '#FFD600',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              border: '2px solid #000'
            }}>
              📜 Historical View
            </span>
          )}
        </div>
      </header>

      {/* Savings Sections */}
      <div style={{ padding: '32px' }}>
        {isLoading ? (
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
          <>
            {/* Monthly Savings */}
            {renderSavingsSection('Monthly Savings', 'monthly', budgetsByType['monthly'])}

            {/* Yearly Savings */}
            {renderSavingsSection('Yearly Savings', 'yearly', budgetsByType['yearly'])}

            {/* Open Savings */}
            {renderSavingsSection('Open Savings', 'open', budgetsByType['open'])}
          </>
        )}
      </div>
      {/* Modal for Transactions */}
      {showTransactionsModal && selectedCategory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 214, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            border: '4px solid #000',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '10px 10px 0 #000'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '4px solid #000',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FFD600'
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  textTransform: 'uppercase',
                  fontWeight: 900,
                  fontSize: '24px'
                }}>
                  {selectedCategory.category_name}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#000' }}>
                  Savings for {period}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  width: '40px',
                  height: '40px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              {loadingTransactions ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="loader" style={{ margin: '0 auto 20px' }}></div>
                  <p>Loading transactions...</p>
                </div>
              ) : categoryTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>No transactions found for this savings category.</p>
                </div>
              ) : (
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{
                      borderBottom: '3px solid #000',
                      textAlign: 'left'
                    }}>
                      <th style={{ padding: '12px 8px' }}>Date</th>
                      <th style={{ padding: '12px 8px' }}>Description</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryTransactions.map(tx => (
                      <tr key={tx.tx_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 8px' }}>{new Date(tx.tx_date).toLocaleDateString('en-MY')}</td>
                        <td style={{ padding: '12px 8px' }}>{tx.description}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                          RM {Math.abs(tx.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '3px solid #000', fontWeight: 'bold', background: '#f5f5f5' }}>
                      <td colSpan="2" style={{ padding: '12px 8px' }}>TOTAL</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        RM {categoryTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SavingsTracker;
