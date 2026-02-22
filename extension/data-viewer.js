// Data Viewer Script

let allTransactions = [];

// Load data from chrome.storage.local (shared across extension)
function loadData() {
  allTransactions = [];
  
  chrome.storage.local.get(null, (result) => {
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('mbt_')) {
        allTransactions.push(value);
      }
    }
    
    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Remove duplicates based on txId (keep latest)
    const seen = new Set();
    allTransactions = allTransactions.filter(t => {
      if (seen.has(t.txId)) return false;
      seen.add(t.txId);
      return true;
    });
    
    updateStats();
    updateFilters();
    renderTable(allTransactions);
  });
}

// Listen for storage changes and auto-refresh
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Check if any mbt_ keys changed
    const hasMbtChanges = Object.keys(changes).some(key => key.startsWith('mbt_'));
    if (hasMbtChanges) {
      console.log('[DataViewer] Storage changed, refreshing...');
      loadData();
    }
  }
});

// Update statistics
function updateStats() {
  // Use unique transactions only
  const uniqueTxs = [];
  const seen = new Set();
  allTransactions.forEach(t => {
    if (!seen.has(t.txId)) {
      seen.add(t.txId);
      uniqueTxs.push(t);
    }
  });
  
  const totalCount = uniqueTxs.length;
  
  // Unique accounts
  const accounts = new Set();
  uniqueTxs.forEach(t => {
    if (t.accountId) accounts.add(t.accountId);
  });
  const accountCount = accounts.size;
  
  // Unique categories
  const categories = new Set();
  uniqueTxs.forEach(t => {
    if (t.category) categories.add(t.category);
  });
  const categoryCount = categories.size;
  
  // Total amount (only count unique transactions)
  const totalAmount = uniqueTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('accountCount').textContent = accountCount;
  document.getElementById('categoryCount').textContent = categoryCount;
  document.getElementById('totalAmount').textContent = 
    'RM ' + totalAmount.toFixed(2);
}

// Update filter dropdowns
function updateFilters() {
  const accountFilter = document.getElementById('accountFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  
  // Use unique transactions for filters
  const uniqueTxs = [];
  const seen = new Set();
  allTransactions.forEach(t => {
    if (!seen.has(t.txId)) {
      seen.add(t.txId);
      uniqueTxs.push(t);
    }
  });
  
  // Get unique accounts
  const accounts = new Map();
  uniqueTxs.forEach(t => {
    if (t.accountId && !accounts.has(t.accountId)) {
      accounts.set(t.accountId, t.accountName || t.accountId);
    }
  });
  
  // Get unique categories
  const categories = new Set();
  uniqueTxs.forEach(t => {
    if (t.category) categories.add(t.category);
  });
  
  // Save current selection
  const currentAccount = accountFilter.value;
  const currentCategory = categoryFilter.value;
  
  // Update account filter
  accountFilter.innerHTML = '<option value="">All Accounts</option>';
  accounts.forEach((name, id) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    accountFilter.appendChild(option);
  });
  accountFilter.value = currentAccount;
  
  // Update category filter
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  Array.from(categories).sort().forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  categoryFilter.value = currentCategory;
}

// Filter data
function filterData() {
  const accountFilter = document.getElementById('accountFilter').value;
  const categoryFilter = document.getElementById('categoryFilter').value;
  const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
  
  let filtered = allTransactions;
  
  if (accountFilter) {
    filtered = filtered.filter(t => t.accountId === accountFilter);
  }
  
  if (categoryFilter) {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }
  
  if (searchFilter) {
    filtered = filtered.filter(t => 
      (t.description || '').toLowerCase().includes(searchFilter) ||
      (t.notes || '').toLowerCase().includes(searchFilter)
    );
  }
  
  renderTable(filtered);
}

// Render table
function renderTable(transactions) {
  const container = document.getElementById('tableContainer');
  
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Transactions Found</h2>
        <p>${allTransactions.length > 0 ? 'Try adjusting your filters.' : 'Go to your Maybank account page and categorize some transactions.'}</p>
      </div>
    `;
    return;
  }
  
  const rows = transactions.map(t => {
    const amount = parseFloat(t.amount) || 0;
    const amountClass = amount < 0 ? 'amount-negative' : 'amount-positive';
    const amountSign = amount < 0 ? '-' : '+';
    const displayAmount = 'RM ' + amountSign + Math.abs(amount).toFixed(2);
    
    const accountDisplay = t.accountName || t.accountId || 'Unknown';
    const shortAccount = t.accountId ? '...' + t.accountId.slice(-4) : 'N/A';
    
    return `
      <tr>
        <td class="cell-date">${formatDate(t.date)}</td>
        <td class="cell-account">
          <span class="account-badge" title="${escapeHtml(accountDisplay)}">${escapeHtml(shortAccount)}</span>
        </td>
        <td class="cell-desc">${escapeHtml(t.description || '')}</td>
        <td class="cell-amount ${amountClass}">${displayAmount}</td>
        <td class="cell-category">
          <span class="category-badge">${escapeHtml(t.category || 'Uncategorized')}</span>
        </td>
        <td class="cell-notes">${escapeHtml(t.notes || '')}</td>
        <td class="cell-actions">
          <button class="btn-small btn-yellow" onclick='viewJSON("${t.txId}")'>JSON</button>
          <button class="btn-small btn-red" onclick='deleteTx("${t.txId}")'>Del</button>
        </td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <table>
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
        ${rows}
      </tbody>
    </table>
  `;
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// View JSON
function viewJSON(txId) {
  const key = 'mbt_' + txId;
  chrome.storage.local.get(key, (result) => {
    const data = result[key];
    if (data) {
      document.getElementById('jsonContent').textContent = JSON.stringify(data, null, 2);
      document.getElementById('jsonModal').classList.add('active');
    }
  });
}

// Close modal
function closeModal() {
  document.getElementById('jsonModal').classList.remove('active');
}

// Delete transaction
function deleteTx(txId) {
  if (confirm('Delete this transaction?')) {
    chrome.storage.local.remove('mbt_' + txId, () => {
      loadData();
    });
  }
}

// Export JSON (only unique transactions)
function exportJSON() {
  const uniqueData = {};
  const seen = new Set();
  
  allTransactions.forEach(t => {
    if (!seen.has(t.txId)) {
      seen.add(t.txId);
      uniqueData['mbt_' + t.txId] = t;
    }
  });
  
  const blob = new Blob([JSON.stringify(uniqueData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'maybank-transactions-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Clear all
function clearAll() {
  if (confirm('Delete ALL saved transactions? This cannot be undone!')) {
    // Get unique keys to remove
    const keysToRemove = new Set();
    allTransactions.forEach(t => {
      keysToRemove.add('mbt_' + t.txId);
    });
    
    chrome.storage.local.remove(Array.from(keysToRemove), () => {
      allTransactions = [];
      loadData();
    });
  }
}

// Close modal on overlay click
document.getElementById('jsonModal').addEventListener('click', (e) => {
  if (e.target.id === 'jsonModal') {
    closeModal();
  }
});

// Load on start
loadData();
