// Background script - handles storage operations for content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save') {
    chrome.storage.local.set({ [request.key]: request.data }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async
  }
  
  if (request.action === 'load') {
    chrome.storage.local.get(request.key, (result) => {
      sendResponse({ data: result[request.key] || null });
    });
    return true;
  }
  
  if (request.action === 'loadAll') {
    chrome.storage.local.get(null, (result) => {
      const txs = {};
      for (const [key, value] of Object.entries(result)) {
        if (key.startsWith('tx_')) {
          txs[key] = value;
        }
      }
      sendResponse({ data: txs });
    });
    return true;
  }
});
