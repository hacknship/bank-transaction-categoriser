// Maybank Budget Tracker - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const countEl = document.getElementById('count');
  const dashboardBtn = document.getElementById('dashboardBtn');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const isMaybank = url.includes('maybank2u.com.my');
    
    if (!isMaybank) {
      statusEl.textContent = 'Not on Maybank';
      statusEl.className = 'status-value inactive';
      countEl.textContent = '0';
      return;
    }

    statusEl.textContent = 'On Maybank';
    statusEl.className = 'status-value active';

    chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (res) => {
      if (chrome.runtime.lastError) {
        countEl.textContent = '0';
        return;
      }
      countEl.textContent = res?.count || 0;
    });
  });

  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://your-netlify-site.netlify.app' });
  });
});
