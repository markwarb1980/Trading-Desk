'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ImagePlus, Brain, TrendingUp, TrendingDown, Minus,
  AlertTriangle, RefreshCw, X, CheckCircle2, Upload,
} from 'lucide-react';

/** Resize + compress an image to reduce token usage when sending to Claude */
async function compressImage(file: File, maxWidth = 900, quality = 0.75): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

const INSTRUMENTS = [
  { key: 'gold',   label: 'Gold',     emoji: '🥇', hint: 'XAU/USD daily/4H' },
  { key: 'oil',    label: 'Oil',      emoji: '🛢️', hint: 'Brent/WTI daily/4H' },
  { key: 'gbp_usd',label: 'GBP/USD',  emoji: '£',  hint: 'FX daily/4H' },
  { key: 'sp500',  label: 'S&P 500',  emoji: '🇺🇸', hint: 'Index daily/4H' },
  { key: 'dax',    label: 'DAX',      emoji: '🇩🇪', hint: 'Index daily/4H' },
  { key: 'ftse',   label: 'FTSE 100', emoji: '🇬🇧', hint: 'Index daily/4H' },
];

interface InstrumentReading {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  key_level: string;
  note: string;
}

interface MacroChartsResult {
  instrument_readings?: Record<string, InstrumentReading>;
  scores?: {
    geopolitical_risk: number;
    central_banks: number;
    market_direction: number;
    news_adjustment: number;
  };
  total_score?: number;
  tier?: number | string;
  direction?: 'LONG' | 'SHORT' | 'NO TRADE';
  reasoning?: Record<string, string>;
  summary?: string;
  key_risks?: string[];
  dax_outlook?: string;
  ftse_outlook?: string;
  charts_uploaded?: number;
  timestamp?: string;
  error?: string;
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === 'BULLISH') return (
    <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
      <TrendingUp className="w-3 h-3" /> BULL
    </span>
  );
  if (trend === 'BEARISH') return (
    <span className="flex items-center gap-1 text-xs text-rose-400 font-bold">
      <TrendingDown className="w-3 h-3" /> BEAR
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 font-bold">
      <Minus className="w-3 h-3" /> SIDE
    </span>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = (Math.abs(score) / max) * 100;
  const isPos = score >= 0;
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 flex justify-end">
        <div className="w-full bg-slate-800 rounded-l h-1.5 overflow-hidden">
          <div className={`h-full rounded-l ml-auto transition-all duration-700 ${!isPos ? 'bg-rose-500' : ''}`}
               style={{ width: !isPos ? `${pct}%` : '0%' }} />
        </div>
      </div>
      <div className="w-px h-3 bg-slate-600 flex-shrink-0" />
      <div className="flex-1">
        <div className="w-full bg-slate-800 rounded-r h-1.5 overflow-hidden">
          <div className={`h-full rounded-r transition-all duration-700 ${isPos ? 'bg-emerald-500' : ''}`}
               style={{ width: isPos ? `${pct}%` : '0%' }} />
        </div>
      </div>
    </div>
  );
}

export interface MacroInstrumentReading {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  key_level: string;
  ema_ribbon?: string;
  pattern?: string;
  note: string;
}

