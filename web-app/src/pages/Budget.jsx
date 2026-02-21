import { useState, useEffect } from 'react';
import { API } from '../utils/api';

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Dining', 'Shopping', 'Medical', 'Entertainment', 'Utilities', 'Groceries', 'Others'];

function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [accountId, setAccountId] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accountId) {
      loadBudgets();
    }
  }, [accountId, monthYear]);

  async function loadBudgets() {
    try {
      const data = await API.getBudget({ accountId, monthYear });
      setBudgets(data.budgets || []);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    }
  }

  async function handleAddBudget(e) {
    e.preventDefault();
    if (!newCategory || !newBudget || !accountId) return;

    setLoading(true);
    try {
      await API.setBudget({
        accountId,
        monthYear,
        categoryName: newCategory,
        monthlyBudget: parseFloat(newBudget),
        isActive: true
      });
      setNewCategory('');
      setNewBudget('');
      loadBudgets();
    } catch (error) {
      console.error('Failed to add budget:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(categoryName) {
    if (!confirm('Delete this budget category?')) return;
    
    try {
      await API.setBudget({
        accountId,
        monthYear,
        categoryName,
        monthlyBudget: 0,
        isActive: false
      });
      loadBudgets();
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  }

  async function handleArchive() {
    if (!confirm('Archive this month\'s budget? This will freeze the current budget.')) return;
    
    try {
      await API.archiveBudget({ accountId, monthYear });
      alert('Budget archived successfully!');
      loadBudgets();
    } catch (error) {
      console.error('Failed to archive budget:', error);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Set Monthly Budget</h2>
        </div>

        <form onSubmit={handleAddBudget} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Account ID</label>
              <input
                type="text"
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Enter account ID"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Month</label>
              <input
                type="date"
                className="input"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                required
              />
            </div>
            <div></div>
            <div></div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Category</label>
              <select
                className="select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                required
              >
                <option value="">Select category</option>
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Budget Amount (RM)</label>
              <input
                type="number"
                className="input"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Budget'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleArchive}>
              Archive Month
            </button>
          </div>
        </form>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Budget</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td>{budget.category_name}</td>
                  <td>RM {parseFloat(budget.monthly_budget).toFixed(2)}</td>
                  <td>
                    <button 
                      className="btn btn-danger" 
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => handleDelete(budget.category_name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {budgets.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No budget categories yet. Add one above.
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

export default Budget;
