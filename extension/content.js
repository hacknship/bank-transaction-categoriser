// Maybank Budget Tracker - Content Script (Ghost Cloud ONLY)
(function() {
  'use strict';

  if (!window.location.href.includes('maybank2u.com.my')) return;
  console.log('[MBT] Extension loaded - Ghost Cloud Version');

  // Ghost Database API
  const API_BASE = 'https://ss-transactions-tracker.netlify.app/.netlify/functions';
  
  let categoriesCache = null;
  let transactionsCache = null;
  let processedRows = new Set();
  let kbRow = -1;
  let kbCol = 0;
  let dropdownOpen = false;
  let isProcessing = false;

  // Fetch categories from Ghost DB (once per page)
  async function fetchCategories() {
    if (categoriesCache) return categoriesCache;
    
    try {
      const res = await fetch(`${API_BASE}/get-categories`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      categoriesCache = (data.categories || []).map(c => c.name);
      console.log('[MBT] Loaded categories:', categoriesCache);
      return categoriesCache;
    } catch (e) {
      console.error('[MBT] Failed to fetch categories:', e);
      return [];
    }
  }

  // Fetch saved transactions from Ghost DB
  async function fetchTransactions(accountId) {
    if (transactionsCache) return transactionsCache;
    
    try {
      const url = `${API_BASE}/get-transactions?accountId=${encodeURIComponent(accountId)}&limit=500`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      
      // Create a map of tx_id -> transaction for quick lookup
      const txMap = {};
      (data.transactions || []).forEach(tx => {
        txMap[tx.tx_id] = tx;
      });
      
      transactionsCache = txMap;
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
      const res = await fetch(`${API_BASE}/save-transaction`, {
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
        // Update cache
        if (transactionsCache) {
          transactionsCache[txId] = {
            ...transactionsCache[txId],
            category: data.category,
            notes: data.notes,
            tx_id: txId
          };
        }
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
  hl.textContent = '.mbt-row-active{background-color:#e3f2fd!important}.mbt-row-active td{background-color:#e3f2fd!important}.mbt-cell-active select,.mbt-cell-active input{border:2px solid #2196f3!important;box-shadow:0 0 0 1px #2196f3!important}';
  document.head.appendChild(hl);

  function clearHL() {
    document.querySelectorAll('.mbt-row-active,.mbt-cell-active').forEach(function(el) {
      el.classList.remove('mbt-row-active','mbt-cell-active');
    });
  }

  function highlight(r, c) {
    clearHL();
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (r < 0 || r >= rows.length) return;
    rows[r].classList.add('mbt-row-active');
    rows[r].scrollIntoView({ behavior: 'smooth', block: 'center' });
    const cells = rows[r].querySelectorAll('.mbt-cell');
    if (cells[c]) cells[c].classList.add('mbt-cell-active');
  }

  function focusCell(r, c) {
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (r < 0 || r >= rows.length) return false;
    kbRow = r; kbCol = c;
    const cells = rows[r].querySelectorAll('.mbt-cell');
    const el = c === 0 ? (cells[0] && cells[0].querySelector('select')) : (cells[1] && cells[1].querySelector('input'));
    if (el) {
      el.focus();
      highlight(r, c);
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

  async function processRow(row, idx, CATEGORIES, savedTransactions) {
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

    const raw = dateTxt + '|' + descTxt + '|' + amtTxt + '|' + (isNeg ? 'neg' : 'pos') + '|idx' + idx;
    const txId = simpleHash(raw);

    if (processedRows.has(txId)) return;
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
      await processRow(rows[i], i, CATEGORIES, savedTransactions);
    }
    
    console.log('[MBT] Done processing');
    isProcessing = false;
  }

  function resetAndProcess() {
    processedRows.clear();
    transactionsCache = null;
    kbRow = -1; kbCol = 0;
    clearHL();
    document.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mbt-header').forEach(function(el) { el.remove(); });
    document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
    isProcessing = false;
    showSkeleton();
    setTimeout(function() {
      removeSkeleton();
      process();
      setTimeout(function() { kbRow = 0; kbCol = 0; focusCell(0, 0); }, 200);
    }, 1500);
  }

  function tryProcess(attempt) {
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
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.href.includes('accountDetails')) {
        processedRows.clear();
        transactionsCache = null;
        kbRow = -1; kbCol = 0;
        clearHL();
        isProcessing = false;
        setTimeout(function() {
          document.querySelectorAll('.mbt-cell,.mbt-header').forEach(function(el) { el.remove(); });
          document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
          tryProcess(1);
          setTimeout(function() { kbRow = 0; kbCol = 0; focusCell(0, 0); }, 800);
        }, 500);
      }
    }
  }, 200);

  document.addEventListener('click', function(e) {
    const t = e.target;
    const isNext = t.closest && (t.closest('.SavingAccountContainer---next_arrow---jbdUO') || t.closest('[class*="next_arrow"]'));
    const isBack = t.closest && (t.closest('.SavingAccountContainer---back_arrow---FqLBL') || t.closest('[class*="back_arrow"]') || t.closest('[class*="prev_arrow"]'));
    if (isNext || isBack) resetAndProcess();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (dropdownOpen) return;
    
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (rows.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (kbRow < rows.length - 1) { kbRow++; focusCell(kbRow, kbCol); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (kbRow > 0) { kbRow--; focusCell(kbRow, kbCol); }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (kbCol < 1) { kbCol++; focusCell(kbRow, kbCol); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (kbCol > 0) { kbCol--; focusCell(kbRow, kbCol); }
    } else if (e.key === 'Enter' && kbRow >= 0) {
      const cells = rows[kbRow].querySelectorAll('.mbt-cell');
      const el = kbCol === 0 ? cells[0].querySelector('select') : cells[1].querySelector('input');
      if (el) el.focus();
    }
  });

})();
