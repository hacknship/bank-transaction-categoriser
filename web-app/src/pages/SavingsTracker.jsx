import { useState, useEffect, useMemo } from 'react';
import { useBudget, useAvailablePeriods, useUpdateSnapshotBudget } from '../hooks/useBudget';
import { queryClient } from '../lib/queryClient';

function SavingsTracker() {
  const [period, setPeriod] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editAmount, setEditAmount] = useState('');

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
    </div>
  );
}

export default SavingsTracker;
