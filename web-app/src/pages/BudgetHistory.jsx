import { useState } from 'react';
import { useBudgetHistory } from '../hooks/useBudget';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

function BudgetHistory() {
  const { data: historyData, isLoading: loading, isFetching } = useBudgetHistory();
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'versions'
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.budgetHistory });
  };

  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Present';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div>
        <header className="header">
          <h1>📜 Budget History</h1>
          <p>Track how your budget has evolved over time</p>
        </header>
        <div className="empty-state">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📜 Budget History</h1>
          <p>Track how your budget has evolved over time</p>
        </div>

        <button
          className="btn-small"
          onClick={handleRefresh}
          disabled={isFetching}
          style={{ opacity: isFetching ? 0.7 : 1 }}
        >
          {isFetching ? '🔄 Refreshing...' : '🔄 Refresh Data'}
        </button>
      </header>

      {/* View Toggle */}
      <div className="filter-bar" style={{ background: '#f5f5f5' }}>
        <span className="filter-label">View:</span>
        <button
          className={`btn-small ${viewMode === 'timeline' ? 'btn-yellow' : ''}`}
          onClick={() => setViewMode('timeline')}
        >
          📅 Timeline
        </button>
        <button
          className={`btn-small ${viewMode === 'versions' ? 'btn-yellow' : ''}`}
          onClick={() => setViewMode('versions')}
        >
          📋 Versions
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        {/* Current Budget Section */}
        <div style={{
          background: '#FFD600',
          border: '4px solid #000',
          boxShadow: '6px 6px 0 #000',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              💰 Current Budget Templates
            </h2>
            <span style={{
              background: '#000',
              color: '#FFD600',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              Active Now
            </span>
          </div>

          {historyData?.currentTemplates?.length === 0 ? (
            <p>No budget templates configured. Go to Settings → Categories to set up budgets.</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {historyData?.currentTemplates?.map(template => (
                <div
                  key={template.id}
                  style={{
                    background: '#fff',
                    border: '3px solid #000',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{template.category_icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{template.category_name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {formatCurrency(template.amount)} / {template.period_type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {viewMode === 'timeline' ? (
          /* Timeline View */
          <div style={{
            background: '#f5f5f5',
            border: '4px solid #000',
            boxShadow: '6px 6px 0 #000',
            padding: '24px'
          }}>
            <h2 style={{
              marginTop: 0,
              marginBottom: '24px',
              fontSize: '18px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              📅 Monthly Budget Timeline
            </h2>

            {!historyData?.periods?.length ? (
              <p>No historical data available yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {historyData.periods.map((period, index) => {
                  const percentUsed = period.total_budgeted > 0
                    ? (Math.abs(period.total_spent) / period.total_budgeted) * 100
                    : 0;
                  const isOverBudget = Math.abs(period.total_spent) > period.total_budgeted;

                  return (
                    <div
                      key={period.period}
                      style={{
                        background: '#fff',
                        border: '3px solid #000',
                        padding: '16px',
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 150px 150px 100px',
                        alignItems: 'center',
                        gap: '16px',
                        opacity: index === 0 ? 1 : 0.9
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {new Date(period.period_date).toLocaleDateString('en-MY', {
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>

                      {/* Mini progress bar */}
                      <div>
                        <div style={{
                          height: '8px',
                          background: '#e0e0e0',
                          border: '2px solid #000'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, percentUsed)}%`,
                            background: isOverBudget ? 'var(--red)' :
                              percentUsed >= 80 ? 'var(--yellow)' : 'var(--green)'
                          }} />
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>
                          Budgeted
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {formatCurrency(period.total_budgeted)}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>
                          Spent
                        </div>
                        <div style={{
                          fontWeight: 700,
                          color: isOverBudget ? 'var(--red)' : 'inherit'
                        }}>
                          {formatCurrency(Math.abs(period.total_spent))}
                        </div>
                      </div>

                      <div style={{
                        textAlign: 'center',
                        background: isOverBudget ? 'var(--red)' : '#f5f5f5',
                        color: isOverBudget ? '#fff' : '#000',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '2px solid #000'
                      }}>
                        {Math.round(percentUsed)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Versions View */
          <div style={{
            background: '#f5f5f5',
            border: '4px solid #000',
            boxShadow: '6px 6px 0 #000',
            padding: '24px'
          }}>
            <h2 style={{
              marginTop: 0,
              marginBottom: '24px',
              fontSize: '18px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              📋 Budget Versions
            </h2>

            {!historyData?.versions?.length ? (
              <p>No budget versions recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {historyData.versions.map((version, index) => (
                  <div
                    key={version.id}
                    style={{
                      background: selectedVersion === version.id ? '#FFD600' : '#fff',
                      border: '3px solid #000',
                      padding: '16px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedVersion(
                      selectedVersion === version.id ? null : version.id
                    )}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>
                          {version.name || `Version ${historyData.versions.length - index}`}
                          {index === 0 && (
                            <span style={{
                              background: '#000',
                              color: '#FFD600',
                              padding: '2px 8px',
                              fontSize: '10px',
                              marginLeft: '8px',
                              textTransform: 'uppercase'
                            }}>
                              Current
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                          {formatDate(version.effective_from)} - {formatDate(version.effective_to)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {version.period_count} periods
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {version.category_count} categories
                        </div>
                      </div>
                    </div>

                    {selectedVersion === version.id && (
                      <div style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: '2px dashed #000'
                      }}>
                        <p style={{ fontSize: '13px', margin: 0 }}>
                          <strong>Created:</strong> {new Date(version.created_at).toLocaleString()}
                        </p>
                        <p style={{ fontSize: '13px', marginTop: '8px' }}>
                          This version was active from {formatDate(version.effective_from)}
                          {' '}to {formatDate(version.effective_to)}.
                          It covered {version.period_count} monthly periods
                          with {version.category_count} budget categories.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BudgetHistory;
