// Dashboard module
let dashboardCharts = {};

async function loadDashboard() {
  const container = document.getElementById('section-dashboard');
  container.innerHTML = '<div class="loading">Loading dashboard...</div>';

  try {
    const [summary, dow, equity, recentTrades] = await Promise.all([
      fetch('/api/analytics/summary').then(r => r.json()),
      fetch('/api/analytics/pnl-by-dow').then(r => r.json()),
      fetch('/api/analytics/equity-curve').then(r => r.json()),
      fetch('/api/trades?limit=5').then(r => r.json()),
    ]);

    container.innerHTML = buildDashboardHTML();
    renderMetrics(summary);
    renderDowChart(dow);
    renderEquityCurve(equity);
    renderRecentTrades(recentTrades);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Failed to load dashboard: ${e.message}</p></div>`;
  }
}

function buildDashboardHTML() {
  return `
    <div id="dash-metrics" class="metrics-grid"></div>
    <div class="charts-grid">
      <div class="card">
        <div class="card-title">P&amp;L by Day of Week</div>
        <div class="chart-container"><canvas id="dowChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Equity Curve</div>
        <div class="chart-container"><canvas id="equityChart"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Recent Trades</div>
      <div id="dash-recent-trades"></div>
    </div>
  `;
}

function renderMetrics(s) {
  const pnlClass = s.total_pnl >= 0 ? 'positive' : 'negative';
  const ddClass = s.max_drawdown < 0 ? 'negative' : '';
  const streakClass = s.current_streak > 0 ? 'positive' : s.current_streak < 0 ? 'negative' : '';
  const streakLabel = s.current_streak > 0 ? `+${s.current_streak}` : `${s.current_streak}`;

  const metrics = [
    { label: 'Total P&L', value: fmtMoney(s.total_pnl), cls: pnlClass },
    { label: 'Win Rate', value: `${s.win_rate}%`, cls: s.win_rate >= 50 ? 'positive' : 'negative' },
    { label: 'Profit Factor', value: fmtNum(s.profit_factor), cls: s.profit_factor >= 1 ? 'positive' : 'negative' },
    { label: 'Total Trades', value: s.total_trades, cls: '' },
    { label: 'Avg R-Multiple', value: s.avg_r !== null ? fmtNum(s.avg_r) + 'R' : 'N/A', cls: s.avg_r >= 0 ? 'positive' : 'negative' },
    { label: 'Max Drawdown', value: fmtMoney(s.max_drawdown), cls: ddClass },
    { label: 'Current Streak', value: streakLabel, cls: streakClass },
    { label: 'Avg Win', value: fmtMoney(s.avg_win), cls: 'positive' },
  ];

  document.getElementById('dash-metrics').innerHTML = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value ${m.cls}">${m.value}</div>
    </div>
  `).join('');
}

function renderDowChart(data) {
  const ctx = document.getElementById('dowChart');
  if (!ctx) return;

  if (dashboardCharts.dow) { dashboardCharts.dow.destroy(); }

  const labels = data.map(d => d.label);
  const values = data.map(d => d.pnl);
  const colors = values.map(v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)');
  const borders = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

  dashboardCharts.dow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
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
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => fmtMoney(ctx.parsed.y),
          }
        }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono' } } },
        y: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono' },
            callback: v => fmtMoney(v),
          }
        }
      }
    }
  });
}

function renderEquityCurve(data) {
  const ctx = document.getElementById('equityChart');
  if (!ctx) return;

  if (dashboardCharts.equity) { dashboardCharts.equity.destroy(); }

  if (!data || data.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No equity data yet</p></div>';
    return;
  }

  dashboardCharts.equity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Cumulative P&L',
        data: data.map(d => d.cumulative_pnl),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: data.length > 60 ? 0 : 3,
        pointBackgroundColor: '#10b981',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => fmtMoney(ctx.parsed.y),
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono', size: 10 },
            maxTicksLimit: 8,
          }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono' },
            callback: v => fmtMoney(v),
          }
        }
      }
    }
  });
}

function renderRecentTrades(trades) {
  const el = document.getElementById('dash-recent-trades');
  if (!el) return;

  if (!trades || trades.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No trades yet. Import a CSV or add trades manually.</p></div>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Date</th><th>Symbol</th><th>Direction</th><th>P&amp;L</th><th>Net P&amp;L</th>
      </tr></thead>
      <tbody>
        ${trades.map(t => `
          <tr onclick="showSection('trades')">
            <td>${fmtDate(t.entry_time)}</td>
            <td class="text">${t.symbol}</td>
            <td><span class="badge badge-${t.direction.toLowerCase()}">${t.direction}</span></td>
            <td class="${colorClass(t.pnl)}">${fmtMoney(t.pnl)}</td>
            <td class="${colorClass(t.net_pnl)}">${fmtMoney(t.net_pnl)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Shared helpers (used across all modules)
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v >= 0 ? '+' : '';
  return sign + '$' + Math.abs(v).toFixed(2);
}

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(2);
}

function fmtDate(dt) {
  if (!dt) return '—';
  return dt.substring(0, 10);
}

function colorClass(v) {
  if (v === null || v === undefined) return '';
  return v >= 0 ? 'positive' : 'negative';
}
