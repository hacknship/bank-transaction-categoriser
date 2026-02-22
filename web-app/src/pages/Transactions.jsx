import { useState, useEffect, useCallback } from 'react';
import { API } from '../utils/api';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    account: '',
    category: '',
    search: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Load data from cloud
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txData, catData] = await Promise.all([
        API.getTransactions(),
        API.getCategories()
      ]);
      
      setTransactions(txData.transactions || []);
      setCategories(catData.categories || []);
      
      // Extract unique accounts
      const uniqueAccounts = [...new Set((txData.transactions || []).map(t => t.account_id).filter(Boolean))];
      setAccounts(uniqueAccounts);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and when filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filters.account && tx.account_id !== filters.account) return false;
    if (filters.category && tx.category !== filters.category) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const notes = (tx.notes || '').toLowerCase();
      if (!desc.includes(search) && !notes.includes(search)) return false;
    }
    return true;
  });

  // Stats
  const totalCount = transactions.length;
  const accountCount = accounts.length;
  const categoryCount = [...new Set(transactions.map(t => t.category).filter(Boolean))].length;
  const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  // Actions
  function handleRefresh() {
    loadData();
  }

  function exportJSON() {
    const exportData = {};
    transactions.forEach(t => {
      exportData['mbt_' + t.tx_id] = t;
    });
    setJsonContent(JSON.stringify(exportData, null, 2));
    setShowJsonModal(true);
  }

  async function updateTransaction(id, updates) {
    try {
      const tx = transactions.find(t => t.tx_id === id);
      if (!tx) return;
      
      await API.saveTransaction({
        transactionId: id,
        accountId: tx.account_id,
        txDate: tx.tx_date,
        description: tx.description,
        amount: tx.amount,
        category: updates.category !== undefined ? updates.category : tx.category,
        notes: updates.notes !== undefined ? updates.notes : tx.notes
      });
      
      loadData(); // Refresh
    } catch (error) {
      console.error('Failed to update:', error);
    }
    setEditingId(null);
  }

  function getCategory(name) {
    return categories.find(c => c.name === name) || { name, icon: '📦', color: '#666' };
  }

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>💰 Transaction Data</h1>
        <p>View and manage your categorized Maybank transactions from the cloud</p>
      </header>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-box">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value yellow">{totalCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Unique Accounts</div>
          <div className="stat-value">{accountCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Categories Used</div>
          <div className="stat-value">{categoryCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Amount</div>
          <div className={totalAmount < 0 ? 'stat-value amount-negative' : 'stat-value'}>
            RM {Math.abs(totalAmount).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        <button className="btn btn-yellow" onClick={handleRefresh} disabled={loading}>
          {loading ? '🔄 Loading...' : '🔄 Refresh Data'}
        </button>
        <button className="btn btn-black" onClick={exportJSON}>📥 Export JSON</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <span className="filter-label">Filter by Account:</span>
        <select 
          className="filter-input" 
          value={filters.account}
          onChange={(e) => setFilters({...filters, account: e.target.value})}
        >
          <option value="">All Accounts</option>
          {accounts.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </select>
        
        <span className="filter-label">Category:</span>
        <select 
          className="filter-input" 
          value={filters.category}
          onChange={(e) => setFilters({...filters, category: e.target.value})}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
          ))}
        </select>
        
        <span className="filter-label">Search:</span>
        <input 
          type="text" 
          className="filter-input" 
          placeholder="Description..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <h2>No Transactions Yet</h2>
            <p>Go to your Maybank account page and categorize some transactions using the Chrome extension. They will appear here automatically.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const isEditing = editingId === tx.tx_id;
                const category = getCategory(tx.category);
                
                return (
                  <tr key={tx.tx_id}>
                    <td className="cell-date">{tx.tx_date}</td>
                    <td className="cell-account">
                      <span className="account-badge">{tx.account_id?.slice(-4) || 'N/A'}</span>
                    </td>
                    <td className="cell-desc">{tx.description}</td>
                    <td className={`cell-amount ${parseFloat(tx.amount) < 0 ? 'amount-negative' : 'amount-positive'}`}>
                      {parseFloat(tx.amount) < 0 ? '-' : ''}RM {Math.abs(parseFloat(tx.amount)).toFixed(2)}
                    </td>
                    <td className="cell-category">
                      {isEditing ? (
                        <select
                          className="category-select"
                          value={tx.category || ''}
                          onChange={(e) => updateTransaction(tx.tx_id, { category: e.target.value })}
                          autoFocus
                        >
                          <option value="">-- Select --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="category-badge">{category.icon} {tx.category || 'Uncategorized'}</span>
                      )}
                    </td>
                    <td className="cell-notes">
                      {isEditing ? (
                        <input
                          type="text"
                          className="notes-input"
                          defaultValue={tx.notes || ''}
                          onBlur={(e) => updateTransaction(tx.tx_id, { notes: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateTransaction(tx.tx_id, { notes: e.target.value });
                            }
                          }}
                          autoFocus={!tx.category}
                        />
                      ) : (
                        tx.notes || '-'
                      )}
                    </td>
                    <td className="cell-actions">
                      <button 
                        className="btn-small btn-yellow" 
                        onClick={() => setEditingId(isEditing ? null : tx.tx_id)}
                      >
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* JSON Modal */}
      {showJsonModal && (
        <div className="modal-overlay" onClick={() => setShowJsonModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transaction JSON</h2>
              <button className="modal-close" onClick={() => setShowJsonModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <pre>{jsonContent}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transactions;
