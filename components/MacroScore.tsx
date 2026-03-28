'use client';

import { useState, useCallback } from 'react';
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus,
  Shield, Building2, BarChart3, Newspaper, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import type { MacroData } from '@/app/page';

interface Props {
  onDataUpdate?: (data: MacroData) => void;
}

const SCORE_GROUPS = [
  {
    key: 'geopolitical_risk' as const,
    label: 'Geopolitical / Risk',
    max: 3,
    icon: Shield,
    positiveLabel: 'Risk-ON',
    negativeLabel: 'Risk-OFF',
  },
  {
    key: 'central_banks' as const,
    label: 'Central Banks',
    max: 2,
    icon: Building2,
    positiveLabel: 'Dovish',
    negativeLabel: 'Hawkish',
  },
  {
    key: 'market_direction' as const,
    label: 'Market Direction',
    max: 3,
    icon: BarChart3,
    positiveLabel: 'Bullish',
    negativeLabel: 'Bearish',
  },
  {
    key: 'news_adjustment' as const,
    label: 'News Adjustment',
    max: 2,
    icon: Newspaper,
    positiveLabel: 'Positive',
    negativeLabel: 'Negative',
  },
];

function scoreColor(score: number) {
  if (score > 0) return 'text-emerald-400';
  if (score < 0) return 'text-rose-400';
  return 'text-slate-400';
}

function directionConfig(direction: string) {
  if (direction === 'LONG') return {
    bg: 'bg-emerald-950',
    border: 'border-emerald-700',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-900/50',
    icon: TrendingUp,
  };
  if (direction === 'SHORT') return {
    bg: 'bg-rose-950',
    border: 'border-rose-700',
    text: 'text-rose-400',
    glow: 'shadow-rose-900/50',
    icon: TrendingDown,
  };
  return {
    bg: 'bg-slate-800',
    border: 'border-slate-600',
    text: 'text-slate-400',
    glow: '',
    icon: Minus,
  };
}

