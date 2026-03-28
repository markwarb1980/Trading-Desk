'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp } from 'lucide-react';

export default function Header() {
  const [currentTime, setCurrentTime] = useState('');
  const [istTime, setIstTime] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const now = new Date();

      // UTC time
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' UTC'
      );

      // IST time (UTC+5:30)
      setIstTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800 shadow-lg">
      {/* Top bar */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <div className="text-amber-400 font-bold text-sm tracking-wider leading-none">GS TRADING DESK</div>
                <div className="text-slate-500 text-xs leading-none mt-0.5">DAX · FTSE 100</div>
              </div>
            </div>
          </div>

          {/* Centre — market status */}
          <div className="hidden md:flex items-center gap-4">
            <SessionBadge />
          </div>

          {/* Right — clock */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
              <span>{today}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              {mounted && (
                <>
                  <span className="text-slate-300 font-medium tabular-nums">{currentTime}</span>
                  <span className="text-amber-400/80 tabular-nums">{istTime}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="status-dot live" />
              <span className="text-emerald-400 text-xs font-medium hidden sm:block">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session ticker */}
      <SessionTicker />
    </header>
  );
}

function SessionBadge() {
  const [sessions, setSessions] = useState<{ name: string; open: boolean }[]>([]);

  useEffect(() => {
    const checkSessions = () => {
      const now = new Date();
      const utcHour = now.getUTCHours();
      const utcMin = now.getUTCMinutes();
      const utcTotal = utcHour * 60 + utcMin;

      const sessionDefs = [
        { name: 'ASIA', start: 0 * 60, end: 9 * 60 + 30 },      // 00:00-09:30 UTC
        { name: 'LONDON', start: 8 * 60, end: 16 * 60 + 30 },    // 08:00-16:30 UTC
        { name: 'NEW YORK', start: 13 * 60 + 30, end: 21 * 60 }, // 13:30-21:00 UTC
      ];

      setSessions(
        sessionDefs.map((s) => ({
          name: s.name,
          open: utcTotal >= s.start && utcTotal < s.end,
        }))
      );
    };

    checkSessions();
    const interval = setInterval(checkSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {sessions.map((s) => (
        <div
          key={s.name}
          className={`px-2 py-1 rounded text-xs font-medium border ${
            s.open
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-600 border-slate-800'
          }`}
        >
          {s.open && <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse" />}
          {s.name}
        </div>
      ))}
    </div>
  );
}

function SessionTicker() {
  const sessions = [
    { name: 'ASIA', utc: '00:00-09:30', ist: '05:30-15:00' },
    { name: 'LONDON', utc: '08:00-16:30', ist: '13:30-22:00' },
    { name: 'NEW YORK', utc: '13:30-21:00', ist: '19:00-02:30+1' },
    { name: 'DAX PRE-MARKET', utc: '07:00-09:00', ist: '12:30-14:30' },
    { name: 'FTSE PRE-MARKET', utc: '07:00-08:00', ist: '12:30-13:30' },
    { name: 'NO-TRADE: 30min before HIGH-impact data', utc: '', ist: '' },
    { name: 'MAX STOP: DAX 120pts · FTSE 50pts', utc: '', ist: '' },
  ];

  const items = [...sessions, ...sessions]; // duplicate for seamless loop

  return (
    <div className="border-t border-slate-800/60 bg-slate-900/50">
      <div className="ticker-wrap py-1.5">
        <div className="ticker-content">
          {items.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2 mx-6 text-xs">
              <Activity className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
              <span className="text-amber-400/80 font-medium">{s.name}</span>
              {s.utc && (
                <>
                  <span className="text-slate-600">UTC {s.utc}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500">IST {s.ist}</span>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
