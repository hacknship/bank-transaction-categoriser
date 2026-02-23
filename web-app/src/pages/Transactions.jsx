import { useState, useMemo, useEffect, useRef } from 'react';
import { useInfiniteTransactions, useTransactionTotals, useCategories, useSaveTransaction, useDeleteTransaction } from '../hooks/useTransactions';

function Transactions() {
  const [filters, setFilters] = useState({
    account: '',
    category: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Build API filters (exclude search - we do that client-side)
  const apiFilters = useMemo(() => {
    const f = {};
    if (filters.account) f.accountId = filters.account;
    if (filters.category) f.category = filters.category;
    if (filters.startDate) f.startDate = filters.startDate;
    if (filters.endDate) f.endDate = filters.endDate;
    return f;
  }, [filters]);

  // Infinite scroll for transactions
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteTransactions(apiFilters);

  // Get totals from ALL transactions (not just loaded ones)
  const { data: totalsData } = useTransactionTotals(apiFilters);

  const { data: categories = [] } = useCategories();
  const saveMutation = useSaveTransaction();
  const deleteMutation = useDeleteTransaction();

  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  // Extract unique accounts from loaded transactions
  const accounts = useMemo(() => {
    return [...new Set(transactions.map(t => t.account_id).filter(Boolean))];
  }, [transactions]);

  // Client-side filter for search
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const desc = (tx.description || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        if (!desc.includes(search) && !notes.includes(search)) return false;
      }
      return true;
    });
  }, [transactions, filters.search]);

  // Calculate filtered totals (client-side for search)
  const filteredTotals = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const amount = parseFloat(tx.amount || 0);
      acc.count++;
      if (amount < 0) {
        acc.outgoing += Math.abs(amount);
      } else {
        acc.incoming += amount;
      }
      acc.net += amount;
      return acc;
    }, { count: 0, outgoing: 0, incoming: 0, net: 0 });
  }, [filteredTransactions]);

  // Use API totals when no search filter, otherwise use filtered totals
  const displayTotals = filters.search ? filteredTotals : (totalsData || { count: 0, outgoing: 0, incoming: 0, net: 0 });

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  function handleRefresh() {
    refetch();
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
    const tx = transactions.find(t => t.tx_id === id);
    if (!tx) return;
    
    await saveMutation.mutateAsync({
      txId: id,
      accountId: tx.account_id,
      txDate: tx.tx_date,
      description: tx.description,
      amount: tx.amount,
      category: updates.category !== undefined ? updates.category : tx.category,
      notes: updates.notes !== undefined ? updates.notes : tx.notes
    });
    
    setEditingId(null);
  }

  async function deleteTransaction(txId) {
    if (!confirm('Delete this transaction?\n\nThis will remove the category and notes data from the database. The transaction will still appear on Maybank, but without categorization.')) {
      return;
    }
    
    await deleteMutation.mutateAsync(txId);
  }

  function getCategory(name) {
    return categories.find(c => c.name === name) || { name, icon: '📦', color: '#666' };
  }

  const uniqueCategories = useMemo(() => {
    return [...new Set(transactions.map(t => t.category).filter(Boolean))];
  }, [transactions]);

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>💰 Transaction Data</h1>
        <p>View and manage your categorized Maybank transactions from the cloud</p>
      </header>

      {/* Stats - Show totals from ALL transactions in database */}
      <div className="stats-bar">
        <div className="stat-box">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value yellow">{displayTotals.count.toLocaleString()}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Outgoing (Spent)</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {formatCurrency(displayTotals.outgoing)}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Incoming (Received)</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {formatCurrency(displayTotals.incoming)}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Net Balance</div>
          <div className="stat-value" style={{ 
            color: displayTotals.net < 0 ? 'var(--red)' : displayTotals.net > 0 ? 'var(--green)' : '#000'
          }}>
            {formatCurrency(Math.abs(displayTotals.net))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        <button className="btn btn-yellow" onClick={handleRefresh} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? '🔄 Loading...' : '🔄 Refresh Data'}
        </button>
        <button className="btn btn-black" onClick={exportJSON}>📥 Export JSON</button>
        <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          Loaded: {transactions.length.toLocaleString()} transactions
          {pagination?.hasMore && ' (scroll to load more)'}
        </span>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <span className="filter-label">Account:</span>
        <select 
          className="filter-input" 
          value={filters.account}
          onChange={(e) => setFilters({...filters, account: e.target.value})}
          style={{ minWidth: '140px' }}
        >
          <option value="">All Accounts</option>
          {accounts.map(acc => (
            <option key={acc} value={acc}>{acc.slice(-4)}</option>
          ))}
        </select>
        
        <span className="filter-label">Category:</span>
        <select 
          className="filter-input" 
          value={filters.category}
          onChange={(e) => setFilters({...filters, category: e.target.value})}
          style={{ minWidth: '180px' }}
        >
          <option value="">All Categories</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <span className="filter-label">From:</span>
        <input 
          type="date" 
          className="filter-input" 
          value={filters.startDate}
          onChange={(e) => setFilters({...filters, startDate: e.target.value})}
        />

        <span className="filter-label">To:</span>
        <input 
          type="date" 
          className="filter-input" 
          value={filters.endDate}
          onChange={(e) => setFilters({...filters, endDate: e.target.value})}
        />
        
        <span className="filter-label">Search:</span>
        <input 
          type="text" 
          className="filter-input" 
          placeholder="Description or notes..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
          style={{ minWidth: '200px' }}
        />

        {(filters.account || filters.category || filters.startDate || filters.endDate || filters.search) && (
          <button 
            className="btn-small"
            onClick={() => setFilters({ account: '', category: '', search: '', startDate: '', endDate: '' })}
            style={{ background: '#ff5555', color: '#fff' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="empty-state">
            <h2>Loading...</h2>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <h2>No Transactions Found</h2>
            <p>
              {filters.account || filters.category || filters.startDate || filters.endDate || filters.search
                ? 'Try adjusting your filters to see more results.'
                : 'Go to your Maybank account page and categorize some transactions using the Chrome extension. They will appear here automatically.'}
            </p>
          </div>
        ) : (
          <>
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
                      <td className="cell-date">{formatDate(tx.tx_date)}</td>
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
                        <button 
                          className="btn-small btn-red" 
                          onClick={() => deleteTransaction(tx.tx_id)}
                          style={{ marginLeft: '8px' }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Load more sentinel */}
            <div 
              ref={loadMoreRef}
              style={{ 
                padding: '20px', 
                textAlign: 'center',
                visibility: hasNextPage ? 'visible' : 'hidden'
              }}
            >
              {isFetchingNextPage ? (
                <span>Loading more transactions...</span>
              ) : (
                <span style={{ color: '#999' }}>Scroll down to load more</span>
              )}
            </div>
          </>
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
