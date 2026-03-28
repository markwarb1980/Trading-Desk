// Trade View module — TradeZella-style
'use strict';

var _allTrades = [];
var _tlSortCol = 'entry_time';
var _tlSortDir = 'desc';
var _tlEditId  = null;
var _tlDir     = '';  // '' | 'LONG' | 'SHORT'
var _tlMetricCharts = {};

window.loadTrades = async function loadTrades() {
  var container = document.getElementById('section-trades');
  container.innerHTML = _buildTradesHTML();

  // Direction toggle
  container.querySelectorAll('.dir-toggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.dir-toggle button').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      _tlDir = btn.dataset.dir;
    });
  });

  // Filter apply / clear
  document.getElementById('tlApply').addEventListener('click', _fetchAndRender);
  document.getElementById('tlClear').addEventListener('click', function() {
    document.getElementById('tlSymbol').value = '';
    document.getElementById('tlFrom').value   = '';
    document.getElementById('tlTo').value     = '';
    _tlDir = '';
    container.querySelectorAll('.dir-toggle button').forEach(function(b){ b.classList.remove('active'); });
    container.querySelector('.dir-toggle button[data-dir=""]').classList.add('active');
    _fetchAndRender();
  });

  // Enter key on inputs
  ['tlSymbol', 'tlFrom', 'tlTo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e){ if (e.key === 'Enter') _fetchAndRender(); });
  });

  // Add trade button
  document.getElementById('tlAddBtn').addEventListener('click', function() { _openTradeModal(null); });

  await _fetchAndRender();
};

function _buildTradesHTML() {
  return [
    // Filter bar
    '<div class="card" style="margin-bottom:12px;">',
      '<div class="filter-bar">',
        '<input type="text" id="tlSymbol" placeholder="Symbol..." style="width:110px;" />',
        '<div class="dir-toggle">',
          '<button class="active" data-dir="">ALL</button>',
          '<button data-dir="LONG">LONG</button>',
          '<button data-dir="SHORT">SHORT</button>',
        '</div>',
        '<input type="date" id="tlFrom" />',
        '<span style="color:var(--text-muted);font-size:11px;">to</span>',
        '<input type="date" id="tlTo" />',
        '<button class="btn btn-primary btn-sm" id="tlApply">Apply</button>',
        '<button class="btn btn-secondary btn-sm" id="tlClear">Clear</button>',
        '<button class="btn btn-primary btn-sm" id="tlAddBtn" style="margin-left:auto;">+ Add Trade</button>',
      '</div>',
      // Mini metric bar
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;" id="tlMetricBar"></div>',
    '</div>',

    // Table
    '<div class="card">',
      '<div class="table-wrap" id="tlTableWrap">',
        '<div class="loading">Loading trades...</div>',
      '</div>',
      '<div class="table-footer" id="tlFooter"></div>',
    '</div>',
  ].join('');
}

async function _fetchAndRender() {
  var symbol = (document.getElementById('tlSymbol') || {}).value || '';
  var from   = (document.getElementById('tlFrom')   || {}).value || '';
  var to     = (document.getElementById('tlTo')     || {}).value || '';

  var url = '/api/trades?limit=1000';
  if (symbol) url += '&symbol=' + encodeURIComponent(symbol);
  if (_tlDir) url += '&direction=' + _tlDir;
  if (from)  url += '&date_from=' + from + 'T00:00:00';
  if (to)    url += '&date_to='   + to   + 'T23:59:59';

  var wrap = document.getElementById('tlTableWrap');
  if (wrap) wrap.innerHTML = '<div class="loading">Loading...</div>';

  try {
    var data = await fetch(url).then(function(r){ return r.json(); });
    _allTrades = Array.isArray(data) ? data : [];
    _renderMetricBar();
    _renderTable();
  } catch(e) {
    if (wrap) wrap.innerHTML = '<div class="empty-state"><p>Failed: ' + e.message + '</p></div>';
  }
}

