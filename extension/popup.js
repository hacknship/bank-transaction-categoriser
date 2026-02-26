// Maybank Budget Tracker - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const hintsToggle = document.getElementById('hintsToggle');
  const extToggle = document.getElementById('extToggle');

  // Check current tab status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    // More flexible URL detection - check for maybank in various forms
    const isMaybank = /maybank/i.test(url) || url.includes('maybank2u');
    
    if (!isMaybank) {
      statusEl.textContent = 'Inactive';
      statusEl.className = 'status-value inactive';
    } else {
      statusEl.textContent = 'Active';
      statusEl.className = 'status-value active';
    }
  });

  // Load extension enabled state (default to true)
  chrome.storage.local.get(['extensionEnabled'], (result) => {
    const enabled = result.extensionEnabled !== false; // default to true
    if (enabled) {
      extToggle.classList.add('active');
    } else {
      extToggle.classList.remove('active');
    }
  });

  // Load keyboard hints state
  chrome.storage.local.get(['keyboardHintsEnabled'], (result) => {
    const enabled = result.keyboardHintsEnabled !== false; // default to true
    if (enabled) {
      hintsToggle.classList.add('active');
    }
  });

  // Toggle extension enabled
  extToggle.addEventListener('click', () => {
    const isActive = extToggle.classList.contains('active');
    const newState = !isActive;
    
    if (newState) {
      extToggle.classList.add('active');
    } else {
      extToggle.classList.remove('active');
    }
    
    // Save state
    chrome.storage.local.set({ extensionEnabled: newState });
    
    // Notify content script to enable/disable
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleExtension', 
          enabled: newState 
        }).catch(() => {
          // Content script not loaded on this page, ignore
        });
      }
    });
  });

  // Toggle keyboard hints
  hintsToggle.addEventListener('click', () => {
    const isActive = hintsToggle.classList.contains('active');
    const newState = !isActive;
    
    if (newState) {
      hintsToggle.classList.add('active');
    } else {
      hintsToggle.classList.remove('active');
    }
    
    // Save state
    chrome.storage.local.set({ keyboardHintsEnabled: newState });
    
    // Notify content script to update floating hint visibility
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleKeyboardHints', 
          enabled: newState 
        }).catch(() => {
          // Content script not loaded on this page, ignore
        });
      }
    });
  });

  // Open Dashboard button - opens the web app
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      // Open the web app dashboard
      chrome.tabs.create({ url: 'https://ss-transactions-tracker.netlify.app/' });
    });
  }
});
