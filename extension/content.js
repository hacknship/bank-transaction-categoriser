// Maybank Budget Tracker - Content Script (Fixed Keyboard)
(function() {
  'use strict';

  if (!window.location.href.includes('maybank2u.com.my')) return;
  console.log('[MBT] Extension loaded v4');

  const CATEGORIES = ['Food', 'Transport', 'Dining', 'Shopping', 'Medical', 'Entertainment', 'Utilities', 'Groceries', 'Others'];
  let processedRows = new Set();
  let rowIndexCounter = 0;
  let isLoading = false;
  let kbRow = -1;
  let kbCol = 0;

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
  function showSkeletonLoading() {
    const tbody = document.querySelector('table[class*="AccountTable"] tbody');
    if (!tbody) return;
    isLoading = true;
    const rows = tbody.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) continue;
      
      const oldMbt = row.querySelectorAll('.mbt-cell');
      for (let j = 0; j < oldMbt.length; j++) oldMbt[j].remove();
      
      const skeletonStyle = 'background:linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);background-size:200% 100%;animation:mbt-sk 1.5s infinite;';
      
      ['100%', '100%', '32px'].forEach(function(w, idx) {
        const cell = document.createElement('td');
        cell.className = 'mbt-cell mbt-skeleton';
        cell.style.cssText = 'padding:8px;' + (idx === 2 ? 'text-align:center;' : '');
        const div = document.createElement('div');
        div.style.cssText = skeletonStyle + 'height:32px;border-radius:4px;width:' + w + (idx === 2 ? ';margin:0 auto;' : ';');
        cell.appendChild(div);
        row.appendChild(cell);
      });
    }
    
    if (!document.getElementById('mbt-sk-style')) {
      const style = document.createElement('style');
      style.id = 'mbt-sk-style';
      style.textContent = '@keyframes mbt-sk {0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(style);
    }
  }

  function removeSkeletonLoading() {
    document.querySelectorAll('.mbt-skeleton').forEach(function(el) { el.remove(); });
    isLoading = false;
  }

  // HIGHLIGHT Styles
  const hlStyle = document.createElement('style');
  hlStyle.textContent = `
    .mbt-row-active { background-color: #e3f2fd !important; }
    .mbt-row-active td { background-color: #e3f2fd !important; }
    .mbt-cell-active select, .mbt-cell-active input { 
      border: 2px solid #2196f3 !important; 
      box-shadow: 0 0 0 1px #2196f3 !important;
    }
  `;
  document.head.appendChild(hlStyle);

  function clearHighlight() {
    document.querySelectorAll('.mbt-row-active').forEach(function(el) { 
      el.classList.remove('mbt-row-active'); 
    });
    document.querySelectorAll('.mbt-cell-active').forEach(function(el) { 
      el.classList.remove('mbt-cell-active'); 
    });
  }

  function highlightRowAndCell(rowIdx, colIdx) {
    clearHighlight();
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (rowIdx < 0 || rowIdx >= rows.length) return;
    
    const row = rows[rowIdx];
    row.classList.add('mbt-row-active');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const cells = row.querySelectorAll('.mbt-cell');
    if (cells[colIdx]) {
      cells[colIdx].classList.add('mbt-cell-active');
    }
  }

  function focusCell(rowIdx, colIdx) {
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (rowIdx < 0 || rowIdx >= rows.length) return false;
    
    kbRow = rowIdx;
    kbCol = colIdx;
    
    const row = rows[rowIdx];
    const cells = row.querySelectorAll('.mbt-cell');
    let target = null;
    
    if (colIdx === 0 && cells[0]) {
      target = cells[0].querySelector('select');
    } else if (colIdx === 1 && cells[1]) {
      target = cells[1].querySelector('input');
    }
    
    if (target) {
      target.focus();
      highlightRowAndCell(rowIdx, colIdx);
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
      txId: txId,
      date: date,
      description: cells[1] && cells[1].textContent ? cells[1].textContent.trim() : '',
      amount: parseAmount(cells[3] && cells[3].textContent ? cells[3].textContent.trim() : ''),
      category: sel.value,
      notes: inp.value,
      savedAt: new Date().toISOString()
    });
    
    const statusCell = row.querySelectorAll('.mbt-cell')[2];
    if (statusCell && sel.value) {
      statusCell.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
    }
  }

  function processRow(row, rowIndex) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;

    const dateCell = cells[0];
    const descCell = cells[1];
    const amtCell = cells[3];

    if (!dateCell || !descCell || !amtCell) return;

    const dateTxt = dateCell.textContent ? dateCell.textContent.trim() : '';
    const descTxt = descCell.textContent ? descCell.textContent.trim() : '';
    const amtTxt = amtCell.textContent ? amtCell.textContent.trim() : '';
    const isNeg = amtCell.querySelector('.SavingAccountContainer---negativeAmount---2fwWg') ? true : false;

    const date = parseDate(dateTxt);
    const amount = parseAmount(amtTxt);
    if (!date) return;

    const rawContent = dateTxt + '|' + descTxt + '|' + amtTxt + '|' + (isNeg ? 'neg' : 'pos') + '|idx' + rowIndex;
    const txId = simpleHash(rawContent);

    if (processedRows.has(txId)) return;
    processedRows.add(txId);

    row.setAttribute('data-mbt-id', txId);

    const oldCells = row.querySelectorAll('.mbt-cell');
    for (let i = 0; i < oldCells.length; i++) oldCells[i].remove();

    const saved = loadTx(txId);

    // Category
    const catCell = document.createElement('td');
    catCell.className = 'mbt-cell';
    catCell.style.cssText = 'padding:8px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;background:white;';
    sel.innerHTML = '<option value="">-- Select --</option>' + 
      CATEGORIES.map(function(c) { return '<option value="' + c + '"' + (c === (saved && saved.category) ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    catCell.appendChild(sel);

    // Notes
    const noteCell = document.createElement('td');
    noteCell.className = 'mbt-cell';
    noteCell.style.cssText = 'padding:8px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;';
    inp.placeholder = 'Notes...';
    inp.value = (saved && saved.notes) || '';
    noteCell.appendChild(inp);

    // Status
    const statusCell = document.createElement('td');
    statusCell.className = 'mbt-cell';
    statusCell.style.cssText = 'padding:8px;text-align:center;';
    if (saved && saved.category) {
      statusCell.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
    }

    row.appendChild(catCell);
    row.appendChild(noteCell);
    row.appendChild(statusCell);

    sel.addEventListener('change', function() {
      saveRow(row);
    });

    inp.addEventListener('blur', function() {
      saveRow(row);
    });
  }

  function process() {
    console.log('[MBT] Processing...');
    const table = document.querySelector('table[class*="AccountTable"]');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.mbt-header')) {
      ['CATEGORY', 'NOTES', '✓'].forEach(function(text, i) {
        const th = document.createElement('th');
        th.className = 'mbt-header';
        th.textContent = text;
        th.style.cssText = 'background:#373737;color:white;padding:12px 8px;text-align:left;font-size:12px;text-transform:uppercase;';
        if (i === 2) th.style.width = '40px';
        thead.appendChild(th);
      });
    }

    const rows = tbody.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      processRow(rows[i], i);
    }
    console.log('[MBT] Done, processed', processedRows.size, 'rows');
  }

  function resetAndProcess() {
    processedRows.clear();
    kbRow = -1;
    kbCol = 0;
    clearHighlight();
    
    document.querySelectorAll('.mbt-cell').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mbt-header').forEach(function(el) { el.remove(); });
    document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
    
    showSkeletonLoading();
    
    setTimeout(function() {
      removeSkeletonLoading();
      process();
      setTimeout(function() {
        kbRow = 0;
        kbCol = 0;
        focusCell(0, 0);
      }, 200);
    }, 1500);
  }

  // Initial load
  function waitForTable() {
    const table = document.querySelector('table[class*="AccountTable"]');
    if (table && table.querySelector('tbody tr')) {
      process();
    } else {
      setTimeout(waitForTable, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForTable);
  } else {
    waitForTable();
  }

  setTimeout(function() {
    if (processedRows.size === 0) process();
  }, 2000);

  // URL change detection
  let lastUrl = location.href;
  setInterval(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.href.includes('accountDetails')) {
        processedRows.clear();
        kbRow = -1;
        kbCol = 0;
        clearHighlight();
        setTimeout(function() {
          document.querySelectorAll('.mbt-cell, .mbt-header').forEach(function(el) { el.remove(); });
          document.querySelectorAll('tr[data-mbt-id]').forEach(function(el) { el.removeAttribute('data-mbt-id'); });
          
          const tryProcess = function() {
            const table = document.querySelector('table[class*="AccountTable"]');
            if (table && table.querySelector('tbody tr')) {
              process();
              setTimeout(function() {
                kbRow = 0;
                kbCol = 0;
                focusCell(0, 0);
              }, 300);
              return true;
            }
            return false;
          };
          
          if (!tryProcess()) {
            let attempts = 0;
            const iv = setInterval(function() {
              attempts++;
              if (tryProcess() || attempts > 20) clearInterval(iv);
            }, 300);
          }
        }, 500);
      }
    }
  }, 200);

  // Pagination clicks
  document.addEventListener('click', function(e) {
    const target = e.target;
    const isNext = target.closest && (
      target.closest('.SavingAccountContainer---next_arrow---jbdUO') ||
      target.closest('[class*="next_arrow"]')
    );
    const isBack = target.closest && (
      target.closest('.SavingAccountContainer---back_arrow---FqLBL') ||
      target.closest('[class*="back_arrow"]') ||
      target.closest('[class*="prev_arrow"]')
    );
    
    if (isNext || isBack) {
      resetAndProcess();
    }
  });

  // Fetch detection
  const origFetch = window.fetch;
  window.fetch = function() {
    const url = arguments[0];
    const isTrans = typeof url === 'string' && url.indexOf('TransHistory') !== -1;
    const promise = origFetch.apply(window, arguments);
    if (isTrans) {
      promise.then(function() {
        setTimeout(resetAndProcess, 1000);
      });
    }
    return promise;
  };

  // KEYBOARD NAVIGATION
  document.addEventListener('keydown', function(e) {
    const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
    if (rows.length === 0) return;

    // CMD/Ctrl + , or . for pagination
    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.key === '.')) {
      e.preventDefault();
      clearHighlight();
      kbRow = -1;
      kbCol = 0;
      
      if (e.key === ',') {
        const prev = document.querySelector('.SavingAccountContainer---back_arrow---FqLBL, [class*="back_arrow"]');
        if (prev) prev.click();
      } else {
        const next = document.querySelector('.SavingAccountContainer---next_arrow---jbdUO, [class*="next_arrow"]');
        if (next) next.click();
      }
      return;
    }

    const active = document.activeElement;
    const isSelect = active && active.tagName === 'SELECT';
    const isInput = active && active.tagName === 'INPUT';
    const isInMbt = active && active.closest && active.closest('.mbt-cell');

    // If not in any cell, any arrow key starts navigation
    if (!isInMbt && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) {
      e.preventDefault();
      const table = document.querySelector('table[class*="AccountTable"]');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      kbRow = 0;
      kbCol = 0;
      focusCell(0, 0);
      return;
    }

    if (!isInMbt) return;

    // ENTER handling
    if (e.key === 'Enter') {
      const row = active.closest('tr[data-mbt-id]');
      if (!row) return;

      if (isSelect) {
        // In category dropdown - save and move to notes
        e.preventDefault();
        saveRow(row);
        // Find current row index
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] === row) kbRow = i;
        }
        kbCol = 1;
        focusCell(kbRow, kbCol);
      } else if (isInput) {
        // In notes - save and move to next row category
        e.preventDefault();
        saveRow(row);
        kbRow = Math.min(kbRow + 1, rows.length - 1);
        kbCol = 0;
        focusCell(kbRow, kbCol);
      }
      return;
    }

    // ARROW KEYS - prevent default on select to stop dropdown from opening
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) {
      // Always prevent default on arrows within our cells
      e.preventDefault();

      // Update position from current active element
      const row = active.closest('tr[data-mbt-id]');
      if (row) {
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] === row) kbRow = i;
        }
      }
      const cell = active.closest('.mbt-cell');
      if (cell) {
        const rowCells = row.querySelectorAll('.mbt-cell');
        for (let i = 0; i < rowCells.length; i++) {
          if (rowCells[i] === cell) kbCol = i < 2 ? i : kbCol;
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          kbRow = Math.min(kbRow + 1, rows.length - 1);
          break;
        case 'ArrowUp':
          kbRow = Math.max(kbRow - 1, 0);
          break;
        case 'ArrowRight':
          kbCol = Math.min(kbCol + 1, 1);
          break;
        case 'ArrowLeft':
          kbCol = Math.max(kbCol - 1, 0);
          break;
      }

      focusCell(kbRow, kbCol);
    }
  }, true); // Use capture phase

  // Focus tracking
  document.addEventListener('focusin', function(e) {
    const target = e.target;
    if (target.tagName === 'SELECT' || target.tagName === 'INPUT') {
      const row = target.closest && target.closest('tr[data-mbt-id]');
      if (row) {
        const rows = document.querySelectorAll('tbody tr[data-mbt-id]');
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] === row) {
            kbRow = i;
            break;
          }
        }
        const cell = target.closest('.mbt-cell');
        if (cell) {
          const rowCells = row.querySelectorAll('.mbt-cell');
          for (let i = 0; i < rowCells.length; i++) {
            if (rowCells[i] === cell) {
              kbCol = i < 2 ? i : kbCol;
              break;
            }
          }
        }
        highlightRowAndCell(kbRow, kbCol);
      }
    }
  });

  // HELP PANEL
  function createHelpPanel() {
    if (document.getElementById('mbt-help-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'mbt-help-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.85);color:white;padding:15px 20px;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.6;z-index:10000;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    
    panel.innerHTML = '<div style="font-weight:bold;margin-bottom:10px;color:#ffc83d;font-size:14px;">⌨️ Keyboard Shortcuts</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">↑ ↓ ← →</span> Navigate cells</div>' +
      '<div style="margin-bottom:6px;"><span style="color:#90caf9;">Enter</span> Save & advance</div>' +
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

  // Wait for body then create help panel
  function initHelpPanel() {
    if (document.body && localStorage.getItem('mbt_help_closed') !== 'true') {
      createHelpPanel();
    } else {
      setTimeout(initHelpPanel, 500);
    }
  }
  setTimeout(initHelpPanel, 3000);

  // Expose
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
            const data = JSON.parse(localStorage.getItem(key));
            saved.push({ id: key.replace('mbt_', ''), category: data.category, notes: data.notes });
          } catch (e) {}
        }
      }
      console.log('[MBT] Saved:', saved);
      return saved;
    }
  };

})();
