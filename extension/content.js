// Maybank Budget Tracker - Content Script (Ghost Cloud ONLY)
(function() {
  'use strict';

  if (!window.location.href.includes('maybank2u.com.my')) return;
  console.log('[MBT] Extension loaded - Ghost Cloud Version');

  // Ghost Database API
  const API_BASE = 'https://ss-transactions-tracker.netlify.app/.netlify/functions';
  
  // API Key for authentication - UPDATE THIS when deploying
  // This should match the API_KEY in your Netlify environment variables
  const API_KEY = '095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c';
  
  // NO CACHING - always fetch fresh data
  let processedRows = new Set();
  let kbRow = -1;
  let kbCol = 0;
  let dropdownOpen = false;
  let isProcessing = false;
  let selectElementOpen = null; // Track which select is currently open
  let keyboardHintsEnabled = true; // Default enabled
  let extensionEnabled = true; // Default enabled
  let dropdownOpening = false; // Track if we're in process of opening dropdown

  // Floating keyboard hint element
  let floatingHint = null;

  // ===== EXTENSION ENABLE/DISABLE FUNCTIONS =====
  
  function disableExtension() {
    console.log('[MBT] Disabling extension...');
    extensionEnabled = false;
    
    // Remove all MBT columns and headers
    document.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mbt-header').forEach(function(el) { el.remove(); });
    document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
    
    // Remove floating hint
    if (floatingHint) {
      floatingHint.remove();
      floatingHint = null;
    }
    
    // Reset state
    processedRows.clear();
    kbRow = -1;
    kbCol = 0;
    clearHL();
    
    // Remove highlight styles
    const hlStyle = document.getElementById('mbt-hl-style');
    if (hlStyle) hlStyle.remove();
  }

  function enableExtension() {
    console.log('[MBT] Enabling extension...');
    extensionEnabled = true;
    
    // Re-add highlight styles if removed
    if (!document.getElementById('mbt-hl-style')) {
      const hl = document.createElement('style');
      hl.id = 'mbt-hl-style';
      hl.textContent = '.mbt-row-active{background-color:#e3f2fd!important}.mbt-row-active td{background-color:#e3f2fd!important}.mbt-cell-active select,.mbt-cell-active input{border:2px solid #2196f3!important;box-shadow:0 0 0 1px #2196f3!important}';
      document.head.appendChild(hl);
    }
    
    // Re-process the table
    resetAndProcess();
  }

  // Create floating keyboard shortcut hint
  function createFloatingHint() {
    if (floatingHint) return;
    if (!extensionEnabled) return;
    
    floatingHint = document.createElement('div');
    floatingHint.id = 'mbt-floating-hint';
    floatingHint.innerHTML = `
      <div class="mbt-hint-title">⌨️ Keyboard Shortcuts</div>
      <div class="mbt-hint-row">
        <span>Navigate</span>
        <span class="mbt-hint-key">↑↓←→</span>
      </div>
      <div class="mbt-hint-row">
        <span>Save & Next</span>
        <span class="mbt-hint-key">Enter</span>
      </div>
      <div class="mbt-hint-row">
        <span>Close Dropdown</span>
        <span class="mbt-hint-key">Esc</span>
      </div>
      <div class="mbt-hint-row">
        <span>Next/Prev Page</span>
        <span class="mbt-hint-key">⌘.</span>
        <span class="mbt-hint-key">⌘,</span>
      </div>
    `;
    
    // Add styles if not present
    if (!document.getElementById('mbt-floating-hint-style')) {
      const style = document.createElement('style');
      style.id = 'mbt-floating-hint-style';
      style.textContent = `
        #mbt-floating-hint {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #000;
          color: #FFD600;
          padding: 16px;
          border: 3px solid #FFD600;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
          font-family: 'Space Grotesk', -apple-system, sans-serif;
          font-size: 12px;
          z-index: 999999;
          min-width: 200px;
          transition: opacity 0.3s, transform 0.3s;
        }
        #mbt-floating-hint.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        #mbt-floating-hint .mbt-hint-title {
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 2px solid #FFD600;
        }
        #mbt-floating-hint .mbt-hint-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          color: #fff;
        }
        #mbt-floating-hint .mbt-hint-key {
          background: #FFD600;
          color: #000;
          padding: 2px 8px;
          border: 2px solid #FFD600;
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
          margin-left: 4px;
        }
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(floatingHint);
    
    // Apply current visibility state
    updateFloatingHintVisibility();
  }

  function updateFloatingHintVisibility() {
    if (!floatingHint) return;
    if (!extensionEnabled) {
      floatingHint.classList.add('hidden');
      return;
    }
    if (keyboardHintsEnabled) {
      floatingHint.classList.remove('hidden');
    } else {
      floatingHint.classList.add('hidden');
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleKeyboardHints') {
      keyboardHintsEnabled = request.enabled;
      updateFloatingHintVisibility();
      sendResponse({ success: true });
    }
    if (request.action === 'toggleExtension') {
      if (request.enabled) {
        enableExtension();
      } else {
        disableExtension();
      }
      sendResponse({ success: true });
    }
  });

  // Load preferences
  chrome.storage.local.get(['keyboardHintsEnabled', 'extensionEnabled'], (result) => {
    keyboardHintsEnabled = result.keyboardHintsEnabled !== false; // default true
    extensionEnabled = result.extensionEnabled !== false; // default true
    
    if (!extensionEnabled) {
      // Don't process if disabled
      disableExtension();
    }
    updateFloatingHintVisibility();
  });

  // Fetch categories from Ghost DB (fresh every time)
  async function fetchCategories() {
    try {
      // Add cache-busting query param
      const res = await fetch(`${API_BASE}/get-categories?key=${API_KEY}&t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const cats = (data.categories || []).map(c => c.name);
      console.log('[MBT] Loaded categories:', cats);
      return cats;
    } catch (e) {
      console.error('[MBT] Failed to fetch categories:', e);
      return [];
    }
  }

  // Fetch saved transactions from Ghost DB
  async function fetchTransactions(accountId) {
    try {
      const url = `${API_BASE}/get-transactions?key=${API_KEY}&accountId=${encodeURIComponent(accountId)}&limit=500&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      
      // Create a map of tx_id -> transaction for quick lookup
      const txMap = {};
      (data.transactions || []).forEach(tx => {
        txMap[tx.tx_id] = tx;
      });
      
      console.log('[MBT] Loaded', Object.keys(txMap).length, 'saved transactions');
      return txMap;
    } catch (e) {
      console.error('[MBT] Failed to fetch transactions:', e);
      return {};
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function parseAmount(txt, isNegative) {
    if (!txt) return 0;
    const clean = txt.replace(/RM/g, '').replace(/,/g, '').replace(/-/g, '').trim();
    const amount = parseFloat(clean) || 0;
    return isNegative ? -amount : amount;
  }

  function parseDate(txt) {
    if (!txt) return null;
    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
    const m = txt.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = months[m[2]];
      if (month) return m[3] + '-' + month + '-' + day;
    }
    return null;
  }

  // Save transaction to Ghost DB
  async function saveTx(txId, data) {
    try {
      const res = await fetch(`${API_BASE}/save-transaction?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: data.txId,
          accountId: data.accountId,
          txDate: data.date,
          description: data.description,
          amount: data.amount,
          category: data.category,
          notes: data.notes
        })
      });
      
      if (res.ok) {
        console.log('[MBT] Saved to Ghost DB:', txId);
        return true;
      } else {
        console.error('[MBT] Failed to save:', res.status);
        return false;
      }
    } catch (e) {
      console.error('[MBT] Network error saving:', e);
      return false;
    }
  }

  // Show skeleton loading for all rows at once
  function showSkeleton() {
    const tbody = document.querySelector('table[class*="AccountTable"] tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) return;
    
    // Add skeleton style if not present
    if (!document.getElementById('mbtsk')) {
      const s = document.createElement('style');
      s.id = 'mbtsk';
      s.textContent = `
        @keyframes mbtsk{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .mbt-skeleton-cell { 
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: mbtsk 1.5s infinite;
        }
      `;
      document.head.appendChild(s);
    }
    
    // Add skeleton cells to each row
    rows.forEach(row => {
      if (row.querySelector('.mbt-skeleton')) return;
      
      [0,1,2].forEach(function(idx) {
        const cell = document.createElement('td');
        cell.className = 'mbt-cell mbt-skeleton';
        cell.style.cssText = 'padding:8px;' + (idx === 2 ? 'text-align:center;' : '');
        const div = document.createElement('div');
        div.style.cssText = 'height:36px;border-radius:4px;width:' + (idx === 2 ? '32px;margin:0 auto;' : '100%;') + 'background:#e0e0e0;';
        div.className = 'mbt-skeleton-cell';
        cell.appendChild(div);
        row.appendChild(cell);
      });
    });
  }

  function removeSkeleton() {
    document.querySelectorAll('.mbt-skeleton').forEach(function(el) { el.remove(); });
  }

  const hl = document.createElement('style');
  hl.id = 'mbt-hl-style';
  hl.textContent = '.mbt-row-active{background-color:#e3f2fd!important}.mbt-row-active td{background-color:#e3f2fd!important}.mbt-cell-active select,.mbt-cell-active input{border:2px solid #2196f3!important;box-shadow:0 0 0 1px #2196f3!important}';
  document.head.appendChild(hl);

  function clearHL() {
    document.querySelectorAll('.mbt-row-active,.mbt-cell-active').forEach(function(el) {
      el.classList.remove('mbt-row-active','mbt-cell-active');
    });
  }

  function highlight(r, c) {
    // Don't re-highlight if dropdown is opening (prevents dropdown closing)
    if (dropdownOpening) return;
    
    clearHL();
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (r < 0 || r >= rows.length) return;
    rows[r].classList.add('mbt-row-active');
    const cells = rows[r].querySelectorAll('.mbt-cell');
    if (cells[c]) cells[c].classList.add('mbt-cell-active');
  }

  function focusCell(r, c, scroll = true) {
    // Don't change focus if dropdown is opening (prevents dropdown closing)
    if (dropdownOpening) return false;
    
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (r < 0 || r >= rows.length) return false;
    kbRow = r; kbCol = c;
    const cells = rows[r].querySelectorAll('.mbt-cell');
    const el = c === 0 ? (cells[0] && cells[0].querySelector('select')) : (cells[1] && cells[1].querySelector('input'));
    if (el) {
      el.focus();
      highlight(r, c);
      if (scroll) {
        rows[r].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    }
    return false;
  }

  function extractAccountInfo() {
    const accountContainer = document.querySelector('.SavingAccountContainer---accountName---1Z4m8') || 
                             document.querySelector('[class*="SavingAccountContainer---accountName"]') ||
                             document.querySelector('[class*="accountName"]');
    
    if (!accountContainer) return null;
    
    const spans = accountContainer.querySelectorAll('span');
    let accountName = '';
    let accountType = '';
    let accountNumber = '';
    
    spans.forEach(span => {
      const text = span.textContent.trim();
      const className = span.className || '';
      
      if (className.includes('number')) {
        accountNumber = text.replace(/[^0-9]/g, '');
      } else if (text.startsWith('(') && text.endsWith(')')) {
        accountType = text.slice(1, -1);
      } else if (text && !className.includes('number')) {
        accountName = text;
      }
    });
    
    if (!accountNumber) {
      const fullText = accountContainer.textContent;
      const numMatch = fullText.match(/(\d{10,})/);
      if (numMatch) accountNumber = numMatch[1];
    }
    
    return {
      accountId: accountNumber || 'unknown',
      accountName: (accountName + ' ' + accountType).trim() || 'Unknown Account',
      accountNumber: accountNumber || 'unknown'
    };
  }

  async function saveRow(row) {
    const txId = row.getAttribute('data-mbt-id');
    const sel = row.querySelector('select');
    const inp = row.querySelector('input[type="text"]');
    if (!txId || !sel || !inp) return;
    
    const cells = row.querySelectorAll('td');
    const date = parseDate(cells[0] && cells[0].textContent ? cells[0].textContent.trim() : '');
    if (!date) return;
    
    const accountInfo = extractAccountInfo();
    
    const amtCell = cells[3];
    const isNeg = amtCell && amtCell.querySelector('.SavingAccountContainer---negativeAmount---2fwWg') ? true : false;
    
    const data = {
      txId: txId, date: date,
      description: cells[1] && cells[1].textContent ? cells[1].textContent.trim() : '',
      amount: parseAmount(amtCell && amtCell.textContent ? amtCell.textContent.trim() : '', isNeg),
      category: sel.value, notes: inp.value,
      accountId: accountInfo ? accountInfo.accountId : null,
      accountName: accountInfo ? accountInfo.accountName : null,
      savedAt: new Date().toISOString()
    };
    
    const success = await saveTx(txId, data);
    
    const st = row.querySelectorAll('.mbt-cell')[2];
    if (st) {
      if (success) {
        st.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
      } else {
        st.innerHTML = '<span style="color:#ff5555;font-weight:bold;">✗</span>';
      }
    }
  }

  async function processRow(row, idx, CATEGORIES, savedTransactions, accountId) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;

    const dateCell = cells[0], descCell = cells[1], amtCell = cells[3];
    if (!dateCell || !descCell || !amtCell) return;

    const dateTxt = dateCell.textContent ? dateCell.textContent.trim() : '';
    const descTxt = descCell.textContent ? descCell.textContent.trim() : '';
    const amtTxt = amtCell.textContent ? amtCell.textContent.trim() : '';
    const isNeg = amtCell.querySelector('.SavingAccountContainer---negativeAmount---2fwWg') ? true : false;

    const date = parseDate(dateTxt);
    if (!date) return;

    const amount = parseAmount(amtTxt, isNeg);
    
    // Generate stable ID using only stable fields (no row index)
    const raw = accountId + '|' + date + '|' + descTxt + '|' + amount;
    let txId = simpleHash(raw);
    
    // Handle edge case: same merchant, same amount, same day
    // Add suffix counter if needed
    if (processedRows.has(txId)) {
      let counter = 1;
      let newTxId = txId + '-' + counter;
      while (processedRows.has(newTxId)) {
        counter++;
        newTxId = txId + '-' + counter;
      }
      txId = newTxId;
    }
    processedRows.add(txId);

    row.setAttribute('data-mbt-id', txId);
    row.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });

    // Check for saved data
    const savedTx = savedTransactions[txId];
    const savedCategory = savedTx ? savedTx.category : '';
    const savedNotes = savedTx ? savedTx.notes : '';

    const cat = document.createElement('td');
    cat.className = 'mbt-cell';
    cat.style.cssText = 'padding:8px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;background:white;';
    
    if (CATEGORIES.length === 0) {
      sel.innerHTML = '<option value="">No categories - check API</option>';
    } else {
      let optionsHtml = '<option value="">-- Select --</option>';
      CATEGORIES.forEach(function(c) {
        const selected = (c === savedCategory) ? ' selected' : '';
        optionsHtml += '<option value="' + c + '"' + selected + '>' + c + '</option>';
      });
      sel.innerHTML = optionsHtml;
    }
    cat.appendChild(sel);

    const note = document.createElement('td');
    note.className = 'mbt-cell';
    note.style.cssText = 'padding:8px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;';
    inp.placeholder = 'Notes...';
    inp.value = savedNotes || '';
    note.appendChild(inp);

    const status = document.createElement('td');
    status.className = 'mbt-cell';
    status.style.cssText = 'padding:8px;text-align:center;';
    // Show checkmark if data was loaded from DB
    if (savedCategory || savedNotes) {
      status.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
    }

    row.appendChild(cat);
    row.appendChild(note);
    row.appendChild(status);

    sel.addEventListener('change', function() { saveRow(row); });
    sel.addEventListener('mousedown', function() { dropdownOpen = true; });
    sel.addEventListener('blur', function() { setTimeout(function() { dropdownOpen = false; }, 200); });
    inp.addEventListener('blur', function() { saveRow(row); });
  }

  async function process() {
    if (isProcessing) return;
    if (!extensionEnabled) return;
    isProcessing = true;
    
    console.log('[MBT] Processing...');
    const table = document.querySelector('table[class*="AccountTable"]');
    if (!table) { console.log('[MBT] No table'); isProcessing = false; return; }

    const tbody = table.querySelector('tbody');
    if (!tbody) { console.log('[MBT] No tbody'); isProcessing = false; return; }

    // Add headers if not present
    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.mbt-header')) {
      ['CATEGORY','NOTES',''].forEach(function(t,i) {
        const th = document.createElement('th');
        th.className = 'mbt-header';
        th.textContent = t;
        th.style.cssText = 'background:#373737;color:white;padding:12px 8px;text-align:left;font-size:12px;text-transform:uppercase;';
        if (i === 2) th.style.width = '40px';
        thead.appendChild(th);
      });
    }

    const rows = tbody.querySelectorAll('tr');
    console.log('[MBT] Found', rows.length, 'rows');
    
    // Fetch data ONCE before processing all rows
    const accountInfo = extractAccountInfo();
    const accountId = accountInfo ? accountInfo.accountId : 'unknown';
    
    const [CATEGORIES, savedTransactions] = await Promise.all([
      fetchCategories(),
      fetchTransactions(accountId)
    ]);
    
    // Process all rows with cached data
    for (let i = 0; i < rows.length; i++) {
      await processRow(rows[i], i, CATEGORIES, savedTransactions, accountId);
    }
    
    console.log('[MBT] Done processing');
    isProcessing = false;
    
    // Create floating hint after processing is done
    createFloatingHint();
    
    // FIX #1: Auto-select first row, first column after initial load
    const activeEl = document.activeElement;
    if (kbRow === -1 && (!activeEl || activeEl.tagName === 'BODY')) {
      console.log('[MBT] Auto-selecting first row, first column on load');
      kbRow = 0;
      kbCol = 0;
      setTimeout(() => {
        focusCell(0, 0, true);
      }, 100);
    }
  }

  function resetAndProcess() {
    if (!extensionEnabled) return;
    processedRows.clear();
    kbRow = -1;
    kbCol = 0;
    clearHL();
    document.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mbt-header').forEach(function(el) { el.remove(); });
    document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
    isProcessing = false;
    showSkeleton();
    setTimeout(function() {
      removeSkeleton();
      process();
    }, 1500);
  }

  function tryProcess(attempt) {
    if (!extensionEnabled) return false;
    attempt = attempt || 1;
    console.log('[MBT] Try process attempt', attempt);
    
    const table = document.querySelector('table[class*="AccountTable"]');
    if (table && table.querySelector('tbody tr')) {
      showSkeleton();
      setTimeout(function() {
        removeSkeleton();
        process();
      }, 800);
      return true;
    }
    
    if (attempt < 30) {
      setTimeout(function() { tryProcess(attempt + 1); }, 500);
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { tryProcess(1); });
  } else {
    tryProcess(1);
  }

  setTimeout(function() { if (processedRows.size === 0) tryProcess(99); }, 3000);
  setTimeout(function() { if (processedRows.size === 0) tryProcess(999); }, 6000);

  let lastUrl = location.href;
  setInterval(function() {
    if (!extensionEnabled) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.href.includes('accountDetails')) {
        processedRows.clear();
        kbRow = -1; kbCol = 0;
        clearHL();
        isProcessing = false;
        setTimeout(function() {
          document.querySelectorAll('.mbt-cell,.mbt-header').forEach(function(el) { el.remove(); });
          document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
          tryProcess(1);
        }, 500);
      }
    }
  }, 200);

  document.addEventListener('click', function(e) {
    if (!extensionEnabled) return;
    const t = e.target;
    const isNext = t.closest && (t.closest('.SavingAccountContainer---next_arrow---jbdUO') || t.closest('[class*="next_arrow"]'));
    const isBack = t.closest && (t.closest('.SavingAccountContainer---back_arrow---FqLBL') || t.closest('[class*="back_arrow"]') || t.closest('[class*="prev_arrow"]'));
    if (isNext || isBack) {
      resetAndProcess();
    }
  });

  // ===== KEYBOARD NAVIGATION SYSTEM =====
  
  // Track if we're in "keyboard nav mode" vs just typing
  let keyboardNavActive = false;
  
  // Helper: Get all MBT rows
  function getRows() {
    return document.querySelectorAll('tbody tr[data-mbt-id]');
  }
  
  // Helper: Get cell element at position
  function getCell(rowIdx, colIdx) {
    const rows = getRows();
    if (rowIdx < 0 || rowIdx >= rows.length) return null;
    const cells = rows[rowIdx].querySelectorAll('.mbt-cell');
    if (colIdx < 0 || colIdx >= cells.length) return null;
    return colIdx === 0 ? cells[colIdx]?.querySelector('select') : cells[colIdx]?.querySelector('input');
  }
  
  // Helper: Move to next row's first column (Category)
  async function moveToNextRowCategory() {
    const rows = getRows();
    if (kbRow >= 0 && kbRow < rows.length) {
      await saveRow(rows[kbRow]);
      if (kbRow < rows.length - 1) {
        kbRow++;
        kbCol = 0; // Go to Category column
        focusCell(kbRow, kbCol);
      }
    }
  }
  
  // Helper: Move to Notes column in same row
  function moveToNotesColumn() {
    kbCol = 1;
    focusCell(kbRow, kbCol);
  }
  
  // Main keyboard handler
  document.addEventListener('keydown', function(e) {
    if (!extensionEnabled) return;
    
    const rows = getRows();
    const activeEl = document.activeElement;
    const isSelect = activeEl?.tagName === 'SELECT';
    const isInput = activeEl?.tagName === 'INPUT';
    const isInMBT = activeEl?.closest?.('tr[data-mbt-id]') !== null;
    
    console.log('[MBT] Key:', e.key, 'Target:', activeEl?.tagName, 'isSelect:', isSelect, 'kbRow:', kbRow, 'selectElementOpen:', selectElementOpen);
    
    // ESCAPE: Always clear focus and exit nav mode
    if (e.key === 'Escape') {
      e.preventDefault();
      keyboardNavActive = false;
      kbRow = -1;
      kbCol = 0;
      clearHL();
      if (activeEl) activeEl.blur();
      selectElementOpen = null;
      dropdownOpening = false;
      return;
    }
    
    // PAGINATION: Cmd/Ctrl + . or ,
    if ((e.metaKey || e.ctrlKey) && (e.key === '.' || e.key === ',')) {
      e.preventDefault();
      const isNext = e.key === '.';
      const btn = isNext 
        ? (document.querySelector('[class*="next_arrow"]') || document.querySelector('.SavingAccountContainer---next_arrow---jbdUO'))
        : (document.querySelector('[class*="back_arrow"]') || document.querySelector('[class*="prev_arrow"]') || document.querySelector('.SavingAccountContainer---back_arrow---FqLBL'));
      if (btn) {
        btn.click();
        resetAndProcess();
      }
      return;
    }
    
    // No rows? Nothing to navigate
    if (rows.length === 0) return;
    
    // FIX #3: When dropdown is open and focused (expanded select with size > 1)
    if (isSelect && activeEl === selectElementOpen) {
      // Check if this is an expanded dropdown (size > 1)
      const isExpanded = activeEl.size > 1;
      
      // In dropdown - Enter selects and moves to NOTES column (right)
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset to normal dropdown
        if (isExpanded) {
          activeEl.size = 1;
          activeEl.style.height = '';
          activeEl.style.position = '';
          activeEl.style.zIndex = '';
        }
        
        selectElementOpen = null;
        dropdownOpening = false;
        
        // Save current row
        if (kbRow >= 0 && kbRow < rows.length) {
          saveRow(rows[kbRow]);
        }
        
        // Move to Notes column (right) - NOT down
        keyboardNavActive = true;
        moveToNotesColumn();
        return;
      }
      
      // ArrowRight moves to Notes field
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        
        // Reset to normal dropdown
        if (isExpanded) {
          activeEl.size = 1;
          activeEl.style.height = '';
          activeEl.style.position = '';
          activeEl.style.zIndex = '';
        }
        
        selectElementOpen = null;
        dropdownOpening = false;
        keyboardNavActive = true;
        moveToNotesColumn();
        return;
      }
      
      // Tab also moves to Notes
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        
        // Reset to normal dropdown
        if (isExpanded) {
          activeEl.size = 1;
          activeEl.style.height = '';
          activeEl.style.position = '';
          activeEl.style.zIndex = '';
        }
        
        selectElementOpen = null;
        dropdownOpening = false;
        keyboardNavActive = true;
        moveToNotesColumn();
        return;
      }
      
      // Escape closes dropdown without moving
      if (e.key === 'Escape') {
        if (isExpanded) {
          activeEl.size = 1;
          activeEl.style.height = '';
          activeEl.style.position = '';
          activeEl.style.zIndex = '';
        }
        selectElementOpen = null;
        dropdownOpening = false;
        return;
      }
      
      // Let Up/Down work natively for option selection
      return;
    }
    
    // If we're typing in Notes input field
    if (isInput && isInMBT) {
      // Enter in Notes moves to next row's Category (down)
      if (e.key === 'Enter') {
        e.preventDefault();
        keyboardNavActive = true;
        moveToNextRowCategory();
        return;
      }
      
      // Tab moves to next row's Category
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        keyboardNavActive = true;
        moveToNextRowCategory();
        return;
      }
      
      // Arrow keys navigate if keyboardNavActive
      if (keyboardNavActive) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (kbRow < rows.length - 1) { 
            kbRow++; 
            focusCell(kbRow, kbCol); 
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (kbRow > 0) { 
            kbRow--; 
            focusCell(kbRow, kbCol); 
          }
          return;
        }
        if (e.key === 'ArrowLeft' && kbCol > 0) {
          e.preventDefault();
          kbCol--;
          focusCell(kbRow, kbCol);
          return;
        }
      }
      // Otherwise let them type
      return;
    }
    
    // NAVIGATION KEYS (work everywhere except when typing in non-MBT inputs)
    
    // When kbRow is -1, ANY arrow key should select first row, first column
    if (kbRow === -1 && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      keyboardNavActive = true;
      kbRow = 0;
      kbCol = 0;
      focusCell(kbRow, kbCol);
      return;
    }
    
    // ArrowDown - Move down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      keyboardNavActive = true;
      if (kbRow < rows.length - 1) {
        kbRow++;
        focusCell(kbRow, kbCol);
      }
      return;
    }
    
    // ArrowUp - Move up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      keyboardNavActive = true;
      if (kbRow > 0) {
        kbRow--;
        focusCell(kbRow, kbCol);
      }
      return;
    }
    
    // ArrowLeft/Right - Switch columns
    if (e.key === 'ArrowLeft' && kbCol > 0) {
      e.preventDefault();
      keyboardNavActive = true;
      kbCol--;
      focusCell(kbRow, kbCol);
      return;
    }
    
    if (e.key === 'ArrowRight' && kbCol < 1) {
      e.preventDefault();
      keyboardNavActive = true;
      kbCol++;
      focusCell(kbRow, kbCol);
      return;
    }
    
    // FIX #3: ENTER behavior
    // - On Category: Open dropdown (first press only, don't re-open if already open)
    // - On Notes: Move to next row's Category
    if (e.key === 'Enter') {
      e.preventDefault();
      keyboardNavActive = true;
      
      if (kbRow === -1) {
        kbRow = 0;
        kbCol = 0;
        focusCell(kbRow, kbCol);
        return;
      }
      
      const cell = getCell(kbRow, kbCol);
      if (!cell) return;
      
      if (kbCol === 0) {
        // Category column - open dropdown
        if (selectElementOpen !== cell) {
          // First Enter - open the dropdown
          selectElementOpen = cell;
          dropdownOpening = true;
          cell.focus();
          
          // Try to open dropdown using multiple methods
          // Method 1: Standard click
          cell.click();
          
          // Method 2: Use size attribute to simulate open dropdown
          const optionCount = cell.options.length;
          cell.size = Math.min(optionCount, 10);
          cell.style.height = 'auto';
          cell.style.position = 'relative';
          cell.style.zIndex = '1000';
          
          // Clear dropdownOpening flag after a delay
          setTimeout(() => {
            dropdownOpening = false;
          }, 200);
        }
        // If dropdown is already open, Enter will be caught by the isSelect block above
      } else {
        // Notes column - move to next row's Category
        moveToNextRowCategory();
      }
      return;
    }
  });
  
  // Track when select dropdown closes via click outside
  document.addEventListener('click', function(e) {
    if (!extensionEnabled) return;
    if (selectElementOpen && e.target !== selectElementOpen && !selectElementOpen.contains(e.target)) {
      // Reset expanded dropdown if it was expanded
      if (selectElementOpen.size > 1) {
        selectElementOpen.size = 1;
        selectElementOpen.style.height = '';
        selectElementOpen.style.position = '';
        selectElementOpen.style.zIndex = '';
      }
      selectElementOpen = null;
      dropdownOpening = false;
    }
  });
  
  // Track blur on select to detect dropdown closing
  document.addEventListener('blur', function(e) {
    if (!extensionEnabled) return;
    if (e.target.tagName === 'SELECT') {
      // Reset expanded dropdown
      if (e.target.size > 1) {
        e.target.size = 1;
        e.target.style.height = '';
        e.target.style.position = '';
        e.target.style.zIndex = '';
      }
      
      // Small delay to check if focus moved to another element
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (activeEl !== e.target) {
          selectElementOpen = null;
          dropdownOpening = false;
        }
      }, 100);
    }
  }, true);

})();
