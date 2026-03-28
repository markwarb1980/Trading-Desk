// Calendar module — TradeZella-style (two-panel layout)
'use strict';

var _calYear  = new Date().getFullYear();
var _calMonth = new Date().getMonth() + 1;
var _calCharts = {};

window.loadCalendar = async function loadCalendar() {
  var container = document.getElementById('section-calendar');

  container.innerHTML = [
    '<div style="display:grid;grid-template-columns:65% 35%;gap:16px;align-items:start;">',

      // LEFT: Monthly calendar
      '<div>',
        '<div class="card">',

          // Header row
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">',
            '<button class="btn btn-secondary btn-sm" id="calPrev">&#8592;</button>',
            '<div style="font-size:16px;font-weight:700;color:var(--text);min-width:170px;text-align:center;" id="calTitle"></div>',
            '<button class="btn btn-secondary btn-sm" id="calNext">&#8594;</button>',
            '<button class="btn btn-secondary btn-sm" id="calToday">This month</button>',
            '<div style="margin-left:auto;font-size:11px;color:var(--text-muted);" id="calMonthStats"></div>',
          '</div>',

          '<div id="calGridWrap"></div>',
        '</div>',
      '</div>',

      // RIGHT: two stacked charts
      '<div>',
        '<div class="card" style="margin-bottom:16px;">',
          '<div class="card-title">Drawdown</div>',
          '<div style="position:relative;height:200px;"><canvas id="calDrawdownChart"></canvas></div>',
        '</div>',
        '<div class="card">',
          '<div class="card-title">Trade Time Performance</div>',
          '<div style="position:relative;height:200px;"><canvas id="calScatterChart"></canvas></div>',
        '</div>',
      '</div>',

    '</div>',
  ].join('');

  document.getElementById('calPrev').addEventListener('click', function() {
    _calMonth--;
    if (_calMonth < 1) { _calMonth = 12; _calYear--; }
    _renderCalendar();
  });

  document.getElementById('calNext').addEventListener('click', function() {
    _calMonth++;
    if (_calMonth > 12) { _calMonth = 1; _calYear++; }
    _renderCalendar();
  });

  document.getElementById('calToday').addEventListener('click', function() {
    _calYear  = new Date().getFullYear();
    _calMonth = new Date().getMonth() + 1;
    _renderCalendar();
  });

  // Render both panels in parallel
  await Promise.all([
    _renderCalendar(),
    _renderDrawdownChart(),
    _renderScatterChart(),
  ]);
};

// ─── LEFT: Monthly calendar ───────────────────────────────────────
async function _renderCalendar() {
  var titleEl = document.getElementById('calTitle');
  var wrap    = document.getElementById('calGridWrap');
  var statsEl = document.getElementById('calMonthStats');
  if (!titleEl || !wrap) return;

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  titleEl.textContent = MONTHS[_calMonth - 1] + ' ' + _calYear;

  wrap.innerHTML = '<div class="loading" style="grid-column:span 7">Loading...</div>';

  try {
    var data = await fetch('/api/analytics/calendar?year=' + _calYear + '&month=' + _calMonth).then(function(r){ return r.json(); });

    var dayMap = {};
    data.forEach(function(d){ dayMap[d.date] = d; });

    var firstDay = new Date(_calYear, _calMonth - 1, 1);
    var lastDay  = new Date(_calYear, _calMonth, 0);
    var totalDays = lastDay.getDate();

    // Start from Sunday=0..Saturday=6
    var startDow = firstDay.getDay(); // 0=Sun

    var today = new Date();
    var todayStr = _calDateStr(today);

    var monthPnl  = 0;
    var winDays   = 0;
    var lossDays  = 0;
    var tradeDays = 0;

    // Header row: Sun Mon Tue Wed Thu Fri Sat
    var C = window.CURRENCY || '£';
    var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';

    DOW.forEach(function(d) {
      html += '<div class="cal-day-header">' + d + '</div>';
    });

    // Empty leading cells
    for (var i = 0; i < startDow; i++) {
      html += '<div class="cal-day empty"></div>';
    }

    for (var day = 1; day <= totalDays; day++) {
      var dateStr = _calYear + '-' + _pad2(_calMonth) + '-' + _pad2(day);
      var info    = dayMap[dateStr];
      var isToday = dateStr === todayStr;

      var cls = 'cal-day';
      if (isToday) cls += ' today';

      var pnlHtml = '';
      var countHtml = '';
      var wrHtml = '';

      if (info) {
        var pnl = info.pnl || 0;
        monthPnl += pnl;
        tradeDays++;
        if (pnl > 0) { cls += ' has-profit'; winDays++; }
        else if (pnl < 0) { cls += ' has-loss'; lossDays++; }

        var pnlColor = pnl > 0 ? '#10b981' : pnl < 0 ? '#f43f5e' : '#64748b';
        var sign = pnl > 0 ? '+' : '';
        pnlHtml  = '<div class="cal-day-pnl" style="color:' + pnlColor + ';">' + sign + C + Math.abs(pnl).toFixed(0) + '</div>';
        countHtml = '<div class="cal-day-count">' + info.trade_count + ' trade' + (info.trade_count !== 1 ? 's' : '') + '</div>';

        if (info.trade_count > 0 && info.win_count !== undefined) {
          var wr = Math.round(info.win_count / info.trade_count * 100);
          wrHtml = '<div class="cal-day-wr">' + wr + '% WR</div>';
        }
      }

      html += '<div class="' + cls + '">' +
        '<div class="cal-day-num">' + day + '</div>' +
        pnlHtml + countHtml + wrHtml +
      '</div>';
    }

    html += '</div>';
    wrap.innerHTML = html;

    // Monthly stats header
    if (statsEl) {
      var mpColor = monthPnl >= 0 ? '#10b981' : '#f43f5e';
      var mpSign  = monthPnl >= 0 ? '+' : '';
      statsEl.innerHTML = 'Monthly: <strong style="color:' + mpColor + ';">' + mpSign + C + Math.abs(monthPnl).toFixed(2) + '</strong>' +
        ' &bull; ' + tradeDays + ' days';
    }

  } catch(e) {
    wrap.innerHTML = '<div style="color:var(--red);padding:16px;">Error: ' + e.message + '</div>';
  }
}