// ─── Mini metric bar ─────────────────────────────────────────────
function _renderMetricBar() {
  var el = document.getElementById('tlMetricBar');
  if (!el) return;

  var C = window.CURRENCY || '£';
  var trades = _allTrades;
  var closed = trades.filter(function(t){ return t.status !== 'open' && t.net_pnl !== null; });
  var wins   = closed.filter(function(t){ return t.net_pnl > 0; });
  var totalPnl = closed.reduce(function(s,t){ return s + (t.net_pnl || 0); }, 0);
  var wr = closed.length > 0 ? Math.round(wins.length / closed.length * 100) : 0;

  var gross_profit = wins.reduce(function(s,t){ return s + (t.net_pnl || 0); }, 0);
  var losses = closed.filter(function(t){ return t.net_pnl < 0; });
  var gross_loss = losses.reduce(function(s,t){ return s + Math.abs(t.net_pnl || 0); }, 0);
  var pf = gross_loss > 0 ? (gross_profit / gross_loss).toFixed(2) : gross_profit > 0 ? '∞' : '0.00';

  var avgWin  = wins.length > 0  ? gross_profit / wins.length   : 0;
  var avgLoss = losses.length > 0 ? gross_loss   / losses.length : 0;
  var ratio   = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';

  var pnlSign = totalPnl >= 0 ? '+' : '';
  var pnlColor = totalPnl >= 0 ? '#10b981' : '#f43f5e';

  el.innerHTML = [
    // Net P&L
    '<div class="metric-card" style="padding:10px 14px;">',
      '<div class="metric-label" style="font-size:10px;">Net Cumulative P&L</div>',
      '<div style="font-size:18px;font-weight:700;color:' + pnlColor + ';">' + pnlSign + C + Math.abs(totalPnl).toFixed(2) + '</div>',
    '</div>',

    // Profit factor
    '<div class="metric-card" style="padding:10px 14px;display:flex;align-items:center;gap:10px;">',
      '<div>',
        '<div class="metric-label" style="font-size:10px;">Profit Factor</div>',
        '<div style="font-size:18px;font-weight:700;">' + pf + '</div>',
      '</div>',
      '<div style="position:relative;width:44px;height:44px;flex-shrink:0;">',
        '<canvas id="tlPfRing" width="44" height="44"></canvas>',
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-muted);">' + pf + '</div>',
      '</div>',
    '</div>',

    // Win %
    '<div class="metric-card" style="padding:10px 14px;display:flex;align-items:center;gap:10px;">',
      '<div>',
        '<div class="metric-label" style="font-size:10px;">Trade Win %</div>',
        '<div style="font-size:18px;font-weight:700;">' + wr + '%</div>',
      '</div>',
      '<div style="position:relative;width:44px;height:44px;flex-shrink:0;">',
        '<canvas id="tlWrRing" width="44" height="44"></canvas>',
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-muted);">' + wr + '%</div>',
      '</div>',
    '</div>',

    // Avg Win/Loss
    '<div class="metric-card" style="padding:10px 14px;">',
      '<div class="metric-label" style="font-size:10px;">Avg Win / Loss</div>',
      '<div style="display:flex;gap:6px;margin-top:4px;align-items:center;">',
        '<span style="font-size:12px;color:#10b981;font-weight:600;">+' + C + avgWin.toFixed(2) + '</span>',
        '<span style="font-size:10px;color:var(--text-muted);">/</span>',
        '<span style="font-size:12px;color:#f43f5e;font-weight:600;">-' + C + avgLoss.toFixed(2) + '</span>',
      '</div>',
      '<div style="font-size:16px;font-weight:700;margin-top:4px;">' + ratio + ' ratio</div>',
    '</div>',
  ].join('');

  // Mini donuts
  _renderTlMiniDonut('tlPfRing',
    gross_loss > 0 ? [gross_profit, gross_loss] : [1, 0],
    ['#10b981', '#f43f5e']);
  _renderTlMiniDonut('tlWrRing',
    [wr, 100 - wr],
    ['#8b5cf6', '#1e293b']);
}

function _renderTlMiniDonut(id, data, colors) {
  var ctx = document.getElementById(id);
  if (!ctx) return;
  if (_tlMetricCharts[id]) _tlMetricCharts[id].destroy();
  _tlMetricCharts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 300 },
    }
  });
}

