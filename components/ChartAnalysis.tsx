'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ScanLine, Upload, X, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Target, Shield, Layers, MapPin, BarChart2,
} from 'lucide-react';

interface ChartAnalysisResult {
  instrument?: string;
  timeframe?: string;
  ema_ribbon?: {
    status: string;
    price_position: string;
    momentum: string;
    detail: string;
  };
  key_level?: {
    price: string;
    type: string;
    significance: string;
  };
  setup?: {
    type: string;
    maturity: string;
    description: string;
  };
  entry_zone?: {
    range: string;
    trigger: string;
  };
  stop_zone?: {
    level: string;
    points_risk: string;
    reasoning: string;
  };
  bias?: string;
  confidence?: string;
  caveats?: string[];
  summary?: string;
  raw_analysis?: string;
  error?: string;
}

function BiasTag({ bias }: { bias: string }) {
  if (bias === 'BULLISH') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-xs font-bold">
      <TrendingUp className="w-3 h-3" /> BULLISH
    </span>
  );
  if (bias === 'BEARISH') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded text-xs font-bold">
      <TrendingDown className="w-3 h-3" /> BEARISH
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-xs font-bold">
      <Minus className="w-3 h-3" /> NEUTRAL
    </span>
  );
}

function EmaStatus({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    BULLISH_STACK: { color: 'text-emerald-400', label: 'Bullish Stack' },
    BEARISH_STACK: { color: 'text-rose-400', label: 'Bearish Stack' },
    MIXED: { color: 'text-amber-400', label: 'Mixed' },
    FLAT: { color: 'text-slate-400', label: 'Flat' },
  };
  const cfg = map[status] || { color: 'text-slate-400', label: status };
  return <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

export default function ChartAnalysis() {
  const [result, setResult] = useState<ChartAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<'DAX' | 'FTSE'>('DAX');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyseChart = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('instrument', selectedInstrument);

      const res = await fetch('/api/chart-analysis', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const json: ChartAnalysisResult = await res.json();
      setResult(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [selectedInstrument]);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    analyseChart(file);
  }, [analyseChart]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearChart = () => {
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">CHART ANALYSIS</span>
          <span className="text-xs text-slate-600 hidden sm:block">— AI Vision (15M)</span>
        </div>
        <div className="flex items-center gap-2">
          {['DAX', 'FTSE'].map((inst) => (
            <button
              key={inst}
              onClick={() => setSelectedInstrument(inst as 'DAX' | 'FTSE')}
              className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                selectedInstrument === inst
                  ? 'bg-sky-900 text-sky-300 border-sky-700'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600'
              }`}
            >
              {inst}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Drop zone */}
        {!previewUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`upload-zone border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-sky-400 bg-sky-950/30'
                : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm text-slate-400 font-medium">
              Drop chart screenshot here
            </div>
            <div className="text-xs text-slate-600 mt-1">
              or click to upload • PNG, JPEG, WebP
            </div>
            <div className="text-xs text-slate-700 mt-3">
              Upload a {selectedInstrument} 15-minute chart for AI technical analysis
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Chart preview"
              className="w-full rounded-lg border border-slate-700 max-h-64 object-contain bg-slate-900"
            />
            <button
              onClick={clearChart}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-full border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
            {loading && (
              <div className="absolute inset-0 bg-slate-950/70 rounded-lg flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-sky-400 text-sm font-medium">Analysing chart...</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-3 animate-slide-up">
            {/* Raw analysis fallback */}
            {result.raw_analysis && !result.ema_ribbon && (
              <div className="p-3 bg-slate-800/50 rounded text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {result.raw_analysis}
              </div>
            )}

            {/* Structured results */}
            {result.ema_ribbon && (
              <>
                {/* Header: instrument + bias */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-300">
                      {result.instrument || selectedInstrument} · 15M
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.bias && <BiasTag bias={result.bias} />}
                    {result.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        result.confidence === 'HIGH'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : result.confidence === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-400 border-amber-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {result.confidence} CONF
                      </span>
                    )}
                  </div>
                </div>

                {/* EMA Ribbon */}
                <div className="bg-slate-800/50 rounded p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider">EMA Ribbon</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <span className="text-slate-500">Status: </span>
                      <EmaStatus status={result.ema_ribbon.status} />
                    </span>
                    <span>
                      <span className="text-slate-500">Price: </span>
                      <span className="text-slate-300">{result.ema_ribbon.price_position?.replace(/_/g, ' ')}</span>
                    </span>
                    <span>
                      <span className="text-slate-500">Momentum: </span>
                      <span className={result.ema_ribbon.momentum === 'EXPANDING' ? 'text-amber-400' : 'text-slate-400'}>
                        {result.ema_ribbon.momentum}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{result.ema_ribbon.detail}</p>
                </div>

                {/* Key Level */}
                {result.key_level && (
                  <div className="bg-slate-800/50 rounded p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider">Key Level</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${
                        result.key_level.type === 'SUPPORT'
                          ? 'bg-emerald-950 text-emerald-400'
                          : result.key_level.type === 'RESISTANCE'
                          ? 'bg-rose-950 text-rose-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {result.key_level.type}
                      </span>
                    </div>
                    <div className="text-lg font-bold tabular-nums text-amber-400">{result.key_level.price}</div>
                    <p className="text-xs text-slate-400">{result.key_level.significance}</p>
                  </div>
                )}

                {/* Setup */}
                {result.setup && (
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Target className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider">Setup</span>
                      </div>
                      <span className="text-xs text-sky-400 font-semibold">{result.setup.type}</span>
                    </div>
                    <div className="text-xs text-amber-500/80 mb-1">{result.setup.maturity}</div>
                    <p className="text-xs text-slate-400">{result.setup.description}</p>
                  </div>
                )}

                {/* Entry & Stop zones */}
                <div className="grid grid-cols-2 gap-2">
                  {result.entry_zone && (
                    <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2.5">
                      <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Entry Zone</div>
                      <div className="text-sm font-bold text-emerald-400 tabular-nums">{result.entry_zone.range}</div>
                      <p className="text-xs text-slate-500 mt-1">{result.entry_zone.trigger}</p>
                    </div>
                  )}
                  {result.stop_zone && (
                    <div className="bg-rose-950/30 border border-rose-900/30 rounded p-2.5">
                      <div className="flex items-center gap-1 text-xs text-rose-600 uppercase tracking-wider mb-1">
                        <Shield className="w-3 h-3" />
                        Stop Zone
                      </div>
                      <div className="text-sm font-bold text-rose-400 tabular-nums">{result.stop_zone.level}</div>
                      <div className="text-xs text-rose-500/70 mt-0.5">{result.stop_zone.points_risk} pts risk</div>
                      <p className="text-xs text-slate-500 mt-1">{result.stop_zone.reasoning}</p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {result.summary && (
                  <div className="bg-slate-800/30 rounded p-3">
                    <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
                  </div>
                )}

                {/* Caveats */}
                {result.caveats && result.caveats.length > 0 && (
                  <div className="space-y-1">
                    {result.caveats.map((c, i) => (
                      <div key={i} className="flex gap-1.5 items-start text-xs">
                        <AlertTriangle className="w-3 h-3 text-amber-500/70 flex-shrink-0 mt-0.5" />
                        <span className="text-amber-400/70">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
