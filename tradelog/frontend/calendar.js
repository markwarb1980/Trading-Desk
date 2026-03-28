// Calendar module
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

async function loadCalendar() {
  const container = document.getElementById('section-calendar');
  container.innerHTML = `
    <div class="card">
      <div class="calendar-header">
        <button class="calendar-nav" id="calPrev">&larr;</button>
        <div class="calendar-title" id="calTitle"></div>
        <button class="calendar-nav" id="calNext">&rarr;</button>
        <button class="calendar-nav" id="calToday" style="margin-left:8px;">Today</button>
      </div>
      <div class="calendar-grid" id="calGrid"></div>
      <div class="cal-summary" id="calSummary"></div>
    </div>
  `;

  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    renderCalendar();
  });

  document.getElementById('calToday').addEventListener('click', () => {
    calYear = new Date().getFullYear();
    calMonth = new Date().getMonth() + 1;
    renderCalendar();
  });

  await renderCalendar();
}

async function renderCalendar() {
  const title = document.getElementById('calTitle');
  const grid = document.getElementById('calGrid');
  const summary = document.getElementById('calSummary');
  if (!title || !grid) return;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = `${monthNames[calMonth - 1]} ${calYear}`;

  grid.innerHTML = '<div class="loading" style="grid-column:span 7">Loading...</div>';

  try {
    const data = await fetch(`/api/analytics/calendar?year=${calYear}&month=${calMonth}`).then(r => r.json());

    // Build lookup by date string
    const dayMap = {};
    data.forEach(d => { dayMap[d.date] = d; });

    // Build calendar grid
    const firstDay = new Date(calYear, calMonth - 1, 1);
    const lastDay = new Date(calYear, calMonth, 0);
    const totalDays = lastDay.getDate();

    // Day headers (Mon-Sun, Mon=0)
    const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let html = dayHeaders.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // First day offset (0=Mon..6=Sun)
    let startDow = firstDay.getDay(); // 0=Sun..6=Sat
    startDow = (startDow + 6) % 7;   // convert to Mon=0

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      html += '<div class="cal-day empty"></div>';
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    let monthTotalPnl = 0;
    let winDays = 0;
    let lossDays = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const info = dayMap[dateStr];
      const isToday = dateStr === todayStr;

      let cellClass = 'cal-day';
      if (isToday) cellClass += ' today';

      let pnlHTML = '<div class="cal-day-pnl" style="color:#475569;">—</div>';
      let countHTML = '';

      if (info) {
        const pnl = info.pnl;
        monthTotalPnl += pnl;
        if (pnl > 0) { cellClass += ' has-profit'; winDays++; }
        else if (pnl < 0) { cellClass += ' has-loss'; lossDays++; }

        const pnlColor = pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-dim)';
        const sign = pnl > 0 ? '+' : '';
        pnlHTML = `<div class="cal-day-pnl" style="color:${pnlColor}">${sign}$${Math.abs(pnl).toFixed(0)}</div>`;
        countHTML = `<div class="cal-day-count">${info.trade_count} trade${info.trade_count !== 1 ? 's' : ''}</div>`;
      }

      html += `
        <div class="${cellClass}">
          <div class="cal-day-num">${day}</div>
          ${pnlHTML}
          ${countHTML}
        </div>
      `;
    }

    grid.innerHTML = html;

    // Summary
    const totalPnlColor = monthTotalPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const sign = monthTotalPnl >= 0 ? '+' : '';
    summary.innerHTML = `
      <div class="cal-summary-item">
        <div class="cal-summary-label">Monthly P&L</div>
        <div class="cal-summary-value" style="color:${totalPnlColor}">${sign}$${Math.abs(monthTotalPnl).toFixed(2)}</div>
      </div>
      <div class="cal-summary-item">
        <div class="cal-summary-label">Win Days</div>
        <div class="cal-summary-value" style="color:var(--green)">${winDays}</div>
      </div>
      <div class="cal-summary-item">
        <div class="cal-summary-label">Loss Days</div>
        <div class="cal-summary-value" style="color:var(--red)">${lossDays}</div>
      </div>
      <div class="cal-summary-item">
        <div class="cal-summary-label">Trading Days</div>
        <div class="cal-summary-value">${winDays + lossDays}</div>
      </div>
    `;

  } catch (e) {
    grid.innerHTML = `<div style="grid-column:span 7; padding:20px; color:var(--red);">Error loading calendar: ${e.message}</div>`;
  }
}
