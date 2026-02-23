const API_BASE = '/.netlify/functions';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export const API = {
  // Categories
  getCategories: () => fetchAPI('/get-categories'),
  saveCategory: (data) => fetchAPI('/save-category', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  deleteCategory: (id, mode = 'unused') => fetchAPI('/delete-category', { 
    method: 'POST', 
    body: JSON.stringify({ id, mode }) 
  }),
  
  // Category merge/rename with scope options
  mergeCategories: (data) => fetchAPI('/merge-categories', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-transactions?${query}`);
  },
  getTransactionTotals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-transaction-totals?${query}`);
  },
  saveTransaction: (data) => fetchAPI('/save-transaction', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  deleteTransaction: (txId) => fetchAPI('/delete-transaction', { 
    method: 'POST', 
    body: JSON.stringify({ txId }) 
  }),

  // Budget Tracking
  getBudgetForPeriod: (period, type) => {
    const params = new URLSearchParams({ period });
    if (type) params.append('type', type);
    return fetchAPI(`/get-budget-for-period?${params}`);
  },
  updateBudgetTemplate: (data) => fetchAPI('/update-budget-template', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getBudgetHistory: () => fetchAPI('/get-budget-history'),
  updateSnapshotBudget: (data) => fetchAPI('/update-snapshot-budget', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getAvailablePeriods: () => fetchAPI('/get-available-periods'),
};
