// Maybank Budget Tracker - Content Script (Fixed v5)
(function() {
  'use strict';

  if (!window.location.href.includes('maybank2u.com.my')) return;
  console.log('[MBT] Extension loaded v5');

  const CATEGORIES = ['Food', 'Transport', 'Dining', 'Shopping', 'Medical', 'Entertainment', 'Utilities', 'Groceries', 'Others'];
  let processedRows = new Set();
  let kbRow = -1;
  let kbCol = 0;
  let dropdownOpen = false;

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function parseAmount(txt) {
    if (!txt) return 0;
    const clean = txt.replace(/RM/g, '').replace(/,/g, '').replace(/-/g, '').trim();
    return parseFloat(clean) || 0;
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

  function saveTx(txId, data) {
    try {
      localStorage.setItem('mbt_' + txId, JSON.stringify(data));
    } catch (e) {}
  }

  function loadTx(txId) {
    try {
      const item = localStorage.getItem('mbt_' + txId);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }

  // Skeleton loading
  function showSkeleton() {
    const tbody = document.querySelector('table[class*="AccountTable"] tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.querySelector('.mbt-skeleton')) continue;
      
      const skStyle = 'background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:mbtsk 1.5s infinite;';
      
      [0,1,2].forEach(function(idx) {
        const cell = document.createElement('td');
        cell.className = 'mbt-cell mbt-skeleton';
        cell.style.cssText = 'padding:8px;' + (idx === 2 ? 'text-align:center;' : '');
        const div = document.createElement('div');
        div.style.cssText = skStyle + 'height:32px;border-radius:4px;width:' + (idx === 2 ? '32px;margin:0 auto;' : '100%;');
        cell.appendChild(div);
        row.appendChild(cell);
      });
    }
    
    if (!document.getElementById('mbtsk')) {
      const s = document.createElement('style');
      s.id = 'mbtsk';
      s.textContent = '@keyframes mbtsk{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(s);
    }
  }

  function removeSkeleton() {
    document.querySelectorAll('.mbt-skeleton').forEach(function(el) { el.remove(); });
  }

  // Highlight styles
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

  function saveRow(row) {
    const txId = row.getAttribute('data-mbt-id');
    const sel = row.querySelector('select');
    const inp = row.querySelector('input[type="text"]');
    if (!txId || !sel || !inp) return;
    
    const cells = row.querySelectorAll('td');
    const date = parseDate(cells[0] && cells[0].textContent ? cells[0].textContent.trim() : '');
    if (!date) return;
    
    saveTx(txId, {
      txId: txId, date: date,
      description: cells[1] && cells[1].textContent ? cells[1].textContent.trim() : '',
      amount: parseAmount(cells[3] && cells[3].textContent ? cells[3].textContent.trim() : ''),
      category: sel.value, notes: inp.value,
      savedAt: new Date().toISOString()
    });
    
    const st = row.querySelectorAll('.mbt-cell')[2];
    if (st && sel.value) st.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
  }

  function processRow(row, idx) {
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

    const saved = loadTx(txId);

    // Category
    const cat = document.createElement('td');
    cat.className = 'mbt-cell';
    cat.style.cssText = 'padding:8px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;background:white;';
    sel.innerHTML = '<option value="">-- Select --</option>' + 
      CATEGORIES.map(function(c) { return '<option value="' + c + '"' + (c === (saved && saved.category) ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    cat.appendChild(sel);

    // Notes
    const note = document.createElement('td');
    note.className = 'mbt-cell';
    note.style.cssText = 'padding:8px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;';
    inp.placeholder = 'Notes...';
    inp.value = (saved && saved.notes) || '';
    note.appendChild(inp);

    // Status
    const status = document.createElement('td');
    status.className = 'mbt-cell';
    status.style.cssText = 'padding:8px;text-align:center;';
    if (saved && saved.category) status.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';

    row.appendChild(cat);
    row.appendChild(note);
    row.appendChild(status);

    sel.addEventListener('change', function() { saveRow(row); });
    sel.addEventListener('mousedown', function() { dropdownOpen = true; });
    sel.addEventListener('blur', function() { setTimeout(function() { dropdownOpen = false; }, 200); });
    inp.addEventListener('blur', function() { saveRow(row); });
  }

  function process() {
    console.log('[MBT] Processing...');
    const table = document.querySelector('table[class*="AccountTable"]');
    if (!table) { console.log('[MBT] No table'); return; }

    const tbody = table.querySelector('tbody');
    if (!tbody) { console.log('[MBT] No tbody'); return; }

    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.mbt-header')) {
      ['CATEGORY','NOTES','✓'].forEach(function(t,i) {
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
    for (let i = 0; i < rows.length; i++) processRow(rows[i], i);
    console.log('[MBT] Done');
    
    // Show help panel only when table detected
    if (rows.length > 0 && !document.getElementById('mbt-help-panel')) {
      setTimeout(createHelpPanel, 2000);
    }
  }

  function resetAndProcess() {
    processedRows.clear();
    kbRow = -1; kbCol = 0;
    clearHL();
    document.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mbt-header').forEach(function(el) { el.remove(); });
    document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
    showSkeleton();
    setTimeout(function() {
      removeSkeleton();
      process();
      setTimeout(function() { kbRow = 0; kbCol = 0; focusCell(0, 0); }, 200);
    }, 1500);
  }

  // Multiple attempts to process on initial load
  function tryProcess(attempt) {
    attempt = attempt || 1;
    console.log('[MBT] Try process attempt', attempt);
    
    const table = document.querySelector('table[class*="AccountTable"]');
    if (table && table.querySelector('tbody tr')) {
      process();
      return true;
    }
    
    if (attempt < 30) {
      setTimeout(function() { tryProcess(attempt + 1); }, 500);
    }
    return false;
  }

  // Start processing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { tryProcess(1); });
  } else {
    tryProcess(1);
  }

  // Fallbacks
  setTimeout(function() { if (processedRows.size === 0) tryProcess(99); }, 3000);
  setTimeout(function() { if (processedRows.size === 0) tryProcess(999); }, 6000);

  // URL change detection
  let lastUrl = location.href;
  setInterval(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.href.includes('accountDetails')) {
        processedRows.clear();
        kbRow = -1; kbCol = 0;
        clearHL();
        setTimeout(function() {
          document.querySelectorAll('.mbt-cell,.mbt-header').forEach(function(el) { el.remove(); });
          document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
          tryProcess(1);
          setTimeout(function() { kbRow = 0; kbCol = 0; focusCell(0, 0); }, 800);
        }, 500);
      }
    }
  }, 200);

  // Pagination clicks
  document.addEventListener('click', function(e) {
    const t = e.target;
    const isNext = t.closest && (t.closest('.SavingAccountContainer---next_arrow---jbdUO') || t.closest('[class*="next_arrow"]'));
    const isBack = t.closest && (t.closest('.SavingAccountContainer---back_arrow---FqLBL') || t.closest('[class*="back_arrow"]') || t.closest('[class*="prev_arrow"]'));
    if (isNext || isBack) resetAndProcess();
  });

  // Fetch detection
  const origFetch = window.fetch;
  window.fetch = function() {
    const url = arguments[0];
    const isTrans = typeof url === 'string' && url.indexOf('TransHistory') !== -1;
    const promise = origFetch.apply(window, arguments);
    if (isTrans) promise.then(function() { setTimeout(resetAndProcess, 1000); });
    return promise;
  };

  // KEYBOARD
  document.addEventListener('keydown', function(e) {
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (rows.length === 0) return;

    // Pagination
    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.key === '.')) {
      e.preventDefault();
      clearHL();
      kbRow = -1; kbCol = 0;
      if (e.key === ',') {
        const prev = document.querySelector('.SavingAccountContainer---back_arrow---FqLBL,[class*="back_arrow"]');
        if (prev) prev.click();
      } else {
        const next = document.querySelector('.SavingAccountContainer---next_arrow---jbdUO,[class*="next_arrow"]');
        if (next) next.click();
      }
      return;
    }

    const active = document.activeElement;
    const isSelect = active && active.tagName === 'SELECT';
    const isInput = active && active.tagName === 'INPUT';
    const isInMbt = active && active.closest && active.closest('.mbt-cell');

    // Start navigation
    if (!isInMbt && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) !== -1) {
      e.preventDefault();
      const table = document.querySelector('table[class*="AccountTable"]');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      kbRow = 0; kbCol = 0;
      focusCell(0, 0);
      return;
    }

    if (!isInMbt) return;

    // ENTER handling
    if (e.key === 'Enter') {
      const row = active.closest('tr[data-mbt-id]');
      if (!row) return;

      if (isSelect) {
        if (!dropdownOpen) {
          // First Enter - open dropdown
          e.preventDefault();
          dropdownOpen = true;
          active.click();
          // Update size to show options
          active.size = Math.min(active.options.length, 5);
          return;
        } else {
          // Second Enter - dropdown is open, select and move
          e.preventDefault();
          dropdownOpen = false;
          active.size = 1;
          saveRow(row);
          for (let i = 0; i < rows.length; i++) if (rows[i] === row) kbRow = i;
          kbCol = 1;
          focusCell(kbRow, kbCol);
          return;
        }
      } else if (isInput) {
        e.preventDefault();
        saveRow(row);
        kbRow = Math.min(kbRow + 1, rows.length - 1);
        kbCol = 0;
        focusCell(kbRow, kbCol);
        return;
      }
    }

    // ESC to close dropdown
    if (e.key === 'Escape' && isSelect && dropdownOpen) {
      dropdownOpen = false;
      active.size = 1;
      return;
    }

    // Arrows - only if dropdown not open
    if (dropdownOpen && isSelect) return;

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) !== -1) {
      e.preventDefault();

      const row = active.closest('tr[data-mbt-id]');
      if (row) {
        for (let i = 0; i < rows.length; i++) if (rows[i] === row) kbRow = i;
      }
      const cell = active.closest('.mbt-cell');
      if (cell) {
        const cs = row.querySelectorAll('.mbt-cell');
        for (let i = 0; i < cs.length; i++) if (cs[i] === cell) kbCol = i < 2 ? i : kbCol;
      }

      switch (e.key) {
        case 'ArrowDown': kbRow = Math.min(kbRow + 1, rows.length - 1); break;
        case 'ArrowUp': kbRow = Math.max(kbRow - 1, 0); break;
        case 'ArrowRight': kbCol = Math.min(kbCol + 1, 1); break;
        case 'ArrowLeft': kbCol = Math.max(kbCol - 1, 0); break;
      }

      focusCell(kbRow, kbCol);
    }
  }, true);

  document.addEventListener('focusin', function(e) {
    const t = e.target;
    if (t.tagName === 'SELECT' || t.tagName === 'INPUT') {
      const row = t.closest && t.closest('tr[data-mbt-id]');
      if (row) {
        const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
        for (let i = 0; i < rows.length; i++) if (rows[i] === row) kbRow = i;
        const cell = t.closest('.mbt-cell');
        if (cell) {
          const cs = row.querySelectorAll('.mbt-cell');
          for (let i = 0; i < cs.length; i++) if (cs[i] === cell) kbCol = i < 2 ? i : kbCol;
        }
        highlight(kbRow, kbCol);
      }
    }
  });

  // HELP PANEL - Only show when table exists
  function createHelpPanel() {
    if (document.getElementById('mbt-help-panel')) return;
    
    // Only create if table exists
    const table = document.querySelector('table[class*="AccountTable"]');
    if (!table) return;
    
    if (localStorage.getItem('mbt_help_closed') === 'true') return;
    
    const panel = document.createElement('div');
    panel.id = 'mbt-help-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.85);color:white;padding:15px 20px;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.6;z-index:10000;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    
    panel.innerHTML = '<div style="font-weight:bold;margin-bottom:10px;color:#ffc83d;font-size:14px;">⌨️ Keyboard Shortcuts</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">↑↓←→</span> Navigate cells</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">Enter</span> Open dropdown / Select & next</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">⌘,</span> Previous page</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">⌘.</span> Next page</div>' +
      '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #444;font-size:11px;color:#aaa;">Press any arrow key to start</div>';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;line-height:24px;';
    closeBtn.onclick = function() {
      panel.style.display = 'none';
      localStorage.setItem('mbt_help_closed', 'true');
    };
    panel.appendChild(closeBtn);
    
    document.body.appendChild(panel);
  }

  window.MBT = {
    reprocess: resetAndProcess,
    process: process,
    focusCell: focusCell,
    listSaved: function() {
      const saved = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mbt_')) {
          try {
            const d = JSON.parse(localStorage.getItem(key));
            saved.push({ id: key.replace('mbt_', ''), category: d.category, notes: d.notes });
          } catch (e) {}
        }
      }
      console.log('[MBT] Saved:', saved);
      return saved;
    }
  };

})();