function tierLabel(tier: number | string, direction: string, totalScore: number) {
  const abs = Math.abs(totalScore);
  if (direction === 'NO TRADE' || tier === 'NO TRADE' || abs < 4) return null;
  const n = Number(tier);
  if (n === 1 || abs >= 6) return {
    label: 'TIER 1', color: 'text-amber-400 bg-amber-950 border-amber-700',
    desc: 'Full size — 1% account risk', sub: 'Partial close 1.5R · Runner to 2R with BE stop'
  };
  return {
    label: 'TIER 2', color: 'text-sky-400 bg-sky-950 border-sky-700',
    desc: 'Half size — 0.5% account risk · KEY level required',
    sub: 'Close ALL at 1.5R — no runner on Tier 2'
  };
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = (Math.abs(score) / max) * 100;
  const isPos = score >= 0;
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Negative side */}
      <div className="flex-1 flex justify-end">
        <div className="w-full bg-slate-800 rounded-l h-2 overflow-hidden">
          <div
            className={`h-full rounded-l ml-auto transition-all duration-700 ${!isPos ? 'bg-rose-500' : ''}`}
            style={{ width: !isPos ? `${pct}%` : '0%' }}
          />
        </div>
      </div>
      {/* Centre marker */}
      <div className="w-0.5 h-4 bg-slate-600 flex-shrink-0" />
      {/* Positive side */}
      <div className="flex-1">
        <div className="w-full bg-slate-800 rounded-r h-2 overflow-hidden">
          <div
            className={`h-full rounded-r transition-all duration-700 ${isPos ? 'bg-emerald-500' : ''}`}
            style={{ width: isPos ? `${pct}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function MacroScore({ onDataUpdate }: Props) {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/macro-score', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json: MacroData = await res.json();
      setData(json);
      onDataUpdate?.(json);
      setLastFetched(new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
      }) + ' UTC');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch macro score');
    } finally {
      setLoading(false);
    }
  }, [onDataUpdate]);

  const dir = data ? directionConfig(data.direction) : null;
  const tier = data ? tierLabel(data.tier, data.direction, data.total_score) : null;
  const tradeable = data ? Math.abs(data.total_score) >= 4 : false;

  return (
    <div className="card h-full">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">AUTO MACRO SCORE</span>
          <span className="text-xs text-slate-600 hidden sm:block">— AI + Web Search</span>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-xs text-slate-600 hidden sm:block">{lastFetched}</span>
          )}
          <button
            onClick={fetchScore}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 disabled:text-slate-500 rounded text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'ANALYSING...' : 'RUN ANALYSIS'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-slate-800 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-800 rounded" />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-12 space-y-3">
            <Brain className="w-12 h-12 text-slate-700 mx-auto" />
            <div className="text-slate-500 text-sm">
              Click <span className="text-amber-400 font-semibold">RUN ANALYSIS</span> to fetch live market data
              <br />and calculate the macro trading score.
            </div>
            <div className="text-slate-600 text-xs">
              Uses Claude AI + Web Search for real-time analysis
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && data && dir && (
          <div className="space-y-4 animate-slide-up">
            {/* Main score display */}
            <div className={`rounded-xl border-2 ${dir.border} ${dir.bg} p-4 shadow-xl ${dir.glow} shadow-lg`}>
              <div className="flex items-center justify-between">
                {/* Score */}
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Score</div>
                  <div className={`text-6xl font-bold tabular-nums leading-none ${dir.text}`}>
                    {data.total_score > 0 ? '+' : ''}{data.total_score}
                    <span className="text-2xl text-slate-600">/8</span>
                  </div>
                </div>

                {/* Direction */}
                <div className="text-right">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Direction</div>
                  <div className={`flex items-center gap-2 text-2xl font-bold ${dir.text}`}>
                    <dir.icon className="w-6 h-6" />
                    {data.direction}
                  </div>
                  {tier && (
                    <div className={`mt-2 inline-block px-2 py-0.5 rounded border text-xs font-bold ${tier.color}`}>
                      {tier.label}
                    </div>
                  )}
                </div>
              </div>

              {tier && (
                <div className="mt-3 pt-3 border-t border-current/20 space-y-0.5">
                  <div className="text-xs font-semibold text-slate-200">{tier.desc}</div>
                  <div className="text-xs text-slate-500">{tier.sub}</div>
                </div>
              )}
              {data && !tradeable && (
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs font-bold text-rose-400">
                  ⛔ NO TRADE — Score must reach ±4 (GS Rule — no exceptions)
                </div>
              )}
            </div>

            {/* Score breakdown */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Score Breakdown</div>
              <div className="space-y-2">
                {SCORE_GROUPS.map((group) => {
                  const score = data.scores[group.key];
                  const Icon = group.icon;
                  return (
                    <div key={group.key} className="bg-slate-800/50 rounded p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-400">{group.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">
                            {score > 0 ? group.positiveLabel : score < 0 ? group.negativeLabel : 'Neutral'}
                          </span>
                          <span className={`text-sm font-bold tabular-nums w-6 text-right ${scoreColor(score)}`}>
                            {score > 0 ? '+' : ''}{score}
                          </span>
                        </div>
                      </div>
                      <ScoreBar score={score} max={group.max} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-800/50 rounded p-3 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">AI Summary</div>
              <p className="text-xs text-slate-300 leading-relaxed">{data.summary}</p>
            </div>

            {/* Expand/collapse reasoning */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 rounded transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide Reasoning' : 'Show Reasoning & Risks'}
            </button>

            {expanded && (
              <div className="space-y-3 animate-fade-in">
                {/* Reasoning */}
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Reasoning</div>
                  {SCORE_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.key} className="flex gap-2 p-2 bg-slate-800/30 rounded">
                        <Icon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs text-slate-500">{group.label}: </span>
                          <span className="text-xs text-slate-300">{data.reasoning[group.key]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Key Risks */}
                {data.key_risks && data.key_risks.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Key Risks</div>
                    {data.key_risks.map((risk, i) => (
                      <div key={i} className="flex gap-2 items-start p-2 bg-rose-950/30 border border-rose-900/30 rounded">
                        <AlertTriangle className="w-3 h-3 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-rose-300/80">{risk}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prices found */}
                {data.prices_found && Object.keys(data.prices_found).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Prices Sourced</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {Object.entries(data.prices_found).map(([k, v]) => (
                        <div key={k} className="flex justify-between p-2 bg-slate-800/30 rounded text-xs">
                          <span className="text-slate-500 uppercase">{k.replace('_', ' ')}</span>
                          <span className="text-slate-300 tabular-nums">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
