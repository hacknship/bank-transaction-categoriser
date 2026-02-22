import { useState, useEffect } from 'react';
import { API } from '../utils/api';

function Settings() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    color: '#FFD600',
    type: 'expense'
  });

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

  // Default suggested categories
  const DEFAULT_CATEGORIES = [
    { name: 'Food', icon: '🍔', color: '#FFD600', type: 'expense' },
    { name: 'Transport', icon: '🚗', color: '#333333', type: 'expense' },
    { name: 'Dining', icon: '🍽️', color: '#FF3333', type: 'expense' },
    { name: 'Shopping', icon: '🛍️', color: '#00C853', type: 'expense' },
    { name: 'Medical', icon: '💊', color: '#FF5555', type: 'expense' },
    { name: 'Entertainment', icon: '🎬', color: '#9C27B0', type: 'expense' },
    { name: 'Utilities', icon: '💡', color: '#FFD600', type: 'expense' },
    { name: 'Groceries', icon: '🛒', color: '#4CAF50', type: 'expense' },
    { name: 'Education', icon: '📚', color: '#2196F3', type: 'expense' },
    { name: 'Rent', icon: '🏠', color: '#795548', type: 'expense' },
    { name: 'Others', icon: '📦', color: '#666666', type: 'expense' },
    { name: 'Savings', icon: '🏦', color: '#00BCD4', type: 'savings' },
    { name: 'Investments', icon: '📈', color: '#3F51B5', type: 'savings' },
    { name: 'Emergency Fund', icon: '🛡️', color: '#009688', type: 'savings' },
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

      await API.saveCategory({
        id: editingCategory?.id,
        ...formData
      });
      
      await loadCategories();
      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', color: '#FFD600', type: 'expense' });
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete category "${name}"?\n\nNote: This will soft-delete (hide) the category. Existing transactions using this category will keep their category label.`)) {
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
      color: category.color || '#FFD600',
      type: category.type || 'expense'
    });
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingCategory(null);
    setFormData({ name: '', icon: '📦', color: '#FFD600', type: 'expense' });
    setShowForm(true);
  }

  async function handleQuickAdd(suggested) {
    if (categories.some(c => c.name.toLowerCase() === suggested.name.toLowerCase())) {
      alert(`Category "${suggested.name}" already exists!`);
      return;
    }

    setLoading(true);
    try {
      await API.saveCategory(suggested);
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
    setFormData({ name: '', icon: '📦', color: '#FFD600', type: 'expense' });
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

  const commonEmojis = ['📦', '🍔', '🚗', '🍽️', '🛍️', '💊', '🎬', '💡', '🛒', '📚', '🏠', '🏦', '📈', '🛡️', '💰', '💳', '🎮', '✈️', '🏥', '🎓', '🐶', '👶', '💄', '🔧'];

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
            <div style={{ 
              background: '#f5f5f5', 
              padding: '20px', 
              marginBottom: '24px',
              border: '3px solid #000',
              boxShadow: '4px 4px 0 #000'
            }}>
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
                      <option value="expense">📤 Expense</option>
                      <option value="savings">📥 Savings/Investment</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px' }}>Icon</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {commonEmojis.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormData({...formData, icon: emoji})}
                          style={{
                            width: '40px',
                            height: '40px',
                            fontSize: '20px',
                            border: formData.icon === emoji ? '3px solid #000' : '2px solid #ddd',
                            background: formData.icon === emoji ? '#FFD600' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                      <input 
                        type="text"
                        value={formData.icon}
                        onChange={(e) => setFormData({...formData, icon: e.target.value})}
                        maxLength={2}
                        style={{ 
                          width: '50px', 
                          padding: '8px', 
                          border: '3px solid #000',
                          fontSize: '20px',
                          textAlign: 'center'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px' }}>Color</label>
                    <input 
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      style={{ 
                        width: '100%', 
                        height: '50px',
                        border: '3px solid #000',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
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
              background: '#000',
              color: '#FFD600',
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
                    style={{ background: cat.color || '#FFD600' }}
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
              background: '#2196F3',
              color: '#fff',
              display: 'inline-block',
              border: '3px solid #000'
            }}>
              📥 Savings & Investment Categories ({savingsCategories.length})
            </h3>
            <div className="category-list">
              {savingsCategories.map(cat => (
                <div key={cat.id} className="category-item" style={{ background: '#e3f2fd', position: 'relative' }}>
                  <div 
                    className="category-item-icon"
                    style={{ background: cat.color || '#2196F3' }}
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
                          background: '#fff',
                          border: '2px solid #000',
                          cursor: 'pointer',
                          fontSize: '14px'
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
                          background: '#e3f2fd',
                          border: '2px solid #000',
                          cursor: 'pointer',
                          fontSize: '14px'
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
