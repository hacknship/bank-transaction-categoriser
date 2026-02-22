import { Routes, Route, NavLink } from 'react-router-dom'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import ExpenseTracker from './pages/ExpenseTracker'
import SavingsTracker from './pages/SavingsTracker'
import BudgetHistory from './pages/BudgetHistory'

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
