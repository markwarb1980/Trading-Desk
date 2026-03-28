// Dashboard module — TradeZella-style
'use strict';

var _dashCharts = {};

window.loadDashboard = async function loadDashboard() {
  var container = document.getElementById('section-dashboard');
  container.innerHTML = '<div class="loading">Loading dashboard...</div>';

  try {
    var results = await Promise.all([
      fetch('/api/analytics/summary').then(function(r){ return r.json(); }),
      fetch('/api/analytics/equity-curve').then(function(r){ return r.json(); }),
      fetch('/api/trades?limit=8').then(function(r){ return r.json(); }),
    ]);

    var summary = results[0];
    var equity  = results[1];
    var recentTrades = results[2];

    container.innerHTML = _buildDashHTML();

    _renderMetricCards(summary, equity);
    _renderGSScore(summary);
    _renderProgressHeatmap(equity);
    _renderCumulativeChart(equity);
    _renderDailyBarChart(equity);
    _renderRecentTrades(recentTrades);

  } catch(e) {
    container.innerHTML = '<div class="empty-state"><div class="icon">⚠</div><p>Failed to load dashboard: ' + e.message + '</p></div>';
  }
};

// ─── HTML scaffold ───────────────────────────────────────────────
function _buildDashHTML() {
  return [
    // Row 1: 5 metric cards
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px;" id="dash-metric-row"></div>',

    // Row 2: GS Score | Heatmap | Cumulative chart
    '<div style="display:grid;grid-template-columns:40% 30% 30%;gap:12px;margin-bottom:16px;">',
      '<div class="card" id="dash-gs-card">',
        '<div class="card-title">GS Score</div>',
        '<div id="dash-gs-content"></div>',
      '</div>',
      '<div class="card" id="dash-heatmap-card">',
        '<div class="card-title">Progress Tracker</div>',
        '<div id="dash-heatmap-content"></div>',
      '</div>',
      '<div class="card" id="dash-cumul-card">',
        '<div class="card-title">Daily Net Cumulative P&L</div>',
        '<div style="position:relative;height:220px;"><canvas id="dashCumulChart"></canvas></div>',
      '</div>',
    '</div>',

    // Row 3: Daily P&L bars | Recent trades
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">',
      '<div class="card">',
        '<div class="card-title">Net Daily P&L</div>',
        '<div style="position:relative;height:220px;"><canvas id="dashDailyBar"></canvas></div>',
      '</div>',
      '<div class="card">',
        '<div class="card-title">Recent Trades</div>',
        '<div id="dash-recent-trades"></div>',
      '</div>',
    '</div>',
  ].join('');
}

