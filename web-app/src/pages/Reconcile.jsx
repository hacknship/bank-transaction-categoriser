import { useState, useEffect } from 'react';
import { API } from '../utils/api';

function Reconcile() {
  const [reconciliation, setReconciliation] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [loading, setLoading] = useState(false);

  async function handleReconcile() {
    if (!accountId) {
      alert('Please enter an account ID');
      return;
    }

    setLoading(true);
    try {
      const data = await API.getReconcile({ accountId, monthYear });
      setReconciliation(data);
    } catch (error) {
      console.error('Failed to reconcile:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bank Reconciliation</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Account ID</label>
            <input
              type="text"
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter account ID"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Month</label>
            <input
              type="date"
              className="input"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleReconcile} disabled={loading}>
              {loading ? 'Reconciling...' : 'Reconcile'}
            </button>
          </div>
        </div>

        {reconciliation && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="stat-card">
              <div className="stat-label">Bank Balance</div>
              <div className="stat-value">
                RM {parseFloat(reconciliation.bankBalance).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Spent</div>
              <div className="stat-value">
                RM {reconciliation.totalSpent.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Budget</div>
              <div className="stat-value">
                RM {reconciliation.totalBudget.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Remaining Budget</div>
              <div className="stat-value" style={{ color: reconciliation.remainingBudget < 0 ? '#dc3545' : '#28a745' }}>
                RM {reconciliation.remainingBudget.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">{reconciliation.transactionCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Uncategorized</div>
              <div className="stat-value" style={{ color: reconciliation.uncategorizedCount > 0 ? '#ffc107' : '#28a745' }}>
                {reconciliation.uncategorizedCount}
              </div>
              {reconciliation.uncategorizedCount > 0 && (
                <div className="stat-change negative">
                  Needs categorization
                </div>
              )}
            </div>
          </div>
        )}

        {reconciliation && reconciliation.uncategorizedCount > 0 && (
          <div className="card" style={{ marginTop: '20px', background: '#fff3cd', border: '1px solid #ffc107' }}>
            <h3 style={{ marginBottom: '8px', color: '#856404' }}>⚠️ Action Required</h3>
            <p style={{ color: '#856404' }}>
              You have {reconciliation.uncategorizedCount} uncategorized transactions. 
              Please categorize them using the Chrome extension for accurate reconciliation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reconcile;
