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
  
  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/get-transactions?${query}`);
  },
  saveTransaction: (data) => fetchAPI('/save-transaction', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
};