export default function MacroFromCharts({
  onResult,
}: {
  onResult?: (readings: { dax?: MacroInstrumentReading; ftse?: MacroInstrumentReading }) => void;
}) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MacroChartsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = useCallback((key: string, file: File) => {
    const url = URL.createObjectURL(file);
    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: url }));
  }, []);

  const clearFile = (key: string) => {
    setFiles((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const uploadedCount = Object.values(files).filter(Boolean).length;
  const allUploaded = uploadedCount === INSTRUMENTS.length;

  const runAnalysis = async () => {
    if (!allUploaded) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Compress all images to stay within token limits (~900px wide, JPEG 75%)
      const compressed: Record<string, Blob> = {};
      for (const [key, file] of Object.entries(files)) {
        if (file) compressed[key] = await compressImage(file);
      }

      // Send all 6 charts in one request so Claude sees the full picture
      const fd = new FormData();
      for (const k of Object.keys(compressed)) {
        fd.append(k, compressed[k], `${k}.jpg`);
      }

      const res = await fetch('/api/macro-from-charts', { method: 'POST', body: fd });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || `Analysis failed: HTTP ${res.status}`);
      }

      const data: MacroChartsResult = await res.json();
      if (data.error) throw new Error(data.error);

      // Ensure total_score, direction, tier are set (route should return them but guard here too)
      if (data.scores && data.total_score === undefined) {
        const total = Math.max(-8, Math.min(8,
          (data.scores.geopolitical_risk ?? 0) +
          (data.scores.central_banks     ?? 0) +
          (data.scores.market_direction  ?? 0)
        ));
        data.total_score = total;
        data.direction   = total > 0 ? 'LONG' : total < 0 ? 'SHORT' : 'NO TRADE';
        data.tier        = Math.abs(total) >= 6 ? 1 : Math.abs(total) >= 4 ? 2 : 'NO TRADE';
      }

      setResult(data);
      if (onResult && data.instrument_readings) {
        onResult({
          dax:  data.instrument_readings['dax']  as MacroInstrumentReading | undefined,
          ftse: data.instrument_readings['ftse'] as MacroInstrumentReading | undefined,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const dir = result?.direction;
  const dirColor = dir === 'LONG' ? 'text-emerald-400' : dir === 'SHORT' ? 'text-rose-400' : 'text-slate-400';
  const dirBg = dir === 'LONG' ? 'bg-emerald-950 border-emerald-700' :
                dir === 'SHORT' ? 'bg-rose-950 border-rose-700' : 'bg-slate-800 border-slate-600';

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">MACRO FROM CHARTS</span>
          <span className="text-xs text-slate-600 hidden sm:block">— Upload charts for AI macro score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${allUploaded ? 'text-emerald-400' : 'text-slate-500'}`}>
            {uploadedCount}/6 charts {allUploaded ? '✓' : '(all required)'}
          </span>
          <button
            onClick={runAnalysis}
            disabled={loading || !allUploaded}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white disabled:text-slate-500 rounded text-xs font-bold transition-colors"
            title={!allUploaded ? `Upload all 6 charts to run analysis (${6 - uploadedCount} remaining)` : 'Run AI macro analysis'}
          >
            <Brain className={`w-3 h-3 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'ANALYSING...' : 'ANALYSE ALL'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Chart upload grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INSTRUMENTS.map(({ key, label, emoji, hint }) => {
            const hasFile = !!files[key];
            const preview = previews[key];
            return (
              <div key={key} className={`relative rounded-lg border overflow-hidden transition-all ${
                hasFile ? 'border-violet-700 bg-violet-950/20' : 'border-slate-700 bg-slate-800/30'
              }`}>
                {preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={label}
                         className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                    <div className="absolute bottom-1 left-1.5 text-xs font-bold text-white">{emoji} {label}</div>
                    <button
                      onClick={() => clearFile(key)}
                      className="absolute top-1 right-1 p-0.5 bg-slate-900/80 rounded-full border border-slate-700"
                    >
                      <X className="w-3 h-3 text-slate-300" />
                    </button>
                    <CheckCircle2 className="absolute top-1 left-1 w-3.5 h-3.5 text-violet-400" />
                  </div>
                ) : (
                  <button
                    onClick={() => fileRefs.current[key]?.click()}
                    className="w-full h-20 flex flex-col items-center justify-center gap-1 hover:bg-slate-700/30 transition-colors"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-semibold text-slate-400">{label}</span>
                    <span className="text-xs text-slate-600">{hint}</span>
                    <Upload className="w-3 h-3 text-slate-600 mt-0.5" />
                  </button>
                )}
                <input
                  ref={(el) => { fileRefs.current[key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(key, f); e.target.value = ''; }}
                />
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-6 space-y-2">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-violet-400 text-sm">Analysing {uploadedCount} charts...</div>
            <div className="text-slate-600 text-xs">Claude is reading all charts simultaneously</div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-3 animate-slide-up">
            {/* Direction banner */}
            {result.direction && result.total_score !== undefined && (
              <div className={`flex items-center justify-between px-4 py-3 rounded border ${dirBg}`}>
                <div className="flex items-center gap-2">
                  {dir === 'LONG' ? <TrendingUp className="w-5 h-5 text-emerald-400" /> :
                   dir === 'SHORT' ? <TrendingDown className="w-5 h-5 text-rose-400" /> :
                   <Minus className="w-5 h-5 text-slate-400" />}
                  <span className={`text-xl font-bold ${dirColor}`}>{result.direction}</span>
                  {result.tier && result.tier !== 'NO TRADE' && (
                    <span className="text-xs text-slate-400">TIER {result.tier}</span>
                  )}
                </div>
                <div className={`text-4xl font-bold tabular-nums ${dirColor}`}>
                  {(result.total_score ?? 0) > 0 ? '+' : ''}{result.total_score}
                  <span className="text-xl text-slate-600">/8</span>
                </div>
              </div>
            )}

            {/* Instrument readings */}
            {result.instrument_readings && (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Instrument Readings</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(result.instrument_readings).map(([key, reading]) => {
                    const inst = INSTRUMENTS.find((i) => i.key === key);
                    return (
                      <div key={key} className="flex items-start gap-2 p-2 bg-slate-800/40 rounded">
                        <span className="text-sm">{inst?.emoji || '●'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-slate-300">{inst?.label || key}</span>
                            <TrendBadge trend={reading.trend} />
                          </div>
                          <div className="text-xs text-amber-400/80 tabular-nums">{reading.key_level}</div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{reading.note}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score breakdown */}
            {result.scores && (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Score Breakdown</div>
                {[
                  { key: 'geopolitical_risk', label: 'Geopolitical / Risk', max: 3 },
                  { key: 'central_banks',     label: 'Central Banks / FX', max: 2 },
                  { key: 'market_direction',  label: 'Market Direction',    max: 3 },
                ].map(({ key, label, max }) => {
                  const score = result.scores![key as keyof typeof result.scores] as number;
                  return (
                    <div key={key} className="bg-slate-800/40 rounded p-2">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">{label}</span>
                        <span className={`font-bold tabular-nums ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {score > 0 ? '+' : ''}{score}
                        </span>
                      </div>
                      <ScoreBar score={score} max={max} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div className="bg-slate-800/40 rounded p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">AI Summary</div>
                <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
              </div>
            )}

            {/* DAX & FTSE outlooks */}
            {(result.dax_outlook || result.ftse_outlook) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.dax_outlook && (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded p-2.5">
                    <div className="text-xs text-amber-400 font-bold mb-1">🇩🇪 DAX Outlook</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{result.dax_outlook}</p>
                  </div>
                )}
                {result.ftse_outlook && (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded p-2.5">
                    <div className="text-xs text-amber-400 font-bold mb-1">🇬🇧 FTSE Outlook</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{result.ftse_outlook}</p>
                  </div>
                )}
              </div>
            )}

            {/* Key risks */}
            {result.key_risks && result.key_risks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Key Risks</div>
                {result.key_risks.map((r, i) => (
                  <div key={i} className="flex gap-1.5 p-2 bg-rose-950/20 border border-rose-900/20 rounded text-xs">
                    <AlertTriangle className="w-3 h-3 text-rose-500/70 flex-shrink-0 mt-0.5" />
                    <span className="text-rose-300/70">{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={runAnalysis}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Re-analyse charts
            </button>
          </div>
        )}

        {!result && !loading && (
          <div className={`text-center py-3 text-xs rounded border ${
            allUploaded
              ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40'
              : 'text-slate-600 border-slate-800'
          }`}>
            {allUploaded
              ? '✓ All 6 charts uploaded — click ANALYSE ALL to run macro assessment'
              : `Upload all 6 charts to enable analysis (${6 - uploadedCount} remaining: ${
                  INSTRUMENTS.filter(i => !files[i.key]).map(i => i.label).join(', ')
                })`
            }
          </div>
        )}
      </div>
    </div>
  );
}
