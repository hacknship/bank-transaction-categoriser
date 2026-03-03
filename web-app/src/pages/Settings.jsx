import { useState, useRef, useMemo } from 'react';
import { API } from '../utils/api';
import { useCategories } from '../hooks/useTransactions';
import { useBudgetHistory } from '../hooks/useBudget';

function Settings() {
  const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useBudgetHistory();

  const [editingCategory, setEditingCategory] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    type: 'expense',
    budgetAmount: '',
    periodType: 'monthly',
    showInTracker: true
  });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [deleteMode, setDeleteMode] = useState('unused');
  const [deleteStep, setDeleteStep] = useState('checking'); // 'checking', 'confirm', 'merging'

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [categoryToMerge, setCategoryToMerge] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeScope, setMergeScope] = useState('current-and-future');

  // Rename modal state
  const [showRenameScopeModal, setShowRenameScopeModal] = useState(false);
  const [pendingRename, setPendingRename] = useState(null);
  const [transactionCountForRename, setTransactionCountForRename] = useState(0);
  const [renameScope, setRenameScope] = useState('current-and-future');

  const formRef = useRef(null);

  const loading = categoriesLoading || historyLoading;

  const categoryBudgets = useMemo(() => {
    const budgetMap = {};
    (historyData?.currentTemplates || []).forEach(template => {
      budgetMap[template.category_id] = template;
    });
    return budgetMap;
  }, [historyData]);

  async function loadData() {
    await Promise.all([refetchCategories(), refetchHistory()]);
  }

  // Default suggested categories (no color)
  const DEFAULT_CATEGORIES = [
    { name: 'Food', icon: '🍔', type: 'expense' },
    { name: 'Transport', icon: '🚗', type: 'expense' },
    { name: 'Dining', icon: '🍽️', type: 'expense' },
    { name: 'Shopping', icon: '🛍️', type: 'expense' },
    { name: 'Medical', icon: '💊', type: 'expense' },
    { name: 'Entertainment', icon: '🎬', type: 'expense' },
    { name: 'Utilities', icon: '💡', type: 'expense' },
    { name: 'Groceries', icon: '🛒', type: 'expense' },
    { name: 'Education', icon: '📚', type: 'expense' },
    { name: 'Rent', icon: '🏠', type: 'expense' },
    { name: 'Others', icon: '📦', type: 'expense' },
    { name: 'Savings', icon: '🏦', type: 'savings' },
    { name: 'Investments', icon: '📈', type: 'savings' },
    { name: 'Emergency Fund', icon: '🛡️', type: 'savings' },
  ];

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for duplicate names (excluding current editing category)
      const duplicate = categories.find(c =>
        c.name.toLowerCase() === formData.name.toLowerCase() &&
        c.id !== editingCategory?.id
      );

      if (duplicate) {
        alert(`Category "${formData.name}" already exists!`);
        setLoading(false);
        return;
      }

      // If editing and name changed, check for transactions
      if (editingCategory && editingCategory.name !== formData.name) {
        // Check transaction count
        const transactions = await API.getTransactions({
          category: editingCategory.name,
          limit: '1'
        });
        const hasTransactions = (transactions.transactions?.length || 0) > 0;

        if (hasTransactions) {
          // Count total
          const allTx = await API.getTransactions({
            category: editingCategory.name,
            limit: '1000'
          });
          setTransactionCountForRename(allTx.transactions?.length || 0);
          setPendingRename({ ...formData });
          setRenameScope('current-and-future');
          setShowRenameScopeModal(true);
          setLoading(false);
          return; // Don't save yet
        }
      }

      // Set color based on type (expense=yellow, savings=black)
      const color = formData.type === 'expense' ? '#FFD600' : '#000000';

      // Save category first
      const savedCategory = await API.saveCategory({
        id: editingCategory?.id,
        name: formData.name,
        icon: formData.icon,
        type: formData.type,
        color
      });

      // Then save budget template if amount is provided
      const categoryId = editingCategory?.id || savedCategory.category?.id;
      if (categoryId && formData.budgetAmount) {
        await API.updateBudgetTemplate({
          categoryId: categoryId,
          amount: parseFloat(formData.budgetAmount),
          periodType: formData.periodType,
          showInTracker: formData.showInTracker
        });
      }

      await loadData();
      setShowForm(false);
      setEditingCategory(null);
      setFormData({
        name: '',
        icon: '📦',
        type: 'expense',
        budgetAmount: '',
        periodType: 'monthly',
        showInTracker: true
      });
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmRenameWithScope() {
    if (!pendingRename || !editingCategory) return;

    setLoading(true);
    try {
      await API.saveCategory({
        id: editingCategory.id,
        name: pendingRename.name,
        icon: pendingRename.icon,
        type: pendingRename.type,
        color: pendingRename.type === 'expense' ? '#FFD600' : '#000000',
        affectScope: renameScope
      });

      // Then save budget template if amount is provided
      if (pendingRename.budgetAmount) {
        await API.updateBudgetTemplate({
          categoryId: editingCategory.id,
          amount: parseFloat(pendingRename.budgetAmount),
          periodType: pendingRename.periodType,
          showInTracker: pendingRename.showInTracker
        });
      }

      setShowRenameScopeModal(false);
      setPendingRename(null);
      await loadData();
      setShowForm(false);
      setEditingCategory(null);
      setFormData({
        name: '',
        icon: '📦',
        type: 'expense',
        budgetAmount: '',
        periodType: 'monthly',
        showInTracker: true
      });
    } catch (error) {
      console.error('Failed to rename:', error);
      alert('Failed to rename: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    setCategoryToDelete({ id, name });
    setDeleteStep('checking');
    setDeleteMode('unused');
    setShowDeleteModal(true);

    // Check transaction count
    try {
      const transactions = await API.getTransactions({ category: name, limit: '1000' });
      const count = transactions.transactions?.length || 0;
      setTransactionCount(count);
      setDeleteStep(count > 0 ? 'confirm' : 'unused');
      if (count > 0) {
        setDeleteMode('current-month'); // Default for used categories
      }
    } catch (error) {
      console.error('Failed to check transactions:', error);
      setTransactionCount(0);
      setDeleteStep('unused');
    }
  }

  async function confirmDelete() {
    if (!categoryToDelete) return;

    setLoading(true);
    try {
      await API.deleteCategory(categoryToDelete.id, deleteMode);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMergeClick(category) {
    setCategoryToMerge(category);
    setMergeTargetId('');
    setMergeScope('current-and-future');
    setShowMergeModal(true);
  }

  async function confirmMerge() {
    if (!categoryToMerge || !mergeTargetId) return;

    setLoading(true);
    try {
      await API.mergeCategories({
        sourceCategoryId: categoryToMerge.id,
        targetCategoryId: parseInt(mergeTargetId),
        affectScope: mergeScope
      });
      setShowMergeModal(false);
      setCategoryToMerge(null);
      await loadData();
    } catch (error) {
      console.error('Failed to merge categories:', error);
      alert('Failed to merge categories: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(category) {
    const budget = categoryBudgets[category.id];
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '📦',
      type: category.type || 'expense',
      budgetAmount: budget?.amount || '',
      periodType: budget?.period_type || 'monthly',
      showInTracker: budget?.show_in_tracker !== false
    });
    setShowForm(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function handleAddNew() {
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: '📦',
      type: 'expense',
      budgetAmount: '',
      periodType: 'monthly',
      showInTracker: true
    });
    setShowForm(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  async function handleQuickAdd(suggested) {
    if (categories.some(c => c.name.toLowerCase() === suggested.name.toLowerCase())) {
      alert(`Category "${suggested.name}" already exists!`);
      return;
    }

    setLoading(true);
    try {
      const color = suggested.type === 'expense' ? '#FFD600' : '#000000';
      await API.saveCategory({ ...suggested, color });
      await loadData();
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('Failed to add category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: '📦',
      type: 'expense',
      budgetAmount: '',
      periodType: 'monthly',
      showInTracker: true
    });
  }

  // Separate categories by type
  const expenseCategories = categories.filter(c => c.type === 'expense' || !c.type);
  const savingsCategories = categories.filter(c => c.type === 'savings');

  // Get suggested categories that haven't been added yet
  const suggestedCategories = DEFAULT_CATEGORIES.filter(
    def => !categories.some(c => c.name.toLowerCase() === def.name.toLowerCase())
  );

  const suggestedExpense = suggestedCategories.filter(c => c.type === 'expense');
  const suggestedSavings = suggestedCategories.filter(c => c.type === 'savings');

  // Helper to format currency
  const formatCurrency = (amount) => {
    if (!amount) return '';
    return `RM ${parseFloat(amount).toLocaleString('en-MY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  // Category item component
  const CategoryItem = ({ cat, isSavings }) => {
    const budget = categoryBudgets[cat.id];
    const hasBudget = budget && budget.amount > 0;

    return (
      <div
        key={cat.id}
        className="category-item"
        style={{
          position: 'relative',
          background: isSavings ? '#f5f5f5' : '#fff'
        }}
      >
        <div
          className="category-item-icon"
          style={{
            background: isSavings ? '#000' : '#FFD600',
            color: isSavings ? '#FFD600' : '#000',
            border: '2px solid #000'
          }}
        >
          {cat.icon || (isSavings ? '🏦' : '📦')}
        </div>
        <div style={{ flex: 1 }}>
          <div className="category-item-name">{cat.name}</div>
          {hasBudget && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {formatCurrency(budget.amount)} ({budget.period_type})
              {!budget.show_in_tracker && ' - Hidden'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={() => handleMergeClick(cat)}
            style={{
              background: '#e3f2fd',
              border: '2px solid #000',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Merge into another category"
          >
            ➡️
          </button>
          <button
            onClick={() => handleEdit(cat)}
            style={{
              background: '#fff',
              border: '2px solid #000',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => handleDelete(cat.id, cat.name)}
            style={{
              background: '#ff5555',
              border: '2px solid #000',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingTop: '0' }}>
      {/* Header */}
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-container">
        {/* Categories Section */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Transaction Categories</h2>
            <button
              onClick={handleAddNew}
              className="btn btn-primary"
              disabled={loading}
              style={{ background: '#FFD600' }}
            >
              ➕ Add Category
            </button>
          </div>

          <p className="settings-description">
            Manage categories for transaction categorization and set budget amounts.
            Changes sync automatically to the Chrome extension.
          </p>

          {loading && <p>Loading...</p>}

          {/* Add/Edit Form */}
          {showForm && (
            <div
              ref={formRef}
              style={{
                background: '#f5f5f5',
                padding: '20px',
                marginBottom: '24px',
                border: '3px solid #000',
                boxShadow: '4px 4px 0 #000'
              }}
            >
              <h3 style={{ marginTop: 0 }}>{editingCategory ? '✏️ Edit Category' : '➕ Add New Category'}</h3>
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px' }}>Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '3px solid #000',
                        fontSize: '16px'
                      }}
                      placeholder="e.g. Gym Membership"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px' }}>Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '3px solid #000',
                        fontSize: '16px',
                        background: '#fff'
                      }}
                    >
                      <option value="expense">📤 Expense (Yellow)</option>
                      <option value="savings">📥 Savings/Investment (Black)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px' }}>Icon (Emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    maxLength={10}
                    style={{
                      width: '80px',
                      padding: '8px',
                      border: '3px solid #000',
                      fontSize: '24px',
                      textAlign: 'center'
                    }}
                    placeholder="📦"
                  />
                  <span style={{ marginLeft: '12px', color: '#666', fontSize: '14px' }}>
                    Paste any emoji here
                  </span>
                </div>

                {/* Budget Configuration */}
                <div style={{
                  background: '#fff',
                  padding: '16px',
                  border: '3px solid #000',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase' }}>
                    💰 Budget Configuration
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>
                        Budget Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.budgetAmount}
                        onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '3px solid #000',
                          fontSize: '16px'
                        }}
                        placeholder="e.g. 1000"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>
                        Period
                      </label>
                      <select
                        value={formData.periodType}
                        onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '3px solid #000',
                          fontSize: '16px',
                          background: '#fff'
                        }}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="open">Open (No Period)</option>
                      </select>
                    </div>
                  </div>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.showInTracker}
                      onChange={(e) => setFormData({ ...formData, showInTracker: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Show in tracker page
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !formData.name.trim()}
                    style={{ background: '#FFD600' }}
                  >
                    {loading ? 'Saving...' : (editingCategory ? '💾 Save Changes' : '➕ Add Category')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Expense Categories */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px',
              padding: '8px 12px',
              background: '#FFD600',
              color: '#000',
              display: 'inline-block',
              border: '3px solid #000'
            }}>
              📤 Expense Categories ({expenseCategories.length})
            </h3>
            <div className="category-list">
              {expenseCategories.map(cat => (
                <CategoryItem key={cat.id} cat={cat} isSavings={false} />
              ))}
            </div>
          </div>

          {/* Savings Categories */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px',
              padding: '8px 12px',
              background: '#000',
              color: '#FFD600',
              display: 'inline-block',
              border: '3px solid #000'
            }}>
              📥 Savings & Investment Categories ({savingsCategories.length})
            </h3>
            <div className="category-list">
              {savingsCategories.map(cat => (
                <CategoryItem key={cat.id} cat={cat} isSavings={true} />
              ))}
            </div>
          </div>

          {/* Suggested Categories */}
          {suggestedCategories.length > 0 && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '3px dashed #ddd' }}>
              <h3 style={{ marginBottom: '16px' }}>💡 Suggested Categories</h3>
              <p className="settings-description" style={{ marginBottom: '16px' }}>
                Quick-add common categories. Click to add them to your list.
              </p>

              {suggestedExpense.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>Expense</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {suggestedExpense.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => handleQuickAdd(cat)}
                        disabled={loading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          background: '#FFD600',
                          border: '2px solid #000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#000'
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                        <span style={{ color: '#666', fontSize: '12px' }}>+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {suggestedSavings.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>Savings</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {suggestedSavings.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => handleQuickAdd(cat)}
                        disabled={loading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          background: '#000',
                          border: '2px solid #000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#FFD600'
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                        <span style={{ color: '#FFD600', fontSize: '12px' }}>+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* About Section */}
        <div className="settings-section">
          <h2>About</h2>
          <p className="settings-description">
            Maybank Budget Tracker v1.0 (Cloud Edition)
            <br /><br />
            This app uses Ghost.build cloud PostgreSQL database for reliable storage.
            All data syncs automatically across the Chrome extension and web app.
            <br /><br />
            <strong>Database:</strong> mbt_budget_tracker
            <br />
            <strong>Provider:</strong> Ghost.build
          </p>
        </div>
      </div>

      {/* Delete Category Modal */}
      {showDeleteModal && categoryToDelete && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowDeleteModal(false)}>
          <div style={{
            background: '#fff',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '3px solid #000',
            boxShadow: '8px 8px 0 #000'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>🗑️ Delete Category</h3>

            {deleteStep === 'checking' ? (
              <p>Checking if category is in use...</p>
            ) : transactionCount === 0 ? (
              <>
                <p>Delete category "<strong>{categoryToDelete.name}</strong>"?</p>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  This category is not used by any transactions. It will be permanently deleted.
                </p>
              </>
            ) : (
              <>
                <p>Category "<strong>{categoryToDelete.name}</strong>" is used by <strong>{transactionCount}</strong> transaction(s).</p>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>
                  How would you like to handle these transactions?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '12px',
                    border: deleteMode === 'current-month' ? '3px solid #000' : '2px solid #ddd',
                    background: deleteMode === 'current-month' ? '#e3f2fd' : '#fff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="deleteMode"
                      value="current-month"
                      checked={deleteMode === 'current-month'}
                      onChange={(e) => setDeleteMode(e.target.value)}
                    />
                    <div>
                      <strong>Set current month to "Uncategorized"</strong>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Previous months keep the old category name for historical accuracy
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '12px',
                    border: deleteMode === 'all-months' ? '3px solid #000' : '2px solid #ddd',
                    background: deleteMode === 'all-months' ? '#e3f2fd' : '#fff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="deleteMode"
                      value="all-months"
                      checked={deleteMode === 'all-months'}
                      onChange={(e) => setDeleteMode(e.target.value)}
                    />
                    <div>
                      <strong>Set ALL transactions to "Uncategorized"</strong>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Affects transactions in all months (including past)
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn"
                disabled={loading}
              >
                Cancel
              </button>
              {deleteStep !== 'checking' && (
                <button
                  onClick={confirmDelete}
                  className="btn"
                  disabled={loading}
                  style={{
                    background: '#ff5555',
                    color: '#fff'
                  }}
                >
                  {loading ? 'Deleting...' : (transactionCount > 0 ? 'Delete & Update' : 'Delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge Category Modal */}
      {showMergeModal && categoryToMerge && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowMergeModal(false)}>
          <div style={{
            background: '#fff',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '3px solid #000',
            boxShadow: '8px 8px 0 #000'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>➡️ Merge Category</h3>

            <p>Merge "<strong>{categoryToMerge.name}</strong>" into another category.</p>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              All transactions with the source category will be updated to use the target category.
              The source category will be deleted after merging.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
                Target Category
              </label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '3px solid #000',
                  fontSize: '16px',
                  background: '#fff'
                }}
              >
                <option value="">-- Select target category --</option>
                {categories
                  .filter(c => c.id !== categoryToMerge.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
                Affected Transactions
              </label>
              <select
                value={mergeScope}
                onChange={(e) => setMergeScope(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '3px solid #000',
                  fontSize: '16px',
                  background: '#fff'
                }}
              >
                <option value="future">Future months only (next month onwards)</option>
                <option value="current-and-future">Current and future months</option>
                <option value="all">All transactions (including past)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowMergeModal(false)}
                className="btn"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={confirmMerge}
                className="btn"
                disabled={loading || !mergeTargetId}
                style={{
                  background: '#FFD600'
                }}
              >
                {loading ? 'Merging...' : 'Merge Categories'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Category Scope Modal */}
      {showRenameScopeModal && editingCategory && pendingRename && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowRenameScopeModal(false)}>
          <div style={{
            background: '#fff',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '3px solid #000',
            boxShadow: '8px 8px 0 #000'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>✏️ Rename Category</h3>

            <p>
              Category "<strong>{editingCategory.name}</strong>" has <strong>{transactionCountForRename}</strong> transaction(s).
            </p>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              How do you want to handle existing transactions?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px',
                border: renameScope === 'future' ? '3px solid #000' : '2px solid #ddd',
                background: renameScope === 'future' ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="renameScope"
                  value="future"
                  checked={renameScope === 'future'}
                  onChange={(e) => setRenameScope(e.target.value)}
                />
                <div>
                  <strong>Future only (next month onwards)</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Existing transactions keep the old category name
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px',
                border: renameScope === 'current-and-future' ? '3px solid #000' : '2px solid #ddd',
                background: renameScope === 'current-and-future' ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="renameScope"
                  value="current-and-future"
                  checked={renameScope === 'current-and-future'}
                  onChange={(e) => setRenameScope(e.target.value)}
                />
                <div>
                  <strong>Current and future (this month onwards)</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Previous months keep the old category name for historical accuracy
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px',
                border: renameScope === 'all' ? '3px solid #000' : '2px solid #ddd',
                background: renameScope === 'all' ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="renameScope"
                  value="all"
                  checked={renameScope === 'all'}
                  onChange={(e) => setRenameScope(e.target.value)}
                />
                <div>
                  <strong>All transactions (including past)</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Update all transactions to use the new category name
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRenameScopeModal(false)}
                className="btn"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={confirmRenameWithScope}
                className="btn"
                disabled={loading}
                style={{
                  background: '#FFD600'
                }}
              >
                {loading ? 'Renaming...' : 'Confirm Rename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
