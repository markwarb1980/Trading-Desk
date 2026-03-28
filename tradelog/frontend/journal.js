// Journal module — TradeZella-style
'use strict';

var _journalEntryId    = null;
var _journalMood       = null;
var _journalSaveTimer  = null;
var _journalMoodCharts = {};
var _journalViewDate   = null;  // null = today

var MOODS = [
  { key: 'GREAT',    emoji: '😊', label: 'Great',    cls: 'selected-great'    },
  { key: 'GOOD',     emoji: '🙂', label: 'Good',     cls: 'selected-good'     },
  { key: 'NEUTRAL',  emoji: '😐', label: 'Neutral',  cls: 'selected-neutral'  },
  { key: 'BAD',      emoji: '😟', label: 'Bad',      cls: 'selected-bad'      },
  { key: 'TERRIBLE', emoji: '😣', label: 'Terrible', cls: 'selected-terrible' },
];

var MOOD_COLORS = {
  GREAT:    '#10b981',
  GOOD:     '#3b82f6',
  NEUTRAL:  '#94a3b8',
  BAD:      '#f59e0b',
  TERRIBLE: '#f43f5e',
};

window.loadJournal = async function loadJournal() {
  var container = document.getElementById('section-journal');

  var today       = new Date();
  var todayStr    = _jDateStr(today);
  _journalViewDate = todayStr;

  var displayDate = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  container.innerHTML = [
    '<div style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start;">',

      // LEFT: today's entry editor
      '<div>',
        '<div class="card" style="margin-bottom:16px;">',
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">',
            '<div>',
              '<div style="font-size:17px;font-weight:700;color:var(--text);" id="jDateDisplay">' + displayDate + '</div>',
              '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Trading Journal</div>',
            '</div>',
            '<div id="jStatus" style="font-size:11px;color:var(--text-muted);"></div>',
          '</div>',

          // Mood row
          '<div style="margin-bottom:18px;">',
            '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);margin-bottom:10px;">How are you feeling today?</div>',
            '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="jMoodRow">',
              MOODS.map(function(m) {
                return '<button class="mood-btn" data-mood="' + m.key + '">' +
                  '<span class="mood-emoji">' + m.emoji + '</span>' +
                  '<span class="mood-label">' + m.label + '</span>' +
                '</button>';
              }).join(''),
            '</div>',
          '</div>',

          // Notes
          '<div class="form-group">',
            '<label class="form-label">Notes &amp; Observations</label>',
            '<textarea class="form-control" id="jNotes" rows="6" placeholder="What went well today? Key observations, market insights, what you executed well..."></textarea>',
          '</div>',

          // Mistakes
          '<div class="form-group">',
            '<label class="form-label">Mistakes &amp; Lessons</label>',
            '<textarea class="form-control" id="jMistakes" rows="4" placeholder="What mistakes did I make? What to avoid? What will I do differently?"></textarea>',
          '</div>',

          '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;">',
            '<span id="jAutoSaveHint" style="font-size:10px;color:var(--text-muted);">Auto-saves on blur</span>',
            '<button class="btn btn-secondary btn-sm" id="jClearBtn">Clear</button>',
            '<button class="btn btn-primary" id="jSaveBtn">Save Entry</button>',
          '</div>',
        '</div>',
      '</div>',

      // RIGHT column
      '<div>',
        // Mood history (last 7 days)
        '<div class="card" style="margin-bottom:16px;">',
          '<div class="card-title">Mood History — Last 7 Days</div>',
          '<div id="jMoodHistory"></div>',
        '</div>',

        // Mood distribution (last 30 days)
        '<div class="card">',
          '<div class="card-title">Mood Distribution — Last 30 Days</div>',
          '<div style="position:relative;height:160px;"><canvas id="jMoodChart"></canvas></div>',
        '</div>',
      '</div>',

    '</div>',
  ].join('');

  // Mood button clicks
  document.querySelectorAll('#jMoodRow .mood-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _selectMood(btn.dataset.mood);
    });
  });

  // Auto-save on blur
  document.getElementById('jNotes').addEventListener('blur', function() {
    _scheduleJournalSave(todayStr);
  });
  document.getElementById('jMistakes').addEventListener('blur', function() {
    _scheduleJournalSave(todayStr);
  });

  // Save button
  document.getElementById('jSaveBtn').addEventListener('click', function() {
    _saveJournalEntry(todayStr);
  });

  // Clear button
  document.getElementById('jClearBtn').addEventListener('click', function() {
    document.getElementById('jNotes').value    = '';
    document.getElementById('jMistakes').value = '';
    _selectMood(null);
    _journalEntryId = null;
    _setJStatus('Cleared');
  });

  // Load data
  await Promise.all([
    _loadJournalEntry(todayStr),
    _loadMoodHistory(),
    _loadMoodDistribution(),
  ]);
};

// ─── Mood selection ───────────────────────────────────────────────
function _selectMood(key) {
  _journalMood = key;
  document.querySelectorAll('#jMoodRow .mood-btn').forEach(function(btn) {
    var moodObj = MOODS.find(function(m){ return m.key === btn.dataset.mood; });
    // Remove all selected classes
    MOODS.forEach(function(m){ btn.classList.remove(m.cls); });
    if (key && btn.dataset.mood === key && moodObj) {
      btn.classList.add(moodObj.cls);
    }
  });
}

// ─── Load existing entry ──────────────────────────────────────────
async function _loadJournalEntry(dateStr) {
  try {
    var res = await fetch('/api/journal/' + dateStr);
    if (res.ok) {
      var entry = await res.json();
      _journalEntryId = entry.id;
      document.getElementById('jNotes').value    = entry.notes    || '';
      document.getElementById('jMistakes').value = entry.mistakes || '';
      if (entry.mood) _selectMood(entry.mood);
      _setJStatus('Entry loaded');
    }
  } catch(e) {
    // No entry yet — fine
  }
}

