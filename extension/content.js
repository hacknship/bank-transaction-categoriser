// Maybank Budget Tracker - Content Script (Fixed Loading)
(function() {
  'use strict';

  if (!window.location.href.includes('maybank2u.com.my')) return;
  console.log('[MBT] Extension loaded');

  const CATEGORIES = ['Food', 'Transport', 'Dining', 'Shopping', 'Medical', 'Entertainment', 'Utilities', 'Groceries', 'Others'];
  let processedRows = new Set();
  let rowIndexCounter = 0;
  let isLoading = false;

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
      console.log('[MBT] SAVED:', txId, data.category || '(no category)', data.notes || '(no notes)');
    } catch (e) {
      console.error('[MBT] Save failed:', e);
    }
  }

  function loadTx(txId) {
    try {
      const item = localStorage.getItem('mbt_' + txId);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }

  // Show skeleton loading in each row
  function showSkeletonLoading() {
    const tbody = document.querySelector('table[class*="AccountTable"] tbody');
    if (!tbody) return;
    
    isLoading = true;
    const rows = tbody.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) continue;
      
      // Remove any existing mbt cells first
      const oldMbt = row.querySelectorAll('.mbt-cell');
      for (let j = 0; j < oldMbt.length; j++) oldMbt[j].remove();
      
      // Add skeleton cells
      const skeletonStyle = 'background:linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);background-size:200% 100%;animation:mbt-skeleton 1.5s infinite;';
      
      // Category skeleton
      const catCell = document.createElement('td');
      catCell.className = 'mbt-cell mbt-skeleton';
      catCell.style.cssText = 'padding:8px;';
      const catDiv = document.createElement('div');
      catDiv.style.cssText = skeletonStyle + 'height:32px;border-radius:4px;width:100%;';
      catCell.appendChild(catDiv);
      
      // Notes skeleton
      const noteCell = document.createElement('td');
      noteCell.className = 'mbt-cell mbt-skeleton';
      noteCell.style.cssText = 'padding:8px;';
      const noteDiv = document.createElement('div');
      noteDiv.style.cssText = skeletonStyle + 'height:32px;border-radius:4px;width:100%;';
      noteCell.appendChild(noteDiv);
      
      // Status skeleton
      const statusCell = document.createElement('td');
      statusCell.className = 'mbt-cell mbt-skeleton';
      statusCell.style.cssText = 'padding:8px;text-align:center;';
      const statusDiv = document.createElement('div');
      statusDiv.style.cssText = skeletonStyle + 'height:32px;border-radius:4px;width:32px;margin:0 auto;';
      statusCell.appendChild(statusDiv);
      
      row.appendChild(catCell);
      row.appendChild(noteCell);
      row.appendChild(statusCell);
    }
    
    // Add keyframe animation if not exists
    if (!document.getElementById('mbt-skeleton-style')) {
      const style = document.createElement('style');
      style.id = 'mbt-skeleton-style';
      style.textContent = '@keyframes mbt-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
      document.head.appendChild(style);
    }
  }

  function removeSkeletonLoading() {
    const skeletons = document.querySelectorAll('.mbt-skeleton');
    for (let i = 0; i < skeletons.length; i++) skeletons[i].remove();
    isLoading = false;
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

    // Create unique ID
    const rawContent = dateTxt + '|' + descTxt + '|' + amtTxt + '|' + (isNeg ? 'neg' : 'pos') + '|idx' + rowIndex;
    const txId = simpleHash(rawContent);

    if (processedRows.has(txId)) return;
    processedRows.add(txId);

    row.setAttribute('data-mbt-id', txId);

    // Remove old cells if any (including skeletons)
    const oldCells = row.querySelectorAll('.mbt-cell');
    for (let i = 0; i < oldCells.length; i++) oldCells[i].remove();

    const saved = loadTx(txId);

    // Category cell
    const catCell = document.createElement('td');
    catCell.className = 'mbt-cell';
    catCell.style.cssText = 'padding:8px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;background:white;';
    sel.innerHTML = '<option value="">-- Select --</option>' + 
      CATEGORIES.map(function(c) { 
        return '<option value="' + c + '"' + (c === (saved && saved.category) ? ' selected' : '') + '>' + c + '</option>'; 
      }).join('');
    catCell.appendChild(sel);

    // Notes cell
    const noteCell = document.createElement('td');
    noteCell.className = 'mbt-cell';
    noteCell.style.cssText = 'padding:8px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.style.cssText = 'width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;';
    inp.placeholder = 'Notes...';
    inp.value = (saved && saved.notes) || '';
    noteCell.appendChild(inp);

    // Status cell
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
      saveTx(txId, {
        txId: txId, date: date, description: descTxt, amount: amount,
        category: sel.value, notes: inp.value,
        savedAt: new Date().toISOString()
      });
      if (sel.value) statusCell.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
    });

    inp.addEventListener('blur', function() {
      saveTx(txId, {
        txId: txId, date: date, description: descTxt, amount: amount,
        category: sel.value, notes: inp.value,
        savedAt: new Date().toISOString()
      });
    });

    console.log('[MBT] Processed:', txId, date, descTxt.slice(0, 20), 'RM' + amount);
  }

  function process() {
    console.log('[MBT] === PROCESSING ===');
    
    const table = document.querySelector('table[class*="AccountTable"]');
    if (!table) {
      console.log('[MBT] Table not found');
      return;
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
      console.log('[MBT] Tbody not found');
      return;
    }

    // Add headers if not present
    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.mbt-header')) {
      const headers = ['CATEGORY', 'NOTES', '✓'];
      for (let i = 0; i < headers.length; i++) {
        const th = document.createElement('th');
        th.className = 'mbt-header';
        th.textContent = headers[i];
        th.style.cssText = 'background:#373737;color:white;padding:12px 8px;text-align:left;font-size:12px;text-transform:uppercase;';
        if (i === 2) th.style.width = '40px';
        thead.appendChild(th);
      }
    }

    const rows = tbody.querySelectorAll('tr');
    console.log('[MBT] Found', rows.length, 'rows');

    rowIndexCounter = 0;
    
    for (let i = 0; i < rows.length; i++) {
      processRow(rows[i], i);
    }

    console.log('[MBT] === DONE ===');
  }

  function resetAndProcess() {
    processedRows.clear();
    rowIndexCounter = 0;
    
    // Remove all our injected elements
    const mbtCells = document.querySelectorAll('.mbt-cell');
    for (let i = 0; i < mbtCells.length; i++) mbtCells[i].remove();
    
    const mbtHeaders = document.querySelectorAll('.mbt-header');
    for (let i = 0; i < mbtHeaders.length; i++) mbtHeaders[i].remove();
    
    const rowsWithId = document.querySelectorAll('tr[data-mbt-id]');
    for (let i = 0; i < rowsWithId.length; i++) {
      rowsWithId[i].removeAttribute('data-mbt-id');
    }
    
    // Show skeleton loading
    showSkeletonLoading();
    
    // Process after delay
    setTimeout(function() {
      removeSkeletonLoading();
      process();
    }, 1000);
  }

  function waitForTableAndProcess() {
    const table = document.querySelector('table[class*="AccountTable"]');
    if (table && table.querySelector('tbody tr')) {
      console.log('[MBT] Table found');
      process();
      return true;
    } else {
      console.log('[MBT] Waiting for table...');
      return false;
    }
  }

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      waitForTableAndProcess();
    });
  } else {
    waitForTableAndProcess();
  }

  // Fallback
  setTimeout(function() {
    if (processedRows.size === 0) {
      console.log('[MBT] Fallback process');
      process();
    }
  }, 2000);

  // DETECT SPA NAVIGATION - Watch for URL changes
  let lastUrl = location.href;
  let urlCheckInterval = setInterval(function() {
    const currentUrl = location.href;
    
    // Check if URL changed
    if (currentUrl !== lastUrl) {
      console.log('[MBT] URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      // If we're on account details page, reset and process
      if (currentUrl.includes('accountDetails')) {
        console.log('[MBT] Navigated to account details, will process');
        // Clear previous state
        processedRows.clear();
        rowIndexCounter = 0;
        
        // Wait a bit for the table to render, then process
        setTimeout(function() {
          // Clean up any old elements
          const oldMbtCells = document.querySelectorAll('.mbt-cell, .mbt-header');
          for (let i = 0; i < oldMbtCells.length; i++) oldMbtCells[i].remove();
          const oldRows = document.querySelectorAll('tr[data-mbt-id]');
          for (let i = 0; i < oldRows.length; i++) oldRows[i].removeAttribute('data-mbt-id');
          
          // Try to find and process table
          if (!waitForTableAndProcess()) {
            // If not found immediately, keep trying
            let attempts = 0;
            const retryInterval = setInterval(function() {
              attempts++;
              if (waitForTableAndProcess() || attempts > 20) {
                clearInterval(retryInterval);
              }
            }, 300);
          }
        }, 500);
      }
    }
  }, 200);

  // Detect pagination clicks
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
      console.log('[MBT] Pagination clicked:', isNext ? 'NEXT' : 'BACK');
      // Clear and show skeleton immediately
      processedRows.clear();
      showSkeletonLoading();
      
      // Reprocess after delay
      setTimeout(function() {
        removeSkeletonLoading();
        
        // Remove old elements
        const mbtHeaders = document.querySelectorAll('.mbt-header');
        for (let i = 0; i < mbtHeaders.length; i++) mbtHeaders[i].remove();
        const rowsWithId = document.querySelectorAll('tr[data-mbt-id]');
        for (let i = 0; i < rowsWithId.length; i++) rowsWithId[i].removeAttribute('data-mbt-id');
        
        process();
      }, 1500);
    }
  });

  // Detect fetch completion
  const origFetch = window.fetch;
  window.fetch = function() {
    const url = arguments[0];
    const isTrans = typeof url === 'string' && url.indexOf('TransHistory') !== -1;
    
    const promise = origFetch.apply(window, arguments);
    
    if (isTrans) {
      promise.then(function() {
        console.log('[MBT] Fetch complete, will reprocess');
        setTimeout(resetAndProcess, 1000);
      });
    }
    
    return promise;
  };

  // KEYBOARD NAVIGATION - Version 2
  console.log('[MBT] Setting up keyboard navigation...');
  
  let kbCurrentRow = 0;
  let kbCurrentCol = 0; // 0 = Category, 1 = Notes

  function getMbtRows() {
    return document.querySelectorAll('tbody tr[data-mbt-id]');
  }

  function focusCell(rowIdx, colIdx) {
    console.log('[KB] focusCell called - row:', rowIdx, 'col:', colIdx);
    const rows = getMbtRows();
    console.log('[KB] Total rows found:', rows.length);
    
    if (rowIdx < 0 || rowIdx >= rows.length) {
      console.log('[KB] Row index out of bounds');
      return false;
    }
    
    const row = rows[rowIdx];
    const cells = row.querySelectorAll('.mbt-cell');
    console.log('[KB] Cells in row:', cells.length);
    
    let target = null;
    if (colIdx === 0 && cells[0]) {
      target = cells[0].querySelector('select');
    } else if (colIdx === 1 && cells[1]) {
      target = cells[1].querySelector('input');
    }
    
    if (target) {
      console.log('[KB] Focusing element:', target.tagName);
      target.focus();
      if (target.select) target.select();
      kbCurrentRow = rowIdx;
      kbCurrentCol = colIdx;
      return true;
    }
    console.log('[KB] No target element found');
    return false;
  }

  function saveCurrentRow(row) {
    console.log('[KB] saveCurrentRow called');
    const txId = row.getAttribute('data-mbt-id');
    const select = row.querySelector('select');
    const input = row.querySelector('input[type="text"]');
    
    if (!txId || !select || !input) {
      console.log('[KB] Missing elements for save');
      return;
    }
    
    const cells = row.querySelectorAll('td');
    const dateCell = cells[0];
    const descCell = cells[1];
    const amtCell = cells[3];
    
    if (!dateCell || !descCell || !amtCell) {
      console.log('[KB] Missing table cells');
      return;
    }
    
    const dateTxt = dateCell.textContent ? dateCell.textContent.trim() : '';
    const descTxt = descCell.textContent ? descCell.textContent.trim() : '';
    const amtTxt = amtCell.textContent ? amtCell.textContent.trim() : '';
    const date = parseDate(dateTxt);
    const amount = parseAmount(amtTxt);
    
    if (date) {
      saveTx(txId, {
        txId: txId, date: date, description: descTxt, amount: amount,
        category: select.value, notes: input.value,
        savedAt: new Date().toISOString()
      });
      
      // Show checkmark
      const cells = row.querySelectorAll('.mbt-cell');
      const statusCell = cells[2];
      if (statusCell && select.value) {
        statusCell.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
      }
    }
  }

  document.addEventListener('keydown', function(e) {
    console.log('[KB] Key pressed:', e.key, 'Shift:', e.shiftKey, 'Meta:', e.metaKey, 'Ctrl:', e.ctrlKey);
    
    // PAGINATION SHORTCUTS: Cmd/Ctrl + , (prev) or . (next)
    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.key === '.')) {
      e.preventDefault();
      console.log('[KB] Pagination shortcut detected');
      
      if (e.key === ',') {
        // Previous page
        const prevBtn = document.querySelector('.SavingAccountContainer---back_arrow---FqLBL, [class*="back_arrow"], [class*="prev_arrow"]');
        if (prevBtn) {
          console.log('[KB] Clicking previous button');
          prevBtn.click();
        } else {
          console.log('[KB] Previous button not found');
        }
      } else {
        // Next page
        const nextBtn = document.querySelector('.SavingAccountContainer---next_arrow---jbdUO, [class*="next_arrow"]');
        if (nextBtn) {
          console.log('[KB] Clicking next button');
          nextBtn.click();
        } else {
          console.log('[KB] Next button not found');
        }
      }
      return;
    }
    
    const rows = getMbtRows();
    console.log('[KB] Total rows:', rows.length);
    if (rows.length === 0) return;

    const active = document.activeElement;
    console.log('[KB] Active element:', active ? active.tagName : 'none');
    
    const isSelect = active && active.tagName === 'SELECT';
    const isInput = active && active.tagName === 'INPUT';
    const isInMbt = active && active.closest && active.closest('.mbt-cell');
    
    // SHIFT + UP/DOWN: Navigate between rows
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      console.log('[KB] Shift+Arrow detected');
      
      // Update current position from focused element
      if (isInMbt) {
        const row = active.closest('tr[data-mbt-id]');
        if (row) {
          for (let i = 0; i < rows.length; i++) {
            if (rows[i] === row) kbCurrentRow = i;
          }
        }
        const cell = active.closest('.mbt-cell');
        if (cell) {
          const rowCells = row.querySelectorAll('.mbt-cell');
          for (let i = 0; i < rowCells.length; i++) {
            if (rowCells[i] === cell) kbCurrentCol = (i === 0) ? 0 : 1;
          }
        }
      }
      
      if (e.key === 'ArrowDown') {
        kbCurrentRow = Math.min(kbCurrentRow + 1, rows.length - 1);
      } else {
        kbCurrentRow = Math.max(kbCurrentRow - 1, 0);
      }
      
      focusCell(kbCurrentRow, kbCurrentCol);
      return;
    }
    
    // ENTER: Save and move to next field
    if (e.key === 'Enter' && (isSelect || isInput)) {
      console.log('[KB] Enter pressed on', isSelect ? 'SELECT' : 'INPUT');
      
      const row = active.closest('tr[data-mbt-id]');
      if (!row) {
        console.log('[KB] No parent row found');
        return;
      }
      
      // Update position
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] === row) kbCurrentRow = i;
      }
      kbCurrentCol = isSelect ? 0 : 1;
      
      // Save current row
      saveCurrentRow(row);
      
      if (isSelect) {
        // In Category → move to Notes (same row)
        console.log('[KB] Moving to Notes (same row)');
        e.preventDefault();
        kbCurrentCol = 1;
        focusCell(kbCurrentRow, kbCurrentCol);
      } else {
        // In Notes → move to Category (next row)
        console.log('[KB] Moving to Category (next row)');
        e.preventDefault();
        kbCurrentRow = Math.min(kbCurrentRow + 1, rows.length - 1);
        kbCurrentCol = 0;
        focusCell(kbCurrentRow, kbCurrentCol);
      }
      return;
    }
    
    // REGULAR ARROWS (without Shift): Only when NOT in dropdown
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Only handle if in mbt cell
        if (!isInMbt) return;
        
        e.preventDefault();
        console.log('[KB] Arrow Left/Right');
        
        if (e.key === 'ArrowRight') {
          kbCurrentCol = Math.min(kbCurrentCol + 1, 1);
        } else {
          kbCurrentCol = Math.max(kbCurrentCol - 1, 0);
        }
        
        focusCell(kbCurrentRow, kbCurrentCol);
      }
    }
  });

  console.log('[MBT] Keyboard navigation setup complete');

  window.MBT = {
    reprocess: resetAndProcess,
    process: process,
    listSaved: function() {
      const saved = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mbt_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            saved.push({
              id: key.replace('mbt_', ''),
              date: data.date,
              description: data.description,
              amount: data.amount,
              category: data.category,
              notes: data.notes
            });
          } catch (e) {}
        }
      }
      console.log('[MBT] All saved transactions:', saved);
      return saved;
    }
  };

})();
