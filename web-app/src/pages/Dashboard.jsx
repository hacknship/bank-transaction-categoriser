import { useState, useEffect } from 'react';
import { API } from '../utils/api';

function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadBudgets();
    }
  }, [selectedAccount]);

  async function loadAccounts() {
    try {
      // Get accounts from transactions or use a default
      const data = await API.getTransactions({ limit: 1 });
      // In real app, fetch from accounts endpoint
      setAccounts([]);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBudgets() {
    try {
      const data = await API.getBudget({ 
        accountId: selectedAccount,
        monthYear: currentMonth
      });
      setBudgets(data.budgets || []);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    }
  }

  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.monthly_budget || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.actual_spent || 0), 0);
  const remaining = totalBudget - totalSpent;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Budget</div>
          <div className="stat-value">RM {totalBudget.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">RM {totalSpent.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</div>
          <div className={`stat-change ${totalSpent > totalBudget ? 'negative' : 'positive'}`}>
            {((totalSpent / totalBudget) * 100).toFixed(1)}% of budget
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value" style={{ color: remaining < 0 ? '#dc3545' : '#28a745' }}>
            RM {remaining.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Categories</div>
          <div className="stat-value">{budgets.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Budget Overview</h2>
          <select 
            className="select"
            value={selectedAccount} 
            onChange={(e) => setSelectedAccount(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Select Account</option>
            {accounts.map(acc => (
              <option key={acc.account_id} value={acc.account_id}>
                {acc.account_name || acc.account_number}
              </option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Budgeted</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>% Used</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const percentage = budget.monthly_budget > 0 
                  ? (budget.actual_spent / budget.monthly_budget) * 100 
                  : 0;
                
                let status = 'On Track';
                let badgeClass = 'badge-success';
                if (percentage > 100) {
                  status = 'Overspent';
                  badgeClass = 'badge-danger';
                } else if (percentage > 80) {
                  status = 'Near Limit';
                  badgeClass = 'badge-warning';
                }

                return (
                  <tr key={budget.id}>
                    <td>{budget.category_name}</td>
                    <td>RM {parseFloat(budget.monthly_budget).toFixed(2)}</td>
                    <td>RM {parseFloat(budget.actual_spent || 0).toFixed(2)}</td>
                    <td>RM {(budget.monthly_budget - (budget.actual_spent || 0)).toFixed(2)}</td>
                    <td>
                      <div className="progress">
                        <div 
                          className={`progress-bar ${percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : ''}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', color: '#666' }}>{percentage.toFixed(1)}%</span>
                    </td>
                    <td><span className={`badge ${badgeClass}`}>{status}</span></td>
                  </tr>
                );
              })}
              {budgets.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No budget categories set. <a href="/budget">Create budget</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
