// Journal module
let journalEntryId = null;
let journalCurrentMood = null;
let journalSaveTimeout = null;

const MOODS = [
  { key: 'GREAT', emoji: '😊', label: 'GREAT' },
  { key: 'GOOD', emoji: '🙂', label: 'GOOD' },
  { key: 'NEUTRAL', emoji: '😐', label: 'NEUTRAL' },
  { key: 'BAD', emoji: '😟', label: 'BAD' },
  { key: 'TERRIBLE', emoji: '😣', label: 'TERRIBLE' },
];

const MOOD_COLORS = {
  GREAT: '#10b981',
  GOOD: '#3b82f6',
  NEUTRAL: '#94a3b8',
  BAD: '#f59e0b',
  TERRIBLE: '#f43f5e',
};

async function loadJournal() {
  const container = document.getElementById('section-journal');

  const today = new Date();
  const todayStr = formatDateLocal(today);
  const displayDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 320px; gap:16px; align-items:start;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <div>
              <div style="font-size:18px; font-weight:700; color:var(--text);">${displayDate}</div>
              <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Today's Journal</div>
            </div>
            <div id="journalStatus" style="font-size:11px; color:var(--text-dim);"></div>
          </div>

          <div style="margin-bottom:18px;">
            <div class="form-label" style="margin-bottom:10px;">How are you feeling today?</div>
            <div class="mood-selector" id="moodSelector">
              ${MOODS.map(m => `
                <button class="mood-btn" data-mood="${m.key}" title="${m.label}">
                  <span style="font-size:22px;">${m.emoji}</span>
                  <span>${m.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Journal Notes</label>
            <textarea class="form-control" id="journalNotes" rows="6" placeholder="What happened today? How did your trades go? What were you thinking?"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Mistakes &amp; Lessons</label>
            <textarea class="form-control" id="journalMistakes" rows="4" placeholder="What mistakes did you make? What did you learn?"></textarea>
          </div>

          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" id="journalClear">Clear</button>
            <button class="btn btn-primary" id="journalSave">Save Entry</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Mood History (Last 7 Days)</div>
          <div id="moodHistory"></div>
        </div>
        <div class="card">
          <div class="card-title">30-Day Mood Summary</div>
          <div id="moodSummary"></div>
        </div>
      </div>
    </div>
  `;

  // Mood button click
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      journalCurrentMood = btn.dataset.mood;
    });
  });

  // Auto-save on blur
  document.getElementById('journalNotes').addEventListener('blur', () => scheduleSave(todayStr));
  document.getElementById('journalMistakes').addEventListener('blur', () => scheduleSave(todayStr));

  // Save button
  document.getElementById('journalSave').addEventListener('click', () => saveJournalEntry(todayStr));

  // Clear button
  document.getElementById('journalClear').addEventListener('click', () => {
    document.getElementById('journalNotes').value = '';
    document.getElementById('journalMistakes').value = '';
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    journalCurrentMood = null;
    journalEntryId = null;
    setStatus('Cleared');
  });

  // Load today's entry and history
  await Promise.all([
    loadTodayEntry(todayStr),
    loadMoodHistory(),
    loadMoodSummary(),
  ]);
}

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function loadTodayEntry(todayStr) {
  try {
    const res = await fetch(`/api/journal/${todayStr}`);
    if (res.ok) {
      const entry = await res.json();
      journalEntryId = entry.id;
      journalCurrentMood = entry.mood;
      document.getElementById('journalNotes').value = entry.notes || '';
      document.getElementById('journalMistakes').value = entry.mistakes || '';
      if (entry.mood) {
        const btn = document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`);
        if (btn) btn.classList.add('selected');
      }
      setStatus('Entry loaded');
    }
  } catch (e) {
    // No entry yet — that's fine
  }
}

function scheduleSave(todayStr) {
  clearTimeout(journalSaveTimeout);
  journalSaveTimeout = setTimeout(() => saveJournalEntry(todayStr), 800);
}

async function saveJournalEntry(todayStr) {
  const notes = document.getElementById('journalNotes')?.value || '';
  const mistakes = document.getElementById('journalMistakes')?.value || '';

  const payload = {
    date: todayStr,
    mood: journalCurrentMood,
    notes,
    mistakes,
  };

  setStatus('Saving...');

  try {
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const entry = await res.json();
      journalEntryId = entry.id;
      setStatus('Saved ✓');
      setTimeout(() => setStatus(''), 2000);
      // Refresh mood history
      await loadMoodHistory();
      await loadMoodSummary();
    } else {
      const d = await res.json();
      setStatus('Save failed: ' + (d.detail || 'unknown error'));
    }
  } catch (e) {
    setStatus('Error: ' + e.message);
  }
}

function setStatus(msg) {
  const el = document.getElementById('journalStatus');
  if (el) el.textContent = msg;
}

async function loadMoodHistory() {
  const el = document.getElementById('moodHistory');
  if (!el) return;

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  const fromStr = formatDateLocal(from);
  const toStr = formatDateLocal(today);

  try {
    const entries = await fetch(`/api/journal?date_from=${fromStr}&date_to=${toStr}`).then(r => r.json());

    // Build last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(formatDateLocal(d));
    }

    const entryMap = {};
    entries.forEach(e => { entryMap[e.date] = e; });

    const dots = days.map(dateStr => {
      const entry = entryMap[dateStr];
      const mood = entry?.mood;
      const moodObj = MOODS.find(m => m.key === mood);
      const color = mood ? MOOD_COLORS[mood] : 'var(--border2)';
      const emoji = moodObj ? moodObj.emoji : '○';
      const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      return `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div class="mood-dot" style="background:${mood ? color + '20' : 'transparent'}; border-color:${color};" title="${mood || 'No entry'} - ${dateStr}">
            ${emoji}
          </div>
          <div style="font-size:9px; color:var(--text-dim);">${dayLabel}</div>
        </div>
      `;
    }).join('');

    el.innerHTML = `<div class="mood-history">${dots}</div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--text-dim); font-size:11px;">Could not load mood history</div>`;
  }
}

async function loadMoodSummary() {
  const el = document.getElementById('moodSummary');
  if (!el) return;

  try {
    const summary = await fetch('/api/journal/moods/summary').then(r => r.json());

    if (Object.keys(summary).length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim); font-size:12px; padding:8px 0;">No mood data yet</div>';
      return;
    }

    const total = Object.values(summary).reduce((a, b) => a + b, 0);

    el.innerHTML = MOODS.map(m => {
      const count = summary[m.key] || 0;
      if (count === 0) return '';
      const pct = Math.round(count / total * 100);
      const color = MOOD_COLORS[m.key];
      return `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-size:16px;">${m.emoji}</span>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
              <span style="color:var(--text-muted);">${m.label}</span>
              <span style="color:var(--text-dim);">${count} day${count !== 1 ? 's' : ''}</span>
            </div>
            <div style="height:4px; background:var(--surface2); border-radius:2px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${color}; border-radius:2px;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:var(--text-dim); font-size:11px;">Could not load mood summary</div>`;
  }
}
