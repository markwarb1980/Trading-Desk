// Reports module
let reportCharts = {};

async function loadReports() {
  const container = document.getElementById('section-reports');
  container.innerHTML = `
    <div class="charts-grid" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">P&amp;L by Symbol</div>
        <div class="chart-container" style="height:300px;"><canvas id="symbolChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">P&amp;L by Hour of Day</div>
        <div class="chart-container" style="height:300px;"><canvas id="hourChart"></canvas></div>
      </div>
    </div>
    <div class="charts-grid" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">Best Symbols</div>
        <div id="bestSymbols"></div>
      </div>
      <div class="card">
        <div class="card-title">Worst Symbols</div>
        <div id="worstSymbols"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Detailed Statistics</div>
      <div id="statsTable"></div>
    </div>
  `;

  try {
    const [bySymbol, byHour, summary] = await Promise.all([
      fetch('/api/analytics/pnl-by-symbol').then(r => r.json()),
      fetch('/api/analytics/pnl-by-hour').then(r => r.json()),
      fetch('/api/analytics/summary').then(r => r.json()),
    ]);

    renderSymbolChart(bySymbol);
    renderHourChart(byHour);
    renderTopSymbols(bySymbol);
    renderStatsTable(summary);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load reports: ${e.message}</p></div>`;
  }
}

function renderSymbolChart(data) {
  const ctx = document.getElementById('symbolChart');
  if (!ctx) return;
  if (reportCharts.symbol) reportCharts.symbol.destroy();

  if (!data || data.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  const sorted = [...data].sort((a, b) => a.pnl - b.pnl);
  const labels = sorted.map(d => d.symbol);
  const values = sorted.map(d => d.pnl);
  const colors = values.map(v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)');

  reportCharts.symbol = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'P&L',
        data: values,
        backgroundColor: colors,
        borderColor: colors,
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
            label: ctx => fmtMoney(ctx.parsed.x) + ` (${data.find(d=>d.symbol===ctx.label)?.trade_count || 0} trades)`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono' }, callback: v => fmtMoney(v) }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
        }
      }
    }
  });
}

function renderHourChart(data) {
  const ctx = document.getElementById('hourChart');
  if (!ctx) return;
  if (reportCharts.hour) reportCharts.hour.destroy();

  const active = data.filter(d => d.trade_count > 0);
  if (active.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  const labels = data.map(d => `${String(d.hour).padStart(2,'0')}:00`);
  const values = data.map(d => d.pnl);
  const colors = values.map(v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)');

  reportCharts.hour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'P&L',
        data: values,
        backgroundColor: colors,
        borderColor: colors,
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
            label: ctx => {
              const h = data[ctx.dataIndex];
              return `${fmtMoney(ctx.parsed.y)} | WR: ${h.win_rate}% | ${h.trade_count} trades`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono', size: 9 },
            maxRotation: 45,
          }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono' }, callback: v => fmtMoney(v) }
        }
      }
    }
  });
}

function renderTopSymbols(data) {
  if (!data || data.length === 0) {
    document.getElementById('bestSymbols').innerHTML = '<div class="empty-state"><p>No data</p></div>';
    document.getElementById('worstSymbols').innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  const sorted = [...data].sort((a, b) => b.pnl - a.pnl);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  function symbolRow(s) {
    const pnlColor = s.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const sign = s.pnl >= 0 ? '+' : '';
    return `
      <div style="display:flex; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); gap:12px;">
        <div style="font-weight:700; font-size:14px; min-width:80px;">${s.symbol}</div>
        <div style="color:${pnlColor}; font-weight:700;">${sign}$${Math.abs(s.pnl).toFixed(2)}</div>
        <div style="color:var(--text-dim); font-size:11px; margin-left:auto;">${s.trade_count} trades &bull; WR ${s.win_rate}%</div>
      </div>
    `;
  }

  document.getElementById('bestSymbols').innerHTML = best.length > 0
    ? best.map(symbolRow).join('')
    : '<div class="empty-state"><p>No profitable symbols</p></div>';

  document.getElementById('worstSymbols').innerHTML = worst.length > 0
    ? worst.map(symbolRow).join('')
    : '<div class="empty-state"><p>No losing symbols</p></div>';
}

function renderStatsTable(s) {
  const el = document.getElementById('statsTable');
  if (!el) return;

  const rows = [
    ['Total Trades', s.total_trades],
    ['Total Net P&L', fmtMoney(s.total_pnl)],
    ['Win Rate', `${s.win_rate}%`],
    ['Profit Factor', fmtNum(s.profit_factor)],
    ['Avg Win', fmtMoney(s.avg_win)],
    ['Avg Loss', fmtMoney(s.avg_loss)],
    ['Avg R-Multiple', s.avg_r !== null ? fmtNum(s.avg_r) + 'R' : 'N/A'],
    ['Max Drawdown', fmtMoney(s.max_drawdown)],
    ['Best Day', s.best_day || '—'],
    ['Worst Day', s.worst_day || '—'],
    ['Current Streak', s.current_streak > 0 ? `+${s.current_streak} wins` : s.current_streak < 0 ? `${s.current_streak} losses` : '0'],
  ];

  el.innerHTML = `
    <table>
      <tbody>
        ${rows.map(([label, value]) => `
          <tr>
            <td style="color:var(--text-dim); width:200px;">${label}</td>
            <td class="text" style="font-weight:600;">${value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
