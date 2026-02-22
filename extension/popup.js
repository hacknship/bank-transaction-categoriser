// Maybank Budget Tracker - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const countEl = document.getElementById('count');
  const viewDataBtn = document.getElementById('viewDataBtn');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    // More flexible URL detection - check for maybank in various forms
    const isMaybank = /maybank/i.test(url) || url.includes('maybank2u');
    
    if (!isMaybank) {
      statusEl.textContent = 'Not on Maybank';
      statusEl.className = 'status-value inactive';
    } else {
      statusEl.textContent = 'Active';
      statusEl.className = 'status-value active';
    }
  });
  
  // Get count from chrome.storage.local (shared across extension)
  chrome.storage.local.get(null, (result) => {
    const txIds = new Set();
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('mbt_') && value && value.txId) {
        txIds.add(value.txId);
      }
    }
    countEl.textContent = txIds.size;
  });
  
  // Listen for changes and update count in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      const hasMbtChanges = Object.keys(changes).some(key => key.startsWith('mbt_'));
      if (hasMbtChanges) {
        chrome.storage.local.get(null, (result) => {
          const txIds = new Set();
          for (const [key, value] of Object.entries(result)) {
            if (key.startsWith('mbt_') && value && value.txId) {
              txIds.add(value.txId);
            }
          }
          countEl.textContent = txIds.size;
        });
      }
    }
  });

  if (viewDataBtn) {
    viewDataBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('data-viewer.html') });
    });
  }
});
