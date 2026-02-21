import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Transactions from './pages/Transactions'
import Reconcile from './pages/Reconcile'

function App() {
  return (
    <div>
      <nav className="nav">
        <div className="container nav-content">
          <div className="nav-brand">💰 Maybank Budget Tracker</div>
          <div className="nav-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              Dashboard
            </NavLink>
            <NavLink to="/budget" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Budget
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Transactions
            </NavLink>
            <NavLink to="/reconcile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Reconcile
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reconcile" element={<Reconcile />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