// ─── Row 1: 5 Metric Cards ───────────────────────────────────────
function _renderMetricCards(s, equity) {
  var row = document.getElementById('dash-metric-row');
  if (!row) return;

  var C = window.CURRENCY || '£';

  // Card 1: Net P&L + sparkline
  var pnlColor = s.total_pnl >= 0 ? '#10b981' : '#f43f5e';
  var pnlSign  = s.total_pnl >= 0 ? '+' : '';
  var card1 = '<div class="metric-card">' +
    '<div class="metric-label">Net P&L</div>' +
    '<div class="metric-value" style="color:' + pnlColor + ';font-size:22px;">' + pnlSign + C + Math.abs(s.total_pnl || 0).toFixed(2) + '</div>' +
    '<div style="height:50px;margin:8px 0 4px;"><canvas id="dashSparkline" height="50"></canvas></div>' +
    '<div class="metric-sub">' + (s.total_trades || 0) + ' trades total</div>' +
  '</div>';

  // Card 2: Win %  donut
  var wins = Math.round((s.win_rate || 0) / 100 * (s.total_trades || 0));
  var losses = (s.total_trades || 0) - wins;
  var card2 = '<div class="metric-card">' +
    '<div class="metric-label">Trade Win %</div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-top:4px;">' +
      '<div class="donut-wrap" style="width:80px;height:80px;">' +
        '<canvas id="dashDonutWin" width="80" height="80"></canvas>' +
        '<div class="donut-center">' +
          '<div class="donut-center-value">' + (s.win_rate || 0).toFixed(1) + '%</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);line-height:1.8;">' +
        '<div><span style="color:#10b981;font-weight:700;">' + wins + ' W</span></div>' +
        '<div><span style="color:#64748b;font-weight:700;">0 B</span></div>' +
        '<div><span style="color:#f43f5e;font-weight:700;">' + losses + ' L</span></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  // Card 3: Profit Factor donut
  var gp = Math.abs(s.gross_profit || 0);
  var gl = Math.abs(s.gross_loss || 0);
  var pfColor = (s.profit_factor || 0) >= 1.5 ? '#10b981' : (s.profit_factor || 0) >= 1 ? '#f59e0b' : '#f43f5e';
  var card3 = '<div class="metric-card">' +
    '<div class="metric-label">Profit Factor</div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-top:4px;">' +
      '<div class="donut-wrap" style="width:80px;height:80px;">' +
        '<canvas id="dashDonutPF" width="80" height="80"></canvas>' +
        '<div class="donut-center">' +
          '<div class="donut-center-value" style="color:' + pfColor + ';">' + (s.profit_factor || 0).toFixed(2) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);line-height:1.8;">' +
        '<div style="color:#10b981;">Gross: <span style="font-weight:700;">' + C + gp.toFixed(2) + '</span></div>' +
        '<div style="color:#f43f5e;">Loss: <span style="font-weight:700;">' + C + gl.toFixed(2) + '</span></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  // Card 4: Day Win % donut (computed from equity)
  var dayWinRate = 0;
  if (equity && equity.length > 0) {
    var tradingDays = equity.filter(function(d){ return d.daily_pnl !== null && d.daily_pnl !== undefined; });
    var winDays = tradingDays.filter(function(d){ return d.daily_pnl > 0; }).length;
    dayWinRate = tradingDays.length > 0 ? Math.round(winDays / tradingDays.length * 100) : 0;
  }
  var card4 = '<div class="metric-card">' +
    '<div class="metric-label">Day Win %</div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-top:4px;">' +
      '<div class="donut-wrap" style="width:80px;height:80px;">' +
        '<canvas id="dashDonutDay" width="80" height="80"></canvas>' +
        '<div class="donut-center">' +
          '<div class="donut-center-value">' + dayWinRate + '%</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);">of trading<br>days profitable</div>' +
    '</div>' +
  '</div>';

  // Card 5: Avg Win/Loss scale bar
  var avgWin  = s.avg_win  || 0;
  var avgLoss = s.avg_loss || 0;
  var ratio   = avgLoss !== 0 ? (Math.abs(avgWin) / Math.abs(avgLoss)).toFixed(2) : '—';
  var maxVal  = Math.max(Math.abs(avgWin), Math.abs(avgLoss)) || 1;
  var winPct  = Math.round(Math.abs(avgWin)  / maxVal * 50);
  var lossPct = Math.round(Math.abs(avgLoss) / maxVal * 50);
  var card5 = '<div class="metric-card">' +
    '<div class="metric-label">Avg Win / Loss</div>' +
    '<div style="margin-top:8px;">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:11px;color:#10b981;font-weight:600;">+' + C + Math.abs(avgWin).toFixed(2) + '</span>' +
        '<span style="font-size:11px;color:#f43f5e;font-weight:600;">-' + C + Math.abs(avgLoss).toFixed(2) + '</span>' +
      '</div>' +
      '<div class="scale-bar">' +
        '<div class="scale-bar-track">' +
          '<div class="scale-bar-fill-loss" style="width:' + lossPct + '%;"></div>' +
          '<div class="scale-bar-fill-win" style="width:' + winPct + '%;"></div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:8px;">' +
        '<span style="font-size:24px;font-weight:700;color:var(--text);">' + ratio + '</span>' +
        '<div style="font-size:10px;color:var(--text-muted);">ratio</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  row.innerHTML = card1 + card2 + card3 + card4 + card5;

  // Render sparkline
  _renderSparkline(equity);

  // Render donuts
  _renderSmallDonut('dashDonutWin',
    [wins, 0, losses],
    ['#10b981', '#334155', '#f43f5e']);

  var pfData = gl > 0 ? [gp, gl] : [1, 0];
  _renderSmallDonut('dashDonutPF',
    pfData,
    ['#10b981', '#f43f5e']);

  _renderSmallDonut('dashDonutDay',
    [dayWinRate, 100 - dayWinRate],
    ['#8b5cf6', '#1e293b']);
}

function _renderSmallDonut(canvasId, data, colors) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (_dashCharts[canvasId]) { _dashCharts[canvasId].destroy(); }

  _dashCharts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 2,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 400 },
    }
  });
}

function _renderSparkline(equity) {
  var ctx = document.getElementById('dashSparkline');
  if (!ctx || !equity || equity.length === 0) return;
  if (_dashCharts.sparkline) _dashCharts.sparkline.destroy();

  var pts = equity.slice(-30).map(function(d){ return d.cumulative_pnl; });
  var last = pts[pts.length - 1] || 0;
  var lineColor = last >= 0 ? '#10b981' : '#f43f5e';

  _dashCharts.sparkline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pts.map(function(_,i){ return i; }),
      datasets: [{
        data: pts,
        borderColor: lineColor,
        backgroundColor: last >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      animation: { duration: 400 },
    }
  });
}

