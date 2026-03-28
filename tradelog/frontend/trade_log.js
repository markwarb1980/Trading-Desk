// Trade Log module
let allTrades = [];
let sortCol = 'entry_time';
let sortDir = 'desc';
let editingTradeId = null;

async function loadTrades() {
  const container = document.getElementById('section-trades');
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="filter-bar" id="tradeFilters">
        <input type="text" id="filterSymbol" placeholder="Symbol..." style="width:120px;" />
        <select id="filterDir">
          <option value="">All Directions</option>
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>
        <input type="date" id="filterFrom" placeholder="From" />
        <input type="date" id="filterTo" placeholder="To" />
        <select id="filterStatus">
          <option value="">All Status</option>
          <option value="closed">Closed</option>
          <option value="open">Open</option>
        </select>
        <button class="btn btn-primary btn-sm" id="applyFilters">Apply</button>
        <button class="btn btn-secondary btn-sm" id="clearFilters">Clear</button>
        <button class="btn btn-primary btn-sm" style="margin-left:auto;" id="addTradeBtn">+ Add Trade</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Trade Log</div>
      <div class="table-wrap" id="tradesTableWrap">
        <div class="loading">Loading trades...</div>
      </div>
      <div class="table-footer" id="tradeFooter"></div>
    </div>
  `;

  document.getElementById('applyFilters').addEventListener('click', fetchAndRenderTrades);
  document.getElementById('clearFilters').addEventListener('click', clearTradeFilters);
  document.getElementById('addTradeBtn').addEventListener('click', () => openTradeModal(null));

  // Allow pressing Enter on filter inputs
  ['filterSymbol', 'filterFrom', 'filterTo'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') fetchAndRenderTrades(); });
  });

  await fetchAndRenderTrades();
}

async function fetchAndRenderTrades() {
  const symbol = document.getElementById('filterSymbol')?.value || '';
  const direction = document.getElementById('filterDir')?.value || '';
  const from = document.getElementById('filterFrom')?.value || '';
  const to = document.getElementById('filterTo')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';

  let url = '/api/trades?limit=500';
  if (symbol) url += `&symbol=${encodeURIComponent(symbol)}`;
  if (direction) url += `&direction=${direction}`;
  if (from) url += `&date_from=${from}T00:00:00`;
  if (to) url += `&date_to=${to}T23:59:59`;
  if (status) url += `&status=${status}`;

  const wrap = document.getElementById('tradesTableWrap');
  if (wrap) wrap.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await fetch(url).then(r => r.json());
    allTrades = Array.isArray(data) ? data : [];
    renderTradesTable();
  } catch (e) {
    if (wrap) wrap.innerHTML = `<div class="empty-state"><p>Failed to load trades: ${e.message}</p></div>`;
  }
}

function clearTradeFilters() {
  ['filterSymbol', 'filterFrom', 'filterTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['filterDir', 'filterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  fetchAndRenderTrades();
}

function renderTradesTable() {
  const wrap = document.getElementById('tradesTableWrap');
  const footer = document.getElementById('tradeFooter');
  if (!wrap) return;

  if (allTrades.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No trades found. Import a CSV or add trades manually.</p></div>';
    if (footer) footer.innerHTML = '';
    return;
  }

  // Sort
  const sorted = [...allTrades].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (av === null || av === undefined) av = '';
    if (bv === null || bv === undefined) bv = '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const cols = [
    { key: 'id', label: '#' },
    { key: 'entry_time', label: 'Date' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'direction', label: 'Dir' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'exit_price', label: 'Exit' },
    { key: 'size', label: 'Size' },
    { key: 'pnl', label: 'P&L' },
    { key: 'net_pnl', label: 'Net P&L' },
    { key: 'r_multiple', label: 'R' },
    { key: 'tags', label: 'Tags' },
    { key: 'notes', label: 'Notes' },
  ];

  const headerHTML = cols.map(c => {
    const isSorted = sortCol === c.key;
    const cls = isSorted ? `sorted${sortDir === 'asc' ? ' asc' : ''}` : '';
    return `<th class="${cls}" data-col="${c.key}">${c.label}</th>`;
  }).join('');

  const rowsHTML = sorted.map(t => `
    <tr data-id="${t.id}">
      <td class="text">${t.id}</td>
      <td>${fmtDate(t.entry_time)}</td>
      <td class="text" style="font-weight:600;">${t.symbol}</td>
      <td><span class="badge badge-${t.direction.toLowerCase()}">${t.direction}</span></td>
      <td>${t.entry_price?.toFixed(5) ?? '—'}</td>
      <td>${t.exit_price?.toFixed(5) ?? '—'}</td>
      <td>${t.size ?? '—'}</td>
      <td class="${colorClass(t.pnl)}">${fmtMoney(t.pnl)}</td>
      <td class="${colorClass(t.net_pnl)}">${fmtMoney(t.net_pnl)}</td>
      <td class="${colorClass(t.r_multiple)}">${t.r_multiple !== null && t.r_multiple !== undefined ? fmtNum(t.r_multiple) + 'R' : '—'}</td>
      <td>${(t.tags || []).map(tag => `<span class="badge badge-tag" style="${tag.color ? 'background:' + tag.color + '20;border-color:' + tag.color + ';color:' + tag.color : ''}">${tag.name}</span>`).join('')}</td>
      <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis;">${t.notes ? t.notes.substring(0, 40) + (t.notes.length > 40 ? '...' : '') : '—'}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table>
      <thead><tr>${headerHTML}</tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  `;

  // Sort click handlers
  wrap.querySelectorAll('thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      if (sortCol === th.dataset.col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = th.dataset.col;
        sortDir = 'desc';
      }
      renderTradesTable();
    });
  });

  // Row click handlers
  wrap.querySelectorAll('tbody tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openTradeModal(parseInt(row.dataset.id)));
  });

  // Footer stats
  const totalPnl = allTrades.reduce((s, t) => s + (t.net_pnl || 0), 0);
  const wins = allTrades.filter(t => t.net_pnl > 0).length;
  const closed = allTrades.filter(t => t.status === 'closed' && t.net_pnl !== null).length;
  if (footer) {
    footer.innerHTML = `
      <span>${allTrades.length} trades</span>
      <span>Win rate: ${closed > 0 ? Math.round(wins / closed * 100) : 0}%</span>
      <span class="${colorClass(totalPnl)}">Total Net P&L: ${fmtMoney(totalPnl)}</span>
    `;
  }
}

function openTradeModal(tradeId) {
  editingTradeId = tradeId;
  const overlay = document.getElementById('tradeModal');
  const title = document.getElementById('tradeModalTitle');
  const body = document.getElementById('tradeModalBody');
  const deleteBtn = document.getElementById('tradeDeleteBtn');

  const trade = tradeId ? allTrades.find(t => t.id === tradeId) : null;
  title.textContent = trade ? `Edit Trade #${tradeId}` : 'Add Trade';
  deleteBtn.style.display = trade ? 'block' : 'none';

  body.innerHTML = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Symbol *</label>
        <input type="text" class="form-control" id="tf-symbol" value="${trade?.symbol || ''}" placeholder="EURUSD" />
      </div>
      <div class="form-group">
        <label class="form-label">Direction *</label>
        <select class="form-control" id="tf-direction">
          <option value="LONG" ${(!trade || trade.direction === 'LONG') ? 'selected' : ''}>LONG</option>
          <option value="SHORT" ${trade?.direction === 'SHORT' ? 'selected' : ''}>SHORT</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Entry Price *</label>
        <input type="number" step="any" class="form-control" id="tf-entry-price" value="${trade?.entry_price || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Exit Price</label>
        <input type="number" step="any" class="form-control" id="tf-exit-price" value="${trade?.exit_price ?? ''}" />
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Entry Time *</label>
        <input type="datetime-local" class="form-control" id="tf-entry-time" value="${toLocalDT(trade?.entry_time)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Exit Time</label>
        <input type="datetime-local" class="form-control" id="tf-exit-time" value="${toLocalDT(trade?.exit_time)}" />
      </div>
    </div>
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label">Size *</label>
        <input type="number" step="any" class="form-control" id="tf-size" value="${trade?.size || 1}" />
      </div>
      <div class="form-group">
        <label class="form-label">P&L</label>
        <input type="number" step="any" class="form-control" id="tf-pnl" value="${trade?.pnl ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Fees</label>
        <input type="number" step="any" class="form-control" id="tf-fees" value="${trade?.fees ?? 0}" />
      </div>
    </div>
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label">Stop Loss</label>
        <input type="number" step="any" class="form-control" id="tf-sl" value="${trade?.stop_loss ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Take Profit</label>
        <input type="number" step="any" class="form-control" id="tf-tp" value="${trade?.take_profit ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">R-Multiple</label>
        <input type="number" step="any" class="form-control" id="tf-r" value="${trade?.r_multiple ?? ''}" />
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="tf-status">
          <option value="closed" ${(!trade || trade.status === 'closed') ? 'selected' : ''}>Closed</option>
          <option value="open" ${trade?.status === 'open' ? 'selected' : ''}>Open</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Broker ID</label>
        <input type="text" class="form-control" id="tf-broker-id" value="${trade?.broker_id || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="tf-notes" rows="3">${trade?.notes || ''}</textarea>
    </div>
  `;

  overlay.classList.add('open');
}

function toLocalDT(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function getVal(id) { return document.getElementById(id)?.value || null; }
function getNumVal(id) {
  const v = document.getElementById(id)?.value;
  return v !== '' && v !== null && v !== undefined ? parseFloat(v) : null;
}

// Modal close buttons
document.getElementById('tradeModalClose').addEventListener('click', () => {
  document.getElementById('tradeModal').classList.remove('open');
});
document.getElementById('tradeModalCancel').addEventListener('click', () => {
  document.getElementById('tradeModal').classList.remove('open');
});

// Delete button
document.getElementById('tradeDeleteBtn').addEventListener('click', async () => {
  if (!editingTradeId) return;
  if (!confirm(`Delete trade #${editingTradeId}?`)) return;
  try {
    const res = await fetch(`/api/trades/${editingTradeId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      document.getElementById('tradeModal').classList.remove('open');
      await fetchAndRenderTrades();
    } else {
      const d = await res.json();
      alert('Delete failed: ' + (d.detail || res.status));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

// Save button
document.getElementById('tradeModalSave').addEventListener('click', async () => {
  const symbol = getVal('tf-symbol');
  if (!symbol) { alert('Symbol is required'); return; }
  const entryPrice = getNumVal('tf-entry-price');
  if (entryPrice === null) { alert('Entry price is required'); return; }
  const entryTimeVal = getVal('tf-entry-time');
  if (!entryTimeVal) { alert('Entry time is required'); return; }

  const payload = {
    symbol,
    direction: getVal('tf-direction'),
    entry_price: entryPrice,
    exit_price: getNumVal('tf-exit-price'),
    entry_time: new Date(entryTimeVal).toISOString(),
    exit_time: (() => { const v = getVal('tf-exit-time'); return v ? new Date(v).toISOString() : null; })(),
    size: getNumVal('tf-size') || 1,
    pnl: getNumVal('tf-pnl'),
    fees: getNumVal('tf-fees') || 0,
    stop_loss: getNumVal('tf-sl'),
    take_profit: getNumVal('tf-tp'),
    r_multiple: getNumVal('tf-r'),
    status: getVal('tf-status') || 'closed',
    broker_id: getVal('tf-broker-id'),
    notes: getVal('tf-notes'),
    tag_ids: [],
  };

  try {
    let res;
    if (editingTradeId) {
      res = await fetch(`/api/trades/${editingTradeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      document.getElementById('tradeModal').classList.remove('open');
      await fetchAndRenderTrades();
    } else {
      const d = await res.json();
      alert('Save failed: ' + (d.detail || JSON.stringify(d)));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
});
