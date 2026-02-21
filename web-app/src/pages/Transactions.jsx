import { useState, useEffect } from 'react';
import { API } from '../utils/api';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({
    accountId: '',
    startDate: '',
    endDate: '',
    category: '',
    uncategorized: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    try {
      const params = {};
      if (filters.accountId) params.accountId = filters.accountId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.category) params.category = filters.category;
      if (filters.uncategorized) params.uncategorized = 'true';

      const data = await API.getTransactions(params);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  const categories = [...new Set(transactions.filter(t => t.category).map(t => t.category))];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transactions</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            className="input"
            placeholder="Account ID"
            value={filters.accountId}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
          />
          <input
            type="date"
            className="input"
            placeholder="Start Date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
          <input
            type="date"
            className="input"
            placeholder="End Date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
          <select
            className="select"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters.uncategorized}
              onChange={(e) => handleFilterChange('uncategorized', e.target.checked)}
            />
            <span style={{ fontSize: '14px' }}>Uncategorized only</span>
          </label>
          <button className="btn btn-primary" onClick={loadTransactions}>
            Filter
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.transaction_id}>
                  <td>{new Date(tx.tx_date).toLocaleDateString('en-MY')}</td>
                  <td>{tx.description}</td>
                  <td style={{ color: parseFloat(tx.amount) < 0 ? '#dc3545' : '#28a745' }}>
                    RM {parseFloat(tx.amount).toFixed(2)}
                  </td>
                  <td>
                    {tx.category ? (
                      <span className="badge badge-success">{tx.category}</span>
                    ) : (
                      <span className="badge badge-warning">Uncategorized</span>
                    )}
                  </td>
                  <td>{tx.notes}</td>
                </tr>
              ))}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Loading transactions...
          </div>
        )}
      </div>
    </div>
  );
}

export default Transactions;
