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
  // Accounts
  detectAccount: (data) => fetchAPI('/detect-account', { method: 'POST', body: JSON.stringify(data) }),
  
  // Transactions
  saveTransaction: (data) => fetchAPI('/save-transaction', { method: 'POST', body: JSON.stringify(data) }),
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-transactions?${query}`);
  },
  
  // Budget
  setBudget: (data) => fetchAPI('/set-budget', { method: 'POST', body: JSON.stringify(data) }),
  getBudget: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-budget?${query}`);
  },
  
  // Reconciliation
  getReconcile: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-reconcile?${query}`);
  },
  
  // Archive
  archiveBudget: (data) => fetchAPI('/archive-budget', { method: 'POST', body: JSON.stringify(data) }),
};
