import { Routes, Route, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import ExpenseTracker from './pages/ExpenseTracker'
import SavingsTracker from './pages/SavingsTracker'
import BudgetHistory from './pages/BudgetHistory'

const CORRECT_PASSWORD = 'ss-home0309';
const AUTH_KEY = 'mbt_auth';

function PasswordGate({ onAuth }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      onAuth(true);
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="password-gate" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#FFD600',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#000',
        padding: '40px',
        border: '4px solid #000',
        boxShadow: '8px 8px 0 rgba(0,0,0,0.2)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>💰</div>
        <h1 style={{
          color: '#FFD600',
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '30px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Maybank Budget Tracker
        </h1>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Enter password"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              border: '3px solid #FFD600',
              background: '#fff',
              marginBottom: '16px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          
          {error && (
            <div style={{
              color: '#ff4444',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              Incorrect password
            </div>
          )}
          
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              background: '#FFD600',
              color: '#000',
              border: '3px solid #FFD600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#FFE033'}
            onMouseOut={(e) => e.target.style.background = '#FFD600'}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">💰</span>
        <span className="sidebar-brand-text">MBT</span>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
          <span className="sidebar-link-icon">📝</span>
          <span className="sidebar-link-text">Transactions</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">📤</span>
          <span className="sidebar-link-text">Expenses</span>
        </NavLink>
        <NavLink to="/savings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">📥</span>
          <span className="sidebar-link-text">Savings</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">📜</span>
          <span className="sidebar-link-text">History</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">⚙️</span>
          <span className="sidebar-link-text">Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user was previously authenticated
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return <PasswordGate onAuth={setIsAuthenticated} />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Transactions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/expenses" element={<ExpenseTracker />} />
          <Route path="/savings" element={<SavingsTracker />} />
          <Route path="/history" element={<BudgetHistory />} />
        </Routes>
      </main>
    </div>
  );
}

export default App
