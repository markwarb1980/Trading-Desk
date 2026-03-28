'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Newspaper, Calendar, RefreshCw, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Minus, Ban, Globe,
} from 'lucide-react';

interface Headline {
  title: string;
  source: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  summary: string;
  time_ago: string;
}

interface CalendarEvent {
  time_utc: string;
  time_ist: string;
  date: string;
  event: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast: string;
  previous: string;
  no_trade_window: boolean;
}

interface SessionStatus {
  current_time_ist: string;
  active_sessions: string[];
  next_session: string;
  no_trade_active: boolean;
}

interface NewsData {
  headlines: Headline[];
  calendar: CalendarEvent[];
  session_status: SessionStatus;
  market_mood: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  timestamp: string;
}

function ImpactDot({ impact }: { impact: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const map = {
    HIGH: 'bg-rose-500 shadow-rose-500/70',
    MEDIUM: 'bg-amber-500 shadow-amber-500/70',
    LOW: 'bg-emerald-600',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${map[impact]}`}
      title={impact}
    />
  );
}

function DirectionIcon({ direction }: { direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' }) {
  if (direction === 'BULLISH') return <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
  if (direction === 'BEARISH') return <TrendingDown className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
}

function MoodBadge({ mood }: { mood: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' }) {
  const cfg = {
    RISK_ON: 'text-emerald-400 bg-emerald-950 border-emerald-800',
    RISK_OFF: 'text-rose-400 bg-rose-950 border-rose-800',
    NEUTRAL: 'text-slate-400 bg-slate-800 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold ${cfg[mood]}`}>
      {mood.replace('_', '-')}
    </span>
  );
}

function SessionClocks() {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const zones: Record<string, string> = {
        'IST': 'Asia/Kolkata',
        'LON': 'Europe/London',
        'NYC': 'America/New_York',
        'UTC': 'UTC',
      };
      const result: Record<string, string> = {};
      for (const [label, tz] of Object.entries(zones)) {
        result[label] = now.toLocaleTimeString('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      setTimes(result);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  // Check active sessions
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcTotal = utcH * 60 + utcM;

  const isLondonOpen = utcTotal >= 8 * 60 && utcTotal < 16 * 60 + 30;
  const isNYOpen = utcTotal >= 13 * 60 + 30 && utcTotal < 21 * 60;
  const isAsiaOpen = utcTotal < 9 * 60 + 30 || utcTotal >= 23 * 60;

  const sessionMap = [
    { key: 'IST', label: 'IST', session: 'local' },
    { key: 'LON', label: 'LON', active: isLondonOpen },
    { key: 'NYC', label: 'NYC', active: isNYOpen },
    { key: 'UTC', label: 'UTC', session: 'utc' },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {sessionMap.map(({ key, label, active }) => (
        <div
          key={key}
          className={`rounded p-2 text-center border transition-colors ${
            active
              ? 'bg-emerald-950/50 border-emerald-800/50'
              : 'bg-slate-800/40 border-slate-800/40'
          }`}
        >
          <div className="text-xs text-slate-500">{label}</div>
          <div className={`text-xs font-bold tabular-nums mt-0.5 ${active ? 'text-emerald-400' : 'text-slate-400'}`}>
            {times[key] || '--:--'}
          </div>
          {active && (
            <div className="w-1 h-1 bg-emerald-400 rounded-full mx-auto mt-1 animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NewsCalendar() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'news' | 'calendar'>('news');
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json: NewsData = await res.json();
      setData(json);
      setLastFetched(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="card flex flex-col">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">NEWS & CALENDAR</span>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-xs text-slate-600 hidden sm:block">{lastFetched}</span>
          )}
          {data?.market_mood && <MoodBadge mood={data.market_mood} />}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Session clocks */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Session Times
          </div>
          <SessionClocks />
        </div>

        {/* No-trade warning */}
        {data?.session_status?.no_trade_active && (
          <div className="flex items-center gap-2 p-2.5 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs animate-pulse-slow">
            <Ban className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">NO-TRADE WINDOW ACTIVE — High-impact event nearby</span>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded">
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'news'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            Headlines
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-800 rounded" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !data && !error && (
          <div className="text-center py-8 space-y-2">
            <Globe className="w-10 h-10 text-slate-700 mx-auto" />
            <div className="text-slate-500 text-sm">
              Click <RefreshCw className="w-3 h-3 inline" /> to fetch live news and calendar
            </div>
          </div>
        )}

        {/* News tab */}
        {!loading && data && activeTab === 'news' && (
          <div className="space-y-2 animate-fade-in">
            {(!data.headlines || data.headlines.length === 0) && (
              <div className="text-center text-slate-500 text-sm py-4">No headlines available</div>
            )}
            {data.headlines?.map((h, i) => (
              <div
                key={i}
                className={`p-3 rounded border transition-colors ${
                  h.impact === 'HIGH'
                    ? 'bg-rose-950/20 border-rose-900/30'
                    : h.impact === 'MEDIUM'
                    ? 'bg-amber-950/20 border-amber-900/30'
                    : 'bg-slate-800/30 border-slate-800/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <ImpactDot impact={h.impact} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200 leading-snug">{h.title}</p>
                      <DirectionIcon direction={h.direction} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{h.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-slate-600">{h.source}</span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-600">{h.time_ago}</span>
                      <span className={`ml-auto text-xs font-medium ${
                        h.impact === 'HIGH' ? 'text-rose-500' : h.impact === 'MEDIUM' ? 'text-amber-500' : 'text-slate-600'
                      }`}>
                        {h.impact}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calendar tab */}
        {!loading && data && activeTab === 'calendar' && (
          <div className="space-y-2 animate-fade-in">
            {(!data.calendar || data.calendar.length === 0) && (
              <div className="text-center text-slate-500 text-sm py-4">No events in calendar</div>
            )}
            {data.calendar?.map((ev, i) => (
              <div
                key={i}
                className={`p-3 rounded border ${
                  ev.no_trade_window
                    ? 'bg-rose-950/30 border-rose-800/60'
                    : ev.impact === 'HIGH'
                    ? 'bg-amber-950/20 border-amber-900/30'
                    : 'bg-slate-800/30 border-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ImpactDot impact={ev.impact} />
                    <span className="text-xs font-semibold text-slate-200">{ev.event}</span>
                    {ev.no_trade_window && (
                      <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-950 border border-rose-800 px-1.5 py-0.5 rounded">
                        <Ban className="w-2.5 h-2.5" /> NO TRADE
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    ev.currency === 'USD' ? 'text-sky-400 bg-sky-950' :
                    ev.currency === 'GBP' ? 'text-emerald-400 bg-emerald-950' :
                    ev.currency === 'EUR' ? 'text-blue-400 bg-blue-950' :
                    'text-slate-400 bg-slate-800'
                  }`}>
                    {ev.currency}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {ev.time_ist} IST
                  </span>
                  <span className="text-slate-700">·</span>
                  <span>{ev.time_utc} UTC</span>
                  <span className="text-slate-700">·</span>
                  <span>{ev.date}</span>
                </div>
                {(ev.forecast !== 'N/A' || ev.previous !== 'N/A') && (
                  <div className="flex gap-3 mt-1.5 text-xs">
                    {ev.forecast !== 'N/A' && (
                      <span><span className="text-slate-600">Fcst: </span><span className="text-slate-300">{ev.forecast}</span></span>
                    )}
                    {ev.previous !== 'N/A' && (
                      <span><span className="text-slate-600">Prev: </span><span className="text-slate-400">{ev.previous}</span></span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
