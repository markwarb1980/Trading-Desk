// Reports module — TradeZella-style
'use strict';

var _rptCharts = {};

window.loadReports = async function loadReports() {
  var container = document.getElementById('section-reports');
  container.innerHTML = '<div class="loading">Loading reports...</div>';

  try {
    var results = await Promise.all([
      fetch('/api/analytics/pnl-by-symbol').then(function(r){ return r.json(); }),
      fetch('/api/analytics/pnl-by-hour').then(function(r){ return r.json(); }),
      fetch('/api/analytics/summary').then(function(r){ return r.json(); }),
    ]);

    var bySymbol = results[0];
    var byHour   = results[1];
    var summary  = results[2];

    container.innerHTML = _buildReportsHTML();

    _renderSymbolChart(bySymbol);
    _renderHourChart(byHour);
    _renderStatsTable(summary);

  } catch(e) {
    container.innerHTML = '<div class="empty-state"><div class="icon">⚠</div><p>Failed to load reports: ' + e.message + '</p></div>';
  }
};

function _buildReportsHTML() {
  return [
    // Section 1: By Symbol (horizontal bar)
    '<div class="card" style="margin-bottom:16px;">',
      '<div class="card-title">Performance by Symbol</div>',
      '<div style="position:relative;height:300px;"><canvas id="rptSymbolChart"></canvas></div>',
    '</div>',

    // Section 2: By Hour (vertical bar)
    '<div class="card" style="margin-bottom:16px;">',
      '<div class="card-title">Performance by Hour of Day</div>',
      '<div style="position:relative;height:260px;"><canvas id="rptHourChart"></canvas></div>',
    '</div>',

    // Section 3: Stats table
    '<div class="card">',
      '<div class="card-title">Detailed Statistics</div>',
      '<div id="rptStatsTable"></div>',
    '</div>',
  ].join('');
}

// ─── Section 1: Symbol horizontal bar chart ───────────────────────
function _renderSymbolChart(data) {
  var ctx = document.getElementById('rptSymbolChart');
  if (!ctx) return;
  if (_rptCharts.symbol) _rptCharts.symbol.destroy();

  if (!data || data.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No symbol data</p></div>';
    return;
  }

  var C = window.CURRENCY || '£';
  var sorted = data.slice().sort(function(a, b){ return a.total_pnl - b.total_pnl; });
  var labels = sorted.map(function(d){ return d.symbol; });
  var values = sorted.map(function(d){ return d.total_pnl; });
  var colors = values.map(function(v){ return v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)'; });
  var borders = values.map(function(v){ return v >= 0 ? '#10b981' : '#f43f5e'; });

  _rptCharts.symbol = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'P&L',
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var sym = sorted[ctx.dataIndex];
              return (ctx.parsed.x >= 0 ? '+' : '') + C + Math.abs(ctx.parsed.x).toFixed(2) +
                     '  |  WR: ' + (sym.win_rate || 0).toFixed(1) + '%' +
                     '  |  ' + (sym.trade_count || 0) + ' trades';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' },
            callback: function(v){ return (v >= 0 ? '+' : '') + C + Math.abs(v).toFixed(0); }
          }
        },
        y: {
          grid: { color: 'transparent' },
          ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter' } }
        }
      }
    }
  });
}

// ─── Section 2: Hour bar chart ────────────────────────────────────
function _renderHourChart(data) {
  var ctx = document.getElementById('rptHourChart');
  if (!ctx) return;
  if (_rptCharts.hour) _rptCharts.hour.destroy();

  if (!data || data.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No hourly data</p></div>';
    return;
  }

  var C = window.CURRENCY || '£';
  var active = data.filter(function(d){ return d.trade_count > 0; });
  if (active.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No trades with time data</p></div>';
    return;
  }

  var labels = data.map(function(d){ return String(d.hour).padStart(2,'0') + ':00'; });
  var values = data.map(function(d){ return d.total_pnl || 0; });
  var colors = values.map(function(v){ return v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)'; });
  var borders = values.map(function(v){ return v >= 0 ? '#10b981' : '#f43f5e'; });

  _rptCharts.hour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var h = data[ctx.dataIndex];
              return (ctx.parsed.y >= 0 ? '+' : '') + C + Math.abs(ctx.parsed.y).toFixed(2) +
                     '  |  WR: ' + (h.win_rate || 0).toFixed(1) + '%' +
                     '  |  ' + (h.trade_count || 0) + ' trades';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { size: 9, family: 'Inter' },
            maxRotation: 45,
          }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' },
            callback: function(v){ return (v >= 0 ? '+' : '') + C + Math.abs(v).toFixed(0); }
          }
        }
      }
    }
  });
}