// ─── Row 2, Left: GS Score radar ─────────────────────────────────
function _renderGSScore(s) {
  var el = document.getElementById('dash-gs-content');
  if (!el) return;

  var wr   = Math.min(100, (s.win_rate || 0));
  var pf   = Math.min(100, (s.profit_factor || 0) * 50);
  var ar   = Math.min(100, Math.max(0, (s.avg_r || 0) * 50));
  var dd   = Math.max(0, 100 + (s.max_drawdown || 0) / 10);
  var cons = 70;
  var rec  = 70;
  var scores = [wr, pf, ar, dd, cons, rec];
  var avg = scores.reduce(function(a,b){ return a+b; }, 0) / scores.length;

  var scoreColor = avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#f43f5e';

  el.innerHTML = '<div style="position:relative;height:190px;"><canvas id="dashRadar"></canvas></div>' +
    '<div style="text-align:center;margin-top:10px;">' +
      '<span style="font-size:28px;font-weight:800;color:' + scoreColor + ';">' + avg.toFixed(1) + '</span>' +
      '<span style="font-size:14px;color:var(--text-muted);"> / 100</span>' +
    '</div>';

  var ctx = document.getElementById('dashRadar');
  if (!ctx) return;
  if (_dashCharts.radar) _dashCharts.radar.destroy();

  _dashCharts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Win %', 'Profit Factor', 'Avg R', 'Drawdown', 'Consistency', 'Recovery'],
      datasets: [{
        data: scores,
        backgroundColor: 'rgba(139,92,246,0.25)',
        borderColor: '#8b5cf6',
        borderWidth: 2,
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 100,
          beginAtZero: true,
          grid: { color: '#1e293b' },
          angleLines: { color: '#1e293b' },
          ticks: {
            stepSize: 25,
            color: '#334155',
            font: { size: 9 },
            backdropColor: 'transparent',
          },
          pointLabels: {
            color: '#64748b',
            font: { size: 9, family: 'Inter' },
          }
        }
      }
    }
  });
}

// ─── Row 2, Middle: Progress heatmap ─────────────────────────────
function _renderProgressHeatmap(equity) {
  var el = document.getElementById('dash-heatmap-content');
  if (!el) return;

  if (!equity || equity.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  // Build a daily P&L map
  var pnlMap = {};
  equity.forEach(function(d) {
    if (d.date && d.daily_pnl !== null && d.daily_pnl !== undefined) {
      pnlMap[d.date] = d.daily_pnl;
    }
  });

  // Find max abs value for color scaling
  var vals = Object.values(pnlMap);
  var maxAbs = vals.length > 0 ? Math.max.apply(null, vals.map(Math.abs)) : 1;
  if (maxAbs === 0) maxAbs = 1;

  // Build 16 weeks going back from today
  var today = new Date();
  // Find the start of the week (Monday) 16 weeks ago
  var dayOfWeek = today.getDay(); // 0=Sun
  var mondayOffset = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  var startDate = new Date(today);
  startDate.setDate(startDate.getDate() - mondayOffset - 15 * 7);

  var weeks = 16;
  var cells = [];
  var monthLabels = {};

  for (var w = 0; w < weeks; w++) {
    for (var d = 0; d < 7; d++) {
      var cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w * 7 + d);
      var dateStr = _fmtDateStr(cellDate);

      // Track month labels
      if (cellDate.getDate() <= 7) {
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        monthLabels[w] = monthNames[cellDate.getMonth()];
      }

      cells.push({ w: w, d: d, date: dateStr, pnl: pnlMap[dateStr] });
    }
  }

  function cellColor(pnl) {
    if (pnl === undefined || pnl === null) return '#1e293b';
    if (pnl === 0) return '#1e293b';
    var intensity = Math.min(1, Math.abs(pnl) / maxAbs);
    if (pnl > 0) {
      var r = Math.round(209 - intensity * (209 - 5));
      var g = Math.round(250 - intensity * (250 - 150));
      var b = Math.round(229 - intensity * (229 - 105));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    } else {
      var r2 = Math.round(254 - intensity * (254 - 225));
      var g2 = Math.round(205 - intensity * (205 - 29));
      var b2 = Math.round(211 - intensity * (211 - 72));
      return 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
    }
  }

  // Build month labels row
  var monthRowHTML = '';
  for (var wi = 0; wi < weeks; wi++) {
    monthRowHTML += '<div style="font-size:9px;color:var(--text-muted);text-align:center;grid-column:' + (wi + 2) + ';grid-row:1;">' + (monthLabels[wi] || '') + '</div>';
  }

  // Day labels
  var dayLabels = ['M','T','W','T','F','S','S'];
  var dayLabelsHTML = '';
  for (var di = 0; di < 7; di++) {
    dayLabelsHTML += '<div style="font-size:9px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;grid-column:1;grid-row:' + (di + 2) + ';">' + dayLabels[di] + '</div>';
  }

  // Cells
  var cellsHTML = '';
  cells.forEach(function(c) {
    var bg = cellColor(c.pnl);
    var title = c.date + (c.pnl !== undefined && c.pnl !== null ? ': ' + (window.CURRENCY || '£') + c.pnl.toFixed(2) : '');
    cellsHTML += '<div title="' + title + '" style="' +
      'width:14px;height:14px;border-radius:2px;' +
      'background:' + bg + ';' +
      'grid-column:' + (c.w + 2) + ';grid-row:' + (c.d + 2) + ';' +
    '"></div>';
  });

  el.innerHTML = '<div style="display:grid;grid-template-columns:16px repeat(' + weeks + ',14px);grid-template-rows:12px repeat(7,14px);gap:2px;overflow-x:auto;">' +
    monthRowHTML + dayLabelsHTML + cellsHTML +
  '</div>';
}