// ─── Trade table ─────────────────────────────────────────────────
function _renderTable() {
  var wrap   = document.getElementById('tlTableWrap');
  var footer = document.getElementById('tlFooter');
  if (!wrap) return;

  if (_allTrades.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No trades found.</p></div>';
    if (footer) footer.innerHTML = '';
    return;
  }

  var sorted = _allTrades.slice().sort(function(a, b) {
    var av = a[_tlSortCol], bv = b[_tlSortCol];
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return _tlSortDir === 'asc' ? -1 : 1;
    if (av > bv) return _tlSortDir === 'asc' ? 1  : -1;
    return 0;
  });

  var cols = [
    { key: 'entry_time',   label: 'Open Date' },
    { key: 'symbol',       label: 'Symbol' },
    { key: 'status',       label: 'Status' },
    { key: 'exit_time',    label: 'Close Date' },
    { key: 'entry_price',  label: 'Entry' },
    { key: 'exit_price',   label: 'Exit' },
    { key: 'net_pnl',      label: 'Net P&L' },
    { key: '_roi',         label: 'Net ROI' },
    { key: '_scale',       label: 'Scale' },
  ];

  var maxAbsPnl = Math.max.apply(null, _allTrades.map(function(t){ return Math.abs(t.net_pnl || 0); })) || 1;

  var headerHTML = cols.map(function(c) {
    var isSorted = _tlSortCol === c.key;
    var cls = isSorted ? 'sorted' + (_tlSortDir === 'asc' ? ' asc' : '') : '';
    return '<th class="' + cls + '" data-col="' + c.key + '">' + c.label + '</th>';
  }).join('');

  var rowsHTML = sorted.map(function(t) {
    var badge = '';
    if (t.status === 'open') {
      badge = '<span class="open-badge">OPEN</span>';
    } else if (t.net_pnl > 0) {
      badge = '<span class="win-badge">WIN</span>';
    } else if (t.net_pnl < 0) {
      badge = '<span class="loss-badge">LOSS</span>';
    } else {
      badge = '<span class="breakeven-badge">EVEN</span>';
    }

    var pnlCls = (t.net_pnl || 0) > 0 ? 'positive' : (t.net_pnl || 0) < 0 ? 'negative' : '';
    var C = window.CURRENCY || '£';

    // ROI = net_pnl / (entry_price * size) * 100
    var roiStr = '—';
    if (t.entry_price && t.size && t.net_pnl !== null && t.net_pnl !== undefined) {
      var base = t.entry_price * t.size;
      if (base !== 0) {
        var roi = (t.net_pnl / base * 100);
        roiStr = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
      }
    }

    // Scale bar
    var pnlFrac = Math.abs(t.net_pnl || 0) / maxAbsPnl;
    var barPct  = Math.round(pnlFrac * 48);
    var scaleBar = '';
    if ((t.net_pnl || 0) > 0) {
      scaleBar = '<div class="scale-bar-track"><div class="scale-bar-fill-win" style="width:' + barPct + '%;"></div></div>';
    } else if ((t.net_pnl || 0) < 0) {
      scaleBar = '<div class="scale-bar-track"><div class="scale-bar-fill-loss" style="width:' + barPct + '%;"></div></div>';
    } else {
      scaleBar = '<div class="scale-bar-track"></div>';
    }

    return '<tr data-id="' + t.id + '">' +
      '<td>' + _fmtDate2(t.entry_time) + '</td>' +
      '<td class="text">' + (t.symbol || '—') + '</td>' +
      '<td>' + badge + '</td>' +
      '<td>' + _fmtDate2(t.exit_time) + '</td>' +
      '<td>' + (t.entry_price != null ? t.entry_price.toFixed(5) : '—') + '</td>' +
      '<td>' + (t.exit_price  != null ? t.exit_price.toFixed(5)  : '—') + '</td>' +
      '<td class="' + pnlCls + '">' + _fmtMoney2(t.net_pnl) + '</td>' +
      '<td class="' + pnlCls + '">' + roiStr + '</td>' +
      '<td style="min-width:80px;">' + scaleBar + '</td>' +
    '</tr>';
  }).join('');

  wrap.innerHTML = '<table>' +
    '<thead><tr>' + headerHTML + '</tr></thead>' +
    '<tbody>' + rowsHTML + '</tbody>' +
  '</table>';

  // Sort click
  wrap.querySelectorAll('thead th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      if (_tlSortCol === th.dataset.col) {
        _tlSortDir = _tlSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _tlSortCol = th.dataset.col;
        _tlSortDir = 'desc';
      }
      _renderTable();
    });
  });

  // Row click -> edit modal
  wrap.querySelectorAll('tbody tr[data-id]').forEach(function(row) {
    row.addEventListener('click', function() { _openTradeModal(parseInt(row.dataset.id)); });
  });

  // Footer
  var totalPnl = _allTrades.reduce(function(s,t){ return s + (t.net_pnl || 0); }, 0);
  var wins     = _allTrades.filter(function(t){ return t.net_pnl > 0; }).length;
  var closed   = _allTrades.filter(function(t){ return t.status !== 'open'; }).length;
  var C = window.CURRENCY || '£';
  if (footer) {
    footer.innerHTML =
      '<span>' + _allTrades.length + ' trades</span>' +
      '<span>Win rate: ' + (closed > 0 ? Math.round(wins / closed * 100) : 0) + '%</span>' +
      '<span class="' + (totalPnl >= 0 ? 'positive' : 'negative') + '">' +
        'Total Net P&L: ' + _fmtMoney2(totalPnl) +
      '</span>';
  }
}

