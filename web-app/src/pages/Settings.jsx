import { useState, useEffect, useRef } from 'react';
import { API } from '../utils/api';

function Settings() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    type: 'expense'
  });
  
  const formRef = useRef(null);

  // Load categories from cloud
  async function loadCategories() {
    setLoading(true);
    try {
      const data = await API.getCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadCategories();
  }, []);

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

      // Set color based on type (expense=yellow, savings=black)
      const color = formData.type === 'expense' ? '#FFD600' : '#000000';

      await API.saveCategory({
        id: editingCategory?.id,
        ...formData,
        color
      });
      
      await loadCategories();
      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', type: 'expense' });
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete category "${name}"?\n\nThis will permanently remove the category.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await API.deleteCategory(id);
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '📦',
      type: category.type || 'expense'
    });
    setShowForm(true);
    
    // Scroll to form after a short delay to allow render
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function handleAddNew() {
    setEditingCategory(null);
    setFormData({ name: '', icon: '📦', type: 'expense' });
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
      await loadCategories();
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
    setFormData({ name: '', icon: '📦', type: 'expense' });
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

  // Get background color based on type
  const getTypeStyle = (type) => {
    return type === 'savings' 
      ? { background: '#000', color: '#FFD600' }  // Savings: black bg, yellow text
      : { background: '#FFD600', color: '#000' }; // Expense: yellow bg, black text
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
            >
              ➕ Add Category
            </button>
          </div>
          
          <p className="settings-description">
            Manage categories for transaction categorization. 
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
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading || !formData.name.trim()}
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
                <div key={cat.id} className="category-item" style={{ position: 'relative' }}>
                  <div 
                    className="category-item-icon"
                    style={{ background: '#FFD600', color: '#000', border: '2px solid #000' }}
                  >
                    {cat.icon || '📦'}
                  </div>
                  <div className="category-item-name">{cat.name}</div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
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
                <div key={cat.id} className="category-item" style={{ background: '#f5f5f5', position: 'relative' }}>
                  <div 
                    className="category-item-icon"
                    style={{ background: '#000', color: '#FFD600', border: '2px solid #000' }}
                  >
                    {cat.icon || '🏦'}
                  </div>
                  <div className="category-item-name">{cat.name}</div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
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
    </div>
  );
}

export default Settings;
