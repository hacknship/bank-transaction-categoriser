import { useState, useEffect, useMemo } from 'react';
import { useBudget, useAvailablePeriods, useUpdateSnapshotBudget } from '../hooks/useBudget';
import API from '../utils/api';

function ExpenseTracker() {
  const [period, setPeriod] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  
  // Modal state for transactions
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setPeriod(currentPeriod);
  }, []);

  // TanStack Query hooks
  const { data: availablePeriods = [] } = useAvailablePeriods();
  const { 
    data: budgetData, 
    isLoading, 
    isFetching, 
    refetch 
  } = useBudget(period, 'expense');
  
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

  // Fetch transactions for a category
  async function fetchCategoryTransactions(categoryName) {
    setLoadingTransactions(true);
    try {
      // Calculate date range based on period
      let startDate, endDate;
      if (period.length === 4) {
        // Year period
        startDate = `${period}-01-01`;
        endDate = `${period}-12-31`;
      } else {
        // Month period
        const [year, month] = period.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }
      
      const data = await API.getTransactions({ 
        category: categoryName, 
        limit: '1000',
        startDate,
        endDate
      });
      setCategoryTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }

  // Handle card click to show transactions
  function handleCardClick(category) {
    setSelectedCategory(category);
    setShowTransactionsModal(true);
    fetchCategoryTransactions(category.category_name);
  }

  // Close modal
  function handleCloseModal() {
    setShowTransactionsModal(false);
    setSelectedCategory(null);
    setCategoryTransactions([]);
  }

  // Calculate total spent for modal
  const calculateTotalSpent = () => {
    return categoryTransactions.reduce((sum, t) => {
      const amount = parseFloat(t.amount || 0);
      return sum + (amount < 0 ? Math.abs(amount) : 0);
    }, 0);
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
                onClick={() => handleCardClick(category)}
                style={{
                  background: '#fff',
                  border: '4px solid #000',
                  boxShadow: '6px 6px 0 #000',
                  padding: '20px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  ':hover': { transform: 'translate(-2px, -2px)' }
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(category);
                        }}
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
          disabled={isLoading}
        >
          {availablePeriods.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Refresh Button */}
        <button 
          className="btn-small"
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ 
            marginLeft: 'auto',
            opacity: isFetching ? 0.7 : 1
          }}
        >
          {isFetching ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>

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
        {isLoading ? (
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

      {/* Transactions Modal */}
      {showTransactionsModal && selectedCategory && (
        <div 
          onClick={handleCloseModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              border: '4px solid #000',
              boxShadow: '8px 8px 0 #000',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: '#FFD600',
              borderBottom: '4px solid #000',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#fff',
                border: '3px solid #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                {selectedCategory.category_icon || '📦'}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ 
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {selectedCategory.category_name}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#333' }}>
                  Transactions for {period}
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
                  <p>Loading transactions...</p>
                </div>
              ) : categoryTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>No transactions found for this category.</p>
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
                    {categoryTransactions
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((transaction, index) => (
                      <tr 
                        key={transaction.id || index}
                        style={{ 
                          borderBottom: '1px solid #ddd',
                          background: index % 2 === 0 ? '#f9f9f9' : '#fff'
                        }}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          {new Date(transaction.date).toLocaleDateString('en-MY', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {transaction.description}
                        </td>
                        <td style={{ 
                          padding: '12px 8px', 
                          textAlign: 'right',
                          fontWeight: 600,
                          color: parseFloat(transaction.amount) < 0 ? 'var(--red)' : 'var(--green)'
                        }}>
                          {formatCurrency(Math.abs(transaction.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              borderTop: '4px solid #000',
              padding: '16px 20px',
              background: '#f5f5f5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}
              </span>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ color: '#666' }}>Total Spent:</span>
                <span style={{ color: 'var(--red)' }}>
                  {formatCurrency(calculateTotalSpent())}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseTracker;