// ─── Add/Edit Modal ───────────────────────────────────────────────
function _openTradeModal(tradeId) {
  _tlEditId = tradeId;
  var overlay = document.getElementById('tradeModal');
  var title   = document.getElementById('tradeModalTitle');
  var body    = document.getElementById('tradeModalBody');
  var delBtn  = document.getElementById('tradeDeleteBtn');

  var trade = tradeId ? _allTrades.find(function(t){ return t.id === tradeId; }) : null;
  title.textContent = trade ? ('Edit Trade #' + tradeId) : 'Add Trade';
  delBtn.style.display = trade ? 'inline-flex' : 'none';

  var dir = trade ? trade.direction : 'LONG';

  body.innerHTML = [
    '<div class="grid-2">',
      '<div class="form-group">',
        '<label class="form-label">Symbol *</label>',
        '<input type="text" class="form-control" id="tf-symbol" value="' + (trade ? trade.symbol || '' : '') + '" placeholder="EURUSD" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Direction *</label>',
        '<div class="dir-modal-toggle">',
          '<button type="button" id="tf-dir-long" class="' + (dir === 'LONG' ? 'active-long' : '') + '">LONG</button>',
          '<button type="button" id="tf-dir-short" class="' + (dir === 'SHORT' ? 'active-short' : '') + '">SHORT</button>',
        '</div>',
        '<input type="hidden" id="tf-direction" value="' + dir + '" />',
      '</div>',
    '</div>',
    '<div class="grid-2">',
      '<div class="form-group">',
        '<label class="form-label">Entry Price *</label>',
        '<input type="number" step="any" class="form-control" id="tf-entry-price" value="' + (trade ? trade.entry_price || '' : '') + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Exit Price</label>',
        '<input type="number" step="any" class="form-control" id="tf-exit-price" value="' + (trade && trade.exit_price != null ? trade.exit_price : '') + '" />',
      '</div>',
    '</div>',
    '<div class="grid-2">',
      '<div class="form-group">',
        '<label class="form-label">Entry Time *</label>',
        '<input type="datetime-local" class="form-control" id="tf-entry-time" value="' + _toLocalDT(trade ? trade.entry_time : null) + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Exit Time</label>',
        '<input type="datetime-local" class="form-control" id="tf-exit-time" value="' + _toLocalDT(trade ? trade.exit_time : null) + '" />',
      '</div>',
    '</div>',
    '<div class="grid-3">',
      '<div class="form-group">',
        '<label class="form-label">Size *</label>',
        '<input type="number" step="any" class="form-control" id="tf-size" value="' + (trade ? trade.size || 1 : 1) + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">P&L</label>',
        '<input type="number" step="any" class="form-control" id="tf-pnl" value="' + (trade && trade.pnl != null ? trade.pnl : '') + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Fees</label>',
        '<input type="number" step="any" class="form-control" id="tf-fees" value="' + (trade ? trade.fees || 0 : 0) + '" />',
      '</div>',
    '</div>',
    '<div class="grid-3">',
      '<div class="form-group">',
        '<label class="form-label">Stop Loss</label>',
        '<input type="number" step="any" class="form-control" id="tf-sl" value="' + (trade && trade.stop_loss != null ? trade.stop_loss : '') + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Take Profit</label>',
        '<input type="number" step="any" class="form-control" id="tf-tp" value="' + (trade && trade.take_profit != null ? trade.take_profit : '') + '" />',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label">Status</label>',
        '<select class="form-control" id="tf-status">',
          '<option value="closed"' + (!trade || trade.status === 'closed' ? ' selected' : '') + '>Closed</option>',
          '<option value="open"'   + (trade && trade.status === 'open'   ? ' selected' : '') + '>Open</option>',
        '</select>',
      '</div>',
    '</div>',
    '<div class="form-group">',
      '<label class="form-label">Notes</label>',
      '<textarea class="form-control" id="tf-notes" rows="3">' + (trade ? trade.notes || '' : '') + '</textarea>',
    '</div>',
  ].join('');

  // Direction toggle
  document.getElementById('tf-dir-long').addEventListener('click', function() {
    document.getElementById('tf-direction').value = 'LONG';
    document.getElementById('tf-dir-long').className  = 'active-long';
    document.getElementById('tf-dir-short').className = '';
  });
  document.getElementById('tf-dir-short').addEventListener('click', function() {
    document.getElementById('tf-direction').value = 'SHORT';
    document.getElementById('tf-dir-short').className = 'active-short';
    document.getElementById('tf-dir-long').className  = '';
  });

  overlay.classList.add('open');
}

