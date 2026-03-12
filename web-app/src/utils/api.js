const API_BASE = '/.netlify/functions';

// API Key for authentication - set via Netlify environment variable
// In development, you can set VITE_API_KEY in .env.local
// In production, set API_KEY in Netlify environment variables
const API_KEY = import.meta.env.VITE_API_KEY || '';

async function fetchAPI(endpoint, options = {}) {
  // Add API key to URL for GET requests, or headers for all requests
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
  
  // Add API key as query parameter for all requests
  if (API_KEY) {
    url.searchParams.append('key', API_KEY);
  }
  
  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
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