// ─── Row 2, Right: Cumulative P&L area chart ─────────────────────
function _renderCumulativeChart(equity) {
  var ctx = document.getElementById('dashCumulChart');
  if (!ctx) return;
  if (_dashCharts.cumul) _dashCharts.cumul.destroy();

  if (!equity || equity.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  var labels = equity.map(function(d){ return d.date; });
  var values = equity.map(function(d){ return d.cumulative_pnl; });
  var last = values[values.length - 1] || 0;

  var gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, last >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  _dashCharts.cumul = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        borderColor: last >= 0 ? '#10b981' : '#f43f5e',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return _fmtMoney(ctx.parsed.y); }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { size: 9, family: 'Inter' }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { size: 10, family: 'Inter' }, callback: function(v){ return _fmtMoney(v); } }
        }
      }
    }
  });
}

// ─── Row 3, Left: Net Daily P&L bar chart ────────────────────────
function _renderDailyBarChart(equity) {
  var ctx = document.getElementById('dashDailyBar');
  if (!ctx) return;
  if (_dashCharts.daily) _dashCharts.daily.destroy();

  if (!equity || equity.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  var last30 = equity.slice(-30);
  var labels = last30.map(function(d){ return d.date; });
  var values = last30.map(function(d){ return d.daily_pnl || 0; });
  var colors = values.map(function(v){ return v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)'; });
  var borders = values.map(function(v){ return v >= 0 ? '#10b981' : '#f43f5e'; });

  _dashCharts.daily = new Chart(ctx, {
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
            label: function(ctx){ return _fmtMoney(ctx.parsed.y); }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { size: 9, family: 'Inter' }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { size: 10, family: 'Inter' }, callback: function(v){ return _fmtMoney(v); } }
        }
      }
    }
  });
}

// ─── Row 3, Right: Recent trades table ───────────────────────────
function _renderRecentTrades(trades) {
  var el = document.getElementById('dash-recent-trades');
  if (!el) return;

  if (!trades || trades.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No trades yet. Import a CSV or add a trade.</p></div>';
    return;
  }

  var rows = trades.slice(0, 8).map(function(t) {
    var badge = t.net_pnl > 0 ? '<span class="win-badge">WIN</span>' :
                t.net_pnl < 0 ? '<span class="loss-badge">LOSS</span>' :
                '<span class="breakeven-badge">EVEN</span>';
    var pnlCls = t.net_pnl > 0 ? 'positive' : t.net_pnl < 0 ? 'negative' : '';
    var C = window.CURRENCY || '£';
    return '<tr onclick="showSection(\'trades\')">' +
      '<td>' + _fmtDate(t.exit_time || t.entry_time) + '</td>' +
      '<td class="text">' + (t.symbol || '—') + '</td>' +
      '<td class="' + pnlCls + '">' + _fmtMoney(t.net_pnl) + '</td>' +
      '<td>' + badge + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML = '<table>' +
    '<thead><tr>' +
      '<th>Close Date</th>' +
      '<th>Symbol</th>' +
      '<th>Net P&L</th>' +
      '<th>Status</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
  '</table>';
}

// ─── Shared helpers ───────────────────────────────────────────────
function _fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  var C = window.CURRENCY || '£';
  var sign = v >= 0 ? '+' : '-';
  return sign + C + Math.abs(v).toFixed(2);
}

function _fmtDate(dt) {
  if (!dt) return '—';
  return String(dt).substring(0, 10);
}

function _fmtDateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// Expose shared helpers globally for other modules
window._fmtMoney = _fmtMoney;
window._fmtDate  = _fmtDate;
window._fmtNum   = function(v) { if (v === null || v === undefined) return '—'; return Number(v).toFixed(2); };
window._colorClass = function(v) { if (v === null || v === undefined) return ''; return v >= 0 ? 'positive' : 'negative'; };
