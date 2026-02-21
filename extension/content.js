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
                // Reset to first row after successful load
                setTimeout(function() {
                  kbCurrentRow = 0;
                  kbCurrentCol = 0;
                  focusCell(0, 0, false);
                }, 300);
              }
            }, 300);
          } else {
            // Reset to first row immediately if table found
            setTimeout(function() {
              kbCurrentRow = 0;
              kbCurrentCol = 0;
              focusCell(0, 0, false);
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
      
      // Clear highlight and reset position
      clearHighlight();
      kbCurrentRow = -1;
      kbCurrentCol = 0;
      
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
        
        // Reset to first row after processing
        setTimeout(function() {
          kbCurrentRow = 0;
          kbCurrentCol = 0;
          focusCell(0, 0, false);
        }, 200);
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

  // KEYBOARD NAVIGATION - Version 3 (Enhanced)
  console.log('[MBT] Setting up enhanced keyboard navigation...');
  
  let kbCurrentRow = -1;
  let kbCurrentCol = 0;
  let isDropdownOpen = false;
  
  // Add highlight styles
  const highlightStyle = document.createElement('style');
  highlightStyle.textContent = `
    .mbt-row-active { background-color: #e3f2fd !important; }
    .mbt-cell-active { outline: 2px solid #2196f3 !important; outline-offset: -2px; }
  `;
  document.head.appendChild(highlightStyle);
  
  function getMbtRows() {
    return document.querySelectorAll('tbody tr[data-mbt-id]');
  }
  
  function clearHighlight() {
    document.querySelectorAll('.mbt-row-active').forEach(el => el.classList.remove('mbt-row-active'));
    document.querySelectorAll('.mbt-cell-active').forEach(el => el.classList.remove('mbt-cell-active'));
  }
  
  function highlightRow(rowIdx) {
    clearHighlight();
    const rows = getMbtRows();
    if (rowIdx >= 0 && rowIdx < rows.length) {
      rows[rowIdx].classList.add('mbt-row-active');
      // Scroll into view
      rows[rowIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  function highlightCell(rowIdx, colIdx) {
    highlightRow(rowIdx);
    const rows = getMbtRows();
    if (rowIdx >= 0 && rowIdx < rows.length) {
      const cells = rows[rowIdx].querySelectorAll('.mbt-cell');
      if (cells[colIdx]) cells[colIdx].classList.add('mbt-cell-active');
    }
  }

  function focusCell(rowIdx, colIdx, openDropdown) {
    console.log('[KB] focusCell - row:', rowIdx, 'col:', colIdx, 'openDropdown:', openDropdown);
    const rows = getMbtRows();
    if (rowIdx < 0 || rowIdx >= rows.length) return false;
    
    kbCurrentRow = rowIdx;
    kbCurrentCol = colIdx;
    
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
      highlightCell(rowIdx, colIdx);
      
      // Open dropdown if requested
      if (openDropdown && colIdx === 0 && target.tagName === 'SELECT') {
        target.click();
        isDropdownOpen = true;
      }
      
      return true;
    }
    return false;
  }

  function saveCurrentRow(row) {
    console.log('[KB] saveCurrentRow');
    const txId = row.getAttribute('data-mbt-id');
    const select = row.querySelector('select');
    const input = row.querySelector('input[type="text"]');
    
    if (!txId || !select || !input) return;
    
    const cells = row.querySelectorAll('td');
    const dateCell = cells[0];
    const descCell = cells[1];
    const amtCell = cells[3];
    
    if (!dateCell || !descCell || !amtCell) return;
    
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
      
      const mbtCells = row.querySelectorAll('.mbt-cell');
      const statusCell = mbtCells[2];
      if (statusCell && select.value) {
        statusCell.innerHTML = '<span style="color:#28a745;font-weight:bold;">✓</span>';
      }
    }
  }
  
  // Reset to first row (call when page changes)
  window.MBT.resetToFirstRow = function() {
    kbCurrentRow = 0;
    kbCurrentCol = 0;
    const rows = getMbtRows();
    if (rows.length > 0) {
      // Scroll to table first
      const table = document.querySelector('table[class*="AccountTable"]');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Then focus first cell
      setTimeout(() => focusCell(0, 0, false), 300);
    }
  };

  document.addEventListener('keydown', function(e) {
    console.log('[KB] Key:', e.key, 'Shift:', e.shiftKey, 'Meta:', e.metaKey);
    
    // PAGINATION: Cmd/Ctrl + , or .
    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.key === '.')) {
      e.preventDefault();
      clearHighlight();
      if (e.key === ',') {
        const prevBtn = document.querySelector('.SavingAccountContainer---back_arrow---FqLBL, [class*="back_arrow"]');
        if (prevBtn) prevBtn.click();
      } else {
        const nextBtn = document.querySelector('.SavingAccountContainer---next_arrow---jbdUO, [class*="next_arrow"]');
        if (nextBtn) nextBtn.click();
      }
      return;
    }
    
    const rows = getMbtRows();
    if (rows.length === 0) return;
    
    const active = document.activeElement;
    const isSelect = active && active.tagName === 'SELECT';
    const isInput = active && active.tagName === 'INPUT';
    const isInMbt = active && active.closest && active.closest('.mbt-cell');
    
    // If dropdown is open, Enter selects option
    if (isDropdownOpen && isSelect && e.key === 'Enter') {
      e.preventDefault();
      isDropdownOpen = false;
      const row = active.closest('tr[data-mbt-id]');
      if (row) saveCurrentRow(row);
      // Move to Notes (same row)
      kbCurrentCol = 1;
      focusCell(kbCurrentRow, kbCurrentCol, false);
      return;
    }
    
    // If no cell is active and arrow pressed, start at first row
    if (!isInMbt && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      console.log('[KB] Starting navigation from first row');
      // Scroll to table
      const table = document.querySelector('table[class*="AccountTable"]');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      kbCurrentRow = 0;
      kbCurrentCol = 0;
      focusCell(0, 0, false);
      return;
    }
    
    // ENTER on Category: Open dropdown
    if (e.key === 'Enter' && isSelect && !isDropdownOpen) {
      e.preventDefault();
      console.log('[KB] Opening dropdown');
      isDropdownOpen = true;
      active.click();
      return;
    }
    
    // ENTER on Notes: Save and move to next row Category
    if (e.key === 'Enter' && isInput) {
      e.preventDefault();
      console.log('[KB] Enter on Notes - save and next row');
      const row = active.closest('tr[data-mbt-id]');
      if (row) saveCurrentRow(row);
      kbCurrentRow = Math.min(kbCurrentRow + 1, rows.length - 1);
      kbCurrentCol = 0;
      focusCell(kbCurrentRow, kbCurrentCol, false);
      return;
    }
    
    // ARROW NAVIGATION (when not in dropdown)
    if (!isDropdownOpen && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      console.log('[KB] Arrow navigation:', e.key);
      
      // Update position from active element
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
            if (rowCells[i] === cell) kbCurrentCol = i < 2 ? i : kbCurrentCol;
          }
        }
      }
      
      switch (e.key) {
        case 'ArrowDown':
          kbCurrentRow = Math.min(kbCurrentRow + 1, rows.length - 1);
          break;
        case 'ArrowUp':
          kbCurrentRow = Math.max(kbCurrentRow - 1, 0);
          break;
        case 'ArrowRight':
          kbCurrentCol = Math.min(kbCurrentCol + 1, 1);
          break;
        case 'ArrowLeft':
          kbCurrentCol = Math.max(kbCurrentCol - 1, 0);
          break;
      }
      
      focusCell(kbCurrentRow, kbCurrentCol, false);
      return;
    }
  });
  
  // Track dropdown state
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'SELECT') {
      isDropdownOpen = true;
    } else {
      isDropdownOpen = false;
    }
  });
  
  // Track focus
  document.addEventListener('focusin', function(e) {
    const target = e.target;
    if (target.tagName === 'SELECT' || target.tagName === 'INPUT') {
      const row = target.closest && target.closest('tr[data-mbt-id]');
      if (row) {
        const rows = getMbtRows();
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] === row) {
            kbCurrentRow = i;
            break;
          }
        }
        const cell = target.closest('.mbt-cell');
        if (cell) {
          const rowCells = row.querySelectorAll('.mbt-cell');
          for (let i = 0; i < rowCells.length; i++) {
            if (rowCells[i] === cell) {
              kbCurrentCol = i < 2 ? i : kbCurrentCol;
              break;
            }
          }
        }
        highlightCell(kbCurrentRow, kbCurrentCol);
      }
    }
  });

  console.log('[MBT] Keyboard navigation setup complete');
  
  // HELP PANEL
  function createHelpPanel() {
    const panel = document.createElement('div');
    panel.id = 'mbt-help-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      z-index: 10000;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #ffc83d; font-size: 14px;">
        ⌨️ Keyboard Shortcuts
      </div>
      <div style="margin-bottom: 6px;"><span style="color: #90caf9;">↑ ↓ ← →</span> Navigate fields</div>
      <div style="margin-bottom: 6px;"><span style="color: #90caf9;">Enter</span> Open dropdown / Select & next</div>
      <div style="margin-bottom: 6px;"><span style="color: #90caf9;">⌘,</span> Previous page</div>
      <div style="margin-bottom: 6px;"><span style="color: #90caf9;">⌘.</span> Next page</div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
        Press any arrow key to start
      </div>
    `;
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #aaa;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 24px;
    `;
    closeBtn.onclick = function() {
      panel.style.display = 'none';
      localStorage.setItem('mbt_help_closed', 'true');
    };
    panel.appendChild(closeBtn);
    
    // Don't show if user closed it before
    if (localStorage.getItem('mbt_help_closed') !== 'true') {
      document.body.appendChild(panel);
    }
  }
  
  // Create help panel after a delay
  setTimeout(createHelpPanel, 3000);

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
