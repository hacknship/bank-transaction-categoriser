import { useState, useMemo, useEffect, useRef } from 'react';
import { useInfiniteTransactions, useTransactionTotals, useCategories, useSaveTransaction, useDeleteTransaction } from '../hooks/useTransactions';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { useAvailablePeriods } from '../hooks/useBudget';
import { formatBudgetMonth, formatFullDate, getYearMonth, formatMMYYYY, parseMMYYYY } from '../utils/dateUtils';

function Transactions() {
  const [filters, setFilters] = useState({
    account: '',
    category: '',
    search: '',
    period: '' // YYYY-MM
  });
  const [editingCell, setEditingCell] = useState(null); // { txId, field }
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [savingId, setSavingId] = useState(null); // { txId, field }
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Build API filters (exclude search - we do that client-side)
  const apiFilters = useMemo(() => {
    const f = {};
    if (filters.account) f.accountId = filters.account;
    if (filters.category) f.category = filters.category;

    if (filters.period) {
      // Use parseISO to avoid timezone shifts in boundary calculation
      const date = parseISO(`${filters.period}-01`);
      f.startDate = `${filters.period}-01`;

      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0);
      f.endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    }

    return f;
  }, [filters]);

  // Infinite scroll for transactions
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isFetching
  } = useInfiniteTransactions(apiFilters, 'false');

  const queryClient = useQueryClient();

  const { transactions = [], pagination = {} } = data || {};

  // Get totals from ALL transactions (not just loaded ones)
  const { data: totalsData } = useTransactionTotals(apiFilters, 'false');

  const { data: categories = [] } = useCategories();
  const { data: availablePeriods = [] } = useAvailablePeriods();
  const saveMutation = useSaveTransaction();
  const deleteMutation = useDeleteTransaction();


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

  // Format currency
  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: queryKeys.periods })
    ]);
  }

  async function updateTransaction(id, updates) {
    const tx = transactions.find(t => t.tx_id === id);
    console.log('updateTransaction called for:', id, 'updates:', updates, 'tx found:', !!tx);
    if (!tx) {
      console.warn('Transaction not found in local state!');
      return;
    }

    if (updates.category !== undefined) setSavingId({ txId: id, field: 'category' });
    if (updates.budgetDate !== undefined) setSavingId({ txId: id, field: 'budget_date' });
    if (updates.notes !== undefined) setSavingId({ txId: id, field: 'notes' });

    try {
      await saveMutation.mutateAsync({
        txId: id,
        accountId: tx.account_id,
        txDate: tx.tx_date,
        description: tx.description,
        amount: tx.amount,
        category: updates.category !== undefined ? updates.category : tx.category,
        notes: updates.notes !== undefined ? updates.notes : tx.notes,
        budgetDate: updates.budgetDate !== undefined ? updates.budgetDate : tx.budget_date
      });
    } finally {
      setSavingId(null);
      setEditingCell(null);
    }
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
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>💰 Transaction Data</h1>
          <p>View and manage transactions in chronological order (bank data)</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isFetchingNextPage && <span className="loader-small" style={{ margin: 0 }}></span>}
          <button
            className="btn-small"
            onClick={handleRefresh}
            disabled={isFetching || isFetchingNextPage}
            style={{ opacity: (isFetching || isFetchingNextPage) ? 0.7 : 1 }}
          >
            {(isFetching || isFetchingNextPage) ? '🔄 Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
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
      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>
          Loaded: {transactions.length.toLocaleString()} transactions
          {pagination?.hasMore && ' (scroll to load more)'}
        </span>
      </div>

      {/* Filters (Clean version - no labels, month/year picker) */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '12px', background: '#f5f5f5', padding: '16px' }}>
        <select
          className="filter-input"
          value={filters.account}
          onChange={(e) => setFilters({ ...filters, account: e.target.value })}
          style={{ minWidth: '140px' }}
        >
          <option value="">All Accounts</option>
          {accounts.map(acc => (
            <option key={acc} value={acc}>{acc.slice(-4)}</option>
          ))}
        </select>

        <select
          className="filter-input"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          style={{ minWidth: '180px' }}
        >
          <option value="">All Categories</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          className="filter-input"
          value={filters.period}
          onChange={(e) => setFilters({ ...filters, period: e.target.value })}
          style={{ minWidth: '160px' }}
        >
          <option value="">All Periods</option>
          {availablePeriods.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <input
          type="text"
          className="filter-input"
          placeholder="Search description or notes..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ minWidth: '240px', flex: 1 }}
        />

        {(filters.account || filters.category || filters.period || filters.search) && (
          <button
            className="btn-small"
            onClick={() => setFilters({ account: '', category: '', search: '', period: '' })}
            style={{ background: '#ff5555', color: '#fff' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container" style={{ minHeight: '400px', position: 'relative' }}>
        {isLoading && transactions.length === 0 ? (
          <div className="empty-state">
            <div className="loader" style={{ margin: '40px auto' }}></div>
            <h2>Initial Loading...</h2>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <h2>No Transactions Found</h2>
            <p>
              {filters.account || filters.category || filters.period || filters.search
                ? 'Try adjusting your filters to see more results.'
                : 'Go to your Maybank account page and categorize some transactions using the Chrome extension.'}
            </p>
          </div>
        ) : (
          <>
            {(isLoading || isFetchingNextPage) && transactions.length > 0 && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                <span className="loader-small"></span>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th title="Map transaction to a different budget month">Budget Month</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const category = getCategory(tx.category);
                  const isMenuOpen = activeMenuId === tx.tx_id;

                  const handleFieldClick = (field) => {
                    setEditingCell({ txId: tx.tx_id, field });
                  };

                  const isEditing = (field) => editingCell?.txId === tx.tx_id && editingCell?.field === field;

                  return (
                    <tr key={tx.tx_id}>
                      <td className="cell-date">{formatFullDate(tx.tx_date)}</td>
                      <td className="cell-account">
                        <span className="account-badge">{tx.account_id?.slice(-4) || 'N/A'}</span>
                      </td>
                      <td className="cell-desc">{tx.description}</td>
                      <td className={`cell-amount ${parseFloat(tx.amount) < 0 ? 'amount-negative' : 'amount-positive'}`}>
                        {parseFloat(tx.amount) < 0 ? '-' : ''}RM {Math.abs(parseFloat(tx.amount)).toFixed(2)}
                      </td>
                      <td className="cell-category" onClick={() => handleFieldClick('category')}>
                        {isEditing('category') ? (
                          <select
                            className="category-select-inline"
                            defaultValue={tx.category || ''}
                            onChange={(e) => updateTransaction(tx.tx_id, { category: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            autoFocus
                          >
                            <option value="">-- Select --</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="category-badge clickable">
                            {savingId?.txId === tx.tx_id && savingId?.field === 'category' ? '🔄 ' : ''}
                            {category.icon} {tx.category || 'Uncategorized'}
                          </span>
                        )}
                      </td>
                      <td className="cell-budget-date" onClick={() => handleFieldClick('budget_date')}>
                        {isEditing('budget_date') ? (
                          <input
                            type="text"
                            className="budget-month-input-inline"
                            placeholder="MM/YYYY"
                            defaultValue={formatMMYYYY(tx.budget_date || tx.tx_date)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newDate = parseMMYYYY(e.target.value);
                                if (newDate) {
                                  updateTransaction(tx.tx_id, { budgetDate: newDate });
                                } else {
                                  setEditingCell(null);
                                }
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            onBlur={(e) => {
                              // Only save if we didn't just hit Escape or Enter which already handled it
                              if (editingCell?.field === 'budget_date') {
                                const newDate = parseMMYYYY(e.target.value);
                                if (newDate) {
                                  updateTransaction(tx.tx_id, { budgetDate: newDate });
                                } else {
                                  setEditingCell(null);
                                }
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className={`budget-month-badge clickable ${tx.budget_date && getYearMonth(tx.budget_date) !== getYearMonth(tx.tx_date) ? 'budget-month-override' : ''}`}>
                            {savingId?.txId === tx.tx_id && savingId?.field === 'budget_date' ? '🔄 ' : ''}
                            {formatBudgetMonth(tx.budget_date || tx.tx_date)}
                          </span>
                        )}
                      </td>
                      <td className="cell-notes" onClick={() => handleFieldClick('notes')}>
                        {isEditing('notes') ? (
                          <input
                            type="text"
                            className="notes-input-inline"
                            defaultValue={tx.notes || ''}
                            onBlur={(e) => {
                              if (editingCell) updateTransaction(tx.tx_id, { notes: e.target.value });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTransaction(tx.tx_id, { notes: e.target.value });
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="notes-text clickable">
                            {savingId?.txId === tx.tx_id && savingId?.field === 'notes' ? '🔄 ' : ''}
                            {tx.notes || '-'}
                          </span>
                        )}
                      </td>
                      <td className="cell-actions">
                        <div className="action-menu-container">
                          <button
                            className="action-menu-trigger"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : tx.tx_id)}
                          >
                            ⋮
                          </button>
                          {isMenuOpen && (
                            <div className="action-dropdown">
                              <button
                                className="dropdown-item delete"
                                onClick={() => {
                                  deleteTransaction(tx.tx_id);
                                  setActiveMenuId(null);
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </div>
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

    </div>
  );
}

export default Transactions;