// ─── RIGHT TOP: Drawdown chart ────────────────────────────────────
async function _renderDrawdownChart() {
  var ctx = document.getElementById('calDrawdownChart');
  if (!ctx) return;
  if (_calCharts.drawdown) { _calCharts.drawdown.destroy(); }

  try {
    var data = await fetch('/api/analytics/drawdown').then(function(r){ return r.json(); });

    if (!data || data.length === 0) {
      ctx.parentElement.innerHTML = '<div class="empty-state"><p>No drawdown data</p></div>';
      return;
    }

    var labels = data.map(function(d){ return d.date; });
    var values = data.map(function(d){ return d.drawdown; });

    var gradCtx = ctx.getContext('2d');
    var gradient = gradCtx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(253,164,175,0.4)');
    gradient.addColorStop(1, 'rgba(253,164,175,0)');

    _calCharts.drawdown = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: '#6366f1',
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
              label: function(ctx) {
                var C = window.CURRENCY || '£';
                return '-' + C + Math.abs(ctx.parsed.y).toFixed(2);
              }
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
            ticks: {
              color: '#64748b',
              font: { size: 10, family: 'Inter' },
              callback: function(v) {
                var C = window.CURRENCY || '£';
                return '-' + C + Math.abs(v).toFixed(0);
              }
            }
          }
        }
      }
    });
  } catch(e) {
    if (ctx) ctx.parentElement.innerHTML = '<div class="empty-state"><p>Error loading drawdown</p></div>';
  }
}

// ─── RIGHT BOTTOM: Trade time scatter ────────────────────────────
async function _renderScatterChart() {
  var ctx = document.getElementById('calScatterChart');
  if (!ctx) return;
  if (_calCharts.scatter) { _calCharts.scatter.destroy(); }

  try {
    var results = await Promise.all([
      fetch('/api/analytics/pnl-by-hour').then(function(r){ return r.json(); }),
      fetch('/api/trades?limit=500').then(function(r){ return r.json(); }),
    ]);
    var hourData = results[0];
    var trades   = Array.isArray(results[1]) ? results[1] : [];

    if (trades.length === 0) {
      ctx.parentElement.innerHTML = '<div class="empty-state"><p>No trade data</p></div>';
      return;
    }

    // Plot individual trades as scatter
    var winDots  = [];
    var lossDots = [];

    trades.forEach(function(t) {
      if (!t.entry_time || t.net_pnl === null || t.net_pnl === undefined) return;
      var dt = new Date(t.entry_time);
      var hr = dt.getHours() + dt.getMinutes() / 60;
      var sizeRadius = Math.min(10, Math.max(3, (t.size || 1) * 0.5));
      var pt = { x: hr, y: t.net_pnl, r: sizeRadius };
      if (t.net_pnl >= 0) winDots.push(pt);
      else lossDots.push(pt);
    });

    _calCharts.scatter = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: 'Win',
            data: winDots,
            backgroundColor: 'rgba(16,185,129,0.5)',
            borderColor: '#10b981',
            borderWidth: 1,
          },
          {
            label: 'Loss',
            data: lossDots,
            backgroundColor: 'rgba(244,63,94,0.5)',
            borderColor: '#f43f5e',
            borderWidth: 1,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var C = window.CURRENCY || '£';
                var h = Math.floor(ctx.raw.x);
                var m = Math.round((ctx.raw.x - h) * 60);
                return h + ':' + String(m).padStart(2,'0') + ' — ' + (ctx.raw.y >= 0 ? '+' : '') + C + ctx.raw.y.toFixed(2);
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 24,
            grid: { color: '#1e293b' },
            ticks: {
              color: '#64748b',
              font: { size: 9, family: 'Inter' },
              stepSize: 2,
              callback: function(v) { return v + ':00'; }
            }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#64748b',
              font: { size: 9, family: 'Inter' },
              callback: function(v) {
                var C = window.CURRENCY || '£';
                return (v >= 0 ? '+' : '') + C + v.toFixed(0);
              }
            }
          }
        }
      }
    });
  } catch(e) {
    if (ctx) ctx.parentElement.innerHTML = '<div class="empty-state"><p>Error loading scatter</p></div>';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function _calDateStr(d) {
  return d.getFullYear() + '-' + _pad2(d.getMonth() + 1) + '-' + _pad2(d.getDate());
}

function _pad2(n) {
  return String(n).padStart(2, '0');
}