// ─── Auto-save scheduling ─────────────────────────────────────────
function _scheduleJournalSave(dateStr) {
  clearTimeout(_journalSaveTimer);
  _journalSaveTimer = setTimeout(function() { _saveJournalEntry(dateStr); }, 800);
}

// ─── Save entry ───────────────────────────────────────────────────
async function _saveJournalEntry(dateStr) {
  var notes    = (document.getElementById('jNotes')    || {}).value || '';
  var mistakes = (document.getElementById('jMistakes') || {}).value || '';

  var payload = {
    date:     dateStr,
    mood:     _journalMood,
    notes:    notes,
    mistakes: mistakes,
  };

  _setJStatus('Saving...');

  try {
    var res = await fetch('/api/journal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (res.ok) {
      var entry = await res.json();
      _journalEntryId = entry.id;
      _setJStatus('Saved ✓');
      setTimeout(function(){ _setJStatus(''); }, 2500);
      _loadMoodHistory();
      _loadMoodDistribution();
    } else {
      var d = await res.json();
      _setJStatus('Error: ' + (d.detail || 'failed'));
    }
  } catch(e) {
    _setJStatus('Error: ' + e.message);
  }
}

function _setJStatus(msg) {
  var el = document.getElementById('jStatus');
  if (el) el.textContent = msg;
}

// ─── Mood History (last 7 days) ───────────────────────────────────
async function _loadMoodHistory() {
  var el = document.getElementById('jMoodHistory');
  if (!el) return;

  var today = new Date();
  var from  = new Date(today);
  from.setDate(from.getDate() - 6);
  var fromStr = _jDateStr(from);
  var toStr   = _jDateStr(today);

  try {
    var entries = await fetch('/api/journal?date_from=' + fromStr + '&date_to=' + toStr).then(function(r){ return r.json(); });

    var entryMap = {};
    if (Array.isArray(entries)) {
      entries.forEach(function(e){ entryMap[e.date] = e; });
    }

    // Last 7 days, newest on right
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    var dotsHTML = days.map(function(d) {
      var dateStr = _jDateStr(d);
      var entry   = entryMap[dateStr];
      var mood    = entry ? entry.mood : null;
      var moodObj = MOODS.find(function(m){ return m.key === mood; });
      var color   = mood ? MOOD_COLORS[mood] : '#334155';
      var emoji   = moodObj ? moodObj.emoji : '·';
      var dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
      var dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      var isToday  = dateStr === _jDateStr(new Date());

      return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" ' +
               'title="' + dateLabel + (mood ? ': ' + mood : '') + '" ' +
               'onclick="_viewJournalDate(\'' + dateStr + '\')">' +
        '<div style="' +
          'width:36px;height:36px;border-radius:50%;' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:17px;' +
          'background:' + (mood ? color + '20' : 'transparent') + ';' +
          'border:2px solid ' + color + ';' +
          (isToday ? 'box-shadow:0 0 0 2px ' + color + '40;' : '') +
        '">' + emoji + '</div>' +
        '<div style="font-size:9px;color:var(--text-muted);">' + dayLabel + '</div>' +
      '</div>';
    }).join('');

    el.innerHTML = '<div style="display:flex;justify-content:space-between;padding:4px 0;">' + dotsHTML + '</div>';

  } catch(e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px 0;">Could not load mood history</div>';
  }
}

// Allow clicking a day in mood history to view that day's entry
window._viewJournalDate = async function(dateStr) {
  var today = new Date();
  var todayStr = _jDateStr(today);

  if (dateStr === todayStr) {
    // Already on today
    return;
  }

  // Update date display
  var displayEl = document.getElementById('jDateDisplay');
  if (displayEl) {
    var d = new Date(dateStr + 'T12:00:00');
    displayEl.textContent = d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Clear and load
  document.getElementById('jNotes').value    = '';
  document.getElementById('jMistakes').value = '';
  _selectMood(null);
  _journalEntryId = null;
  _journalViewDate = dateStr;

  await _loadJournalEntry(dateStr);
};

// ─── Mood Distribution chart (last 30 days) ───────────────────────
async function _loadMoodDistribution() {
  var ctx = document.getElementById('jMoodChart');
  if (!ctx) return;
  if (_journalMoodCharts.dist) { _journalMoodCharts.dist.destroy(); }

  try {
    var summary = await fetch('/api/journal/moods/summary').then(function(r){ return r.json(); });

    var counts = MOODS.map(function(m){ return summary[m.key] || 0; });
    var colors = MOODS.map(function(m){ return MOOD_COLORS[m.key]; });
    var labels = MOODS.map(function(m){ return m.emoji + ' ' + m.label; });

    var total = counts.reduce(function(a,b){ return a+b; }, 0);

    if (total === 0) {
      ctx.parentElement.innerHTML = '<div class="empty-state"><p>No mood data yet</p></div>';
      return;
    }

    _journalMoodCharts.dist = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors.map(function(c){ return c + 'aa'; }),
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
              label: function(ctx) {
                var pct = total > 0 ? Math.round(ctx.parsed.y / total * 100) : 0;
                return ctx.parsed.y + ' day' + (ctx.parsed.y !== 1 ? 's' : '') + ' (' + pct + '%)';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'transparent' },
            ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#64748b',
              font: { size: 10, family: 'Inter' },
              stepSize: 1,
            }
          }
        }
      }
    });

  } catch(e) {
    if (ctx) ctx.parentElement.innerHTML = '<div class="empty-state"><p>Could not load mood data</p></div>';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function _jDateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