// ─── Modal event handlers ─────────────────────────────────────────
document.getElementById('tradeModalClose').addEventListener('click', function() {
  document.getElementById('tradeModal').classList.remove('open');
});
document.getElementById('tradeModalCancel').addEventListener('click', function() {
  document.getElementById('tradeModal').classList.remove('open');
});

document.getElementById('tradeDeleteBtn').addEventListener('click', async function() {
  if (!_tlEditId) return;
  if (!confirm('Delete trade #' + _tlEditId + '?')) return;
  try {
    var res = await fetch('/api/trades/' + _tlEditId, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      document.getElementById('tradeModal').classList.remove('open');
      await _fetchAndRender();
    } else {
      var d = await res.json();
      alert('Delete failed: ' + (d.detail || res.status));
    }
  } catch(e) {
    alert('Error: ' + e.message);
  }
});

document.getElementById('tradeModalSave').addEventListener('click', async function() {
  var symbol = _getVal('tf-symbol');
  if (!symbol) { alert('Symbol is required'); return; }
  var entryPrice = _getNum('tf-entry-price');
  if (entryPrice === null) { alert('Entry price is required'); return; }
  var entryTimeVal = _getVal('tf-entry-time');
  if (!entryTimeVal) { alert('Entry time is required'); return; }

  var payload = {
    symbol: symbol,
    direction: _getVal('tf-direction') || 'LONG',
    entry_price: entryPrice,
    exit_price:  _getNum('tf-exit-price'),
    entry_time:  new Date(entryTimeVal).toISOString(),
    exit_time:   (function(){ var v = _getVal('tf-exit-time'); return v ? new Date(v).toISOString() : null; })(),
    size:   _getNum('tf-size') || 1,
    pnl:    _getNum('tf-pnl'),
    fees:   _getNum('tf-fees') || 0,
    stop_loss:   _getNum('tf-sl'),
    take_profit: _getNum('tf-tp'),
    status: _getVal('tf-status') || 'closed',
    notes:  _getVal('tf-notes'),
    tag_ids: [],
  };

  try {
    var res;
    if (_tlEditId) {
      res = await fetch('/api/trades/' + _tlEditId, {
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
      await _fetchAndRender();
    } else {
      var d = await res.json();
      alert('Save failed: ' + (d.detail || JSON.stringify(d)));
    }
  } catch(e) {
    alert('Error: ' + e.message);
  }
});

// ─── Local helpers ────────────────────────────────────────────────
function _fmtMoney2(v) {
  if (v === null || v === undefined) return '—';
  var C = window.CURRENCY || '£';
  var sign = v >= 0 ? '+' : '-';
  return sign + C + Math.abs(v).toFixed(2);
}

function _fmtDate2(dt) {
  if (!dt) return '—';
  return String(dt).substring(0, 10);
}

function _toLocalDT(dt) {
  if (!dt) return '';
  try {
    var d = new Date(dt);
    var pad = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
           'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch(e) { return ''; }
}

function _getVal(id) {
  var el = document.getElementById(id);
  return el ? (el.value || null) : null;
}

function _getNum(id) {
  var el = document.getElementById(id);
  if (!el || el.value === '' || el.value === null) return null;
  var n = parseFloat(el.value);
  return isNaN(n) ? null : n;
}
