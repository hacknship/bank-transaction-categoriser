import { useState, useEffect } from 'react';
import { API } from '../utils/api';

function Settings() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState({
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

  async function handleQuickAdd(suggested) {
    if (categories.some(c => c.name.toLowerCase() === suggested.name.toLowerCase())) {
      alert(`Category "${suggested.name}" already exists!`);
      return;
    }

    // For now, we can only add via direct SQL since we don't have a save-category endpoint
    // In production, you'd add: await API.saveCategory({...suggested, id: Date.now()});
    alert('Category management via cloud DB requires database access. This will be implemented soon.');
  }

  function handleAddNew(e) {
    e.preventDefault();
    alert('Adding custom categories via cloud DB requires database access. For now, use the default categories.');
    setShowAddForm(false);
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

  return (
    <div style={{ paddingTop: '0' }}>
      {/* Header */}
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-container">
        {/* Categories Section */}
        <div className="settings-section">
          <h2>Transaction Categories</h2>
          <p className="settings-description">
            These are the categories available for transaction categorization. 
            Categories are stored in the cloud database and automatically sync across all devices.
          </p>

          {loading && <p>Loading categories...</p>}

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
                <div key={cat.id} className="category-item">
                  <div 
                    className="category-item-icon"
                    style={{ background: cat.color || '#FFD600' }}
                  >
                    {cat.icon || '📦'}
                  </div>
                  <div className="category-item-name">{cat.name}</div>
                  <div 
                    className="category-item-color"
                    style={{ background: cat.color || '#FFD600' }}
                  />
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
                <div key={cat.id} className="category-item" style={{ background: '#e3f2fd' }}>
                  <div 
                    className="category-item-icon"
                    style={{ background: cat.color || '#2196F3' }}
                  >
                    {cat.icon || '🏦'}
                  </div>
                  <div className="category-item-name">{cat.name}</div>
                  <div 
                    className="category-item-color"
                    style={{ background: cat.color || '#2196F3' }}
                  />
                </div>
              ))}
            </div>
          </div>
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