// ─── Section 3: Stats table ───────────────────────────────────────
function _renderStatsTable(s) {
  var el = document.getElementById('rptStatsTable');
  if (!el) return;

  var C = window.CURRENCY || '£';

  function fmt(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return v.toFixed(2);
    return String(v);
  }

  function fmtMoney(v) {
    if (v === null || v === undefined) return '—';
    var sign = v >= 0 ? '+' : '-';
    return sign + C + Math.abs(v).toFixed(2);
  }

  var streakLabel = (s.current_streak || 0) > 0
    ? '+' + s.current_streak + ' wins'
    : (s.current_streak || 0) < 0
      ? s.current_streak + ' losses'
      : '0';

  var rows = [
    { metric: 'Total Trades',    value: s.total_trades || 0,                      benchmark: '—',    pass: null },
    { metric: 'Win Rate',        value: (s.win_rate || 0).toFixed(1) + '%',        benchmark: '>50%', pass: (s.win_rate || 0) >= 50 },
    { metric: 'Profit Factor',   value: fmt(s.profit_factor),                      benchmark: '>1.5', pass: (s.profit_factor || 0) >= 1.5 },
    { metric: 'Avg Win',         value: fmtMoney(s.avg_win),                       benchmark: '—',    pass: null },
    { metric: 'Avg Loss',        value: fmtMoney(s.avg_loss),                      benchmark: '—',    pass: null },
    { metric: 'Avg R-Multiple',  value: s.avg_r != null ? fmt(s.avg_r) + 'R' : '—', benchmark: '>1.0', pass: (s.avg_r || 0) >= 1.0 },
    { metric: 'Max Drawdown',    value: fmtMoney(s.max_drawdown),                  benchmark: '—',    pass: null },
    { metric: 'Best Day',        value: s.best_day || '—',                         benchmark: '—',    pass: null },
    { metric: 'Worst Day',       value: s.worst_day || '—',                        benchmark: '—',    pass: null },
    { metric: 'Current Streak',  value: streakLabel,                               benchmark: '—',    pass: null },
    { metric: 'Total Fees',      value: fmtMoney(s.total_fees),                    benchmark: '—',    pass: null },
    { metric: 'Gross Profit',    value: fmtMoney(s.gross_profit),                  benchmark: '—',    pass: null },
    { metric: 'Gross Loss',      value: fmtMoney(s.gross_loss),                    benchmark: '—',    pass: null },
  ];

  var rowsHTML = rows.map(function(r) {
    var valColor = '';
    if (r.pass === true)  valColor = 'color:#10b981;';
    if (r.pass === false) valColor = 'color:#f43f5e;';

    var benchColor = '';
    if (r.pass === true)  benchColor = 'color:#10b981;';
    if (r.pass === false) benchColor = 'color:#f43f5e;';

    return '<div class="stats-table-row">' +
      '<div class="stats-table-metric">' + r.metric + '</div>' +
      '<div class="stats-table-value" style="' + valColor + '">' + r.value + '</div>' +
      '<div class="stats-table-benchmark" style="' + benchColor + '">' + r.benchmark + '</div>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<div style="display:flex;gap:12px;padding:8px 0 12px;border-bottom:1px solid var(--border);margin-bottom:4px;">' +
      '<div style="flex:1;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Metric</div>' +
      '<div style="width:130px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Value</div>' +
      '<div style="width:100px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);text-align:right;">Benchmark</div>' +
    '</div>' +
    rowsHTML;
}
