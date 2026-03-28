'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ScanLine, Upload, X, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Target, Shield, Layers, MapPin, BarChart2, RefreshCw,
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

type Instrument = 'DAX' | 'FTSE';

interface ChartSlot {
  previewUrl: string | null;
  result: ChartAnalysisResult | null;
  loading: boolean;
  error: string | null;
  uploadedAt: string | null;
}

const EMPTY_SLOT: ChartSlot = {
  previewUrl: null,
  result: null,
  loading: false,
  error: null,
  uploadedAt: null,
};

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
    MIXED:         { color: 'text-amber-400', label: 'Mixed' },
    FLAT:          { color: 'text-slate-400', label: 'Flat' },
  };
  const cfg = map[status] || { color: 'text-slate-400', label: status };
  return <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

function AnalysisResult({ result }: { result: ChartAnalysisResult }) {
  return (
    <div className="space-y-2 animate-slide-up">
      {result.raw_analysis && !result.ema_ribbon && (
        <div className="p-3 bg-slate-800/50 rounded text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {result.raw_analysis}
        </div>
      )}

      {result.ema_ribbon && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-300">15M Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              {result.bias && <BiasTag bias={result.bias} />}
              {result.confidence && (
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  result.confidence === 'HIGH'   ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                  result.confidence === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                                                   'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {result.confidence}
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
              <span><span className="text-slate-500">Status: </span><EmaStatus status={result.ema_ribbon.status} /></span>
              <span><span className="text-slate-500">Price: </span><span className="text-slate-300">{result.ema_ribbon.price_position?.replace(/_/g, ' ')}</span></span>
              <span><span className="text-slate-500">Momentum: </span>
                <span className={result.ema_ribbon.momentum === 'EXPANDING' ? 'text-amber-400' : 'text-slate-400'}>
                  {result.ema_ribbon.momentum}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{result.ema_ribbon.detail}</p>
          </div>

          {/* Key Level */}
          {result.key_level && (
            <div className="bg-slate-800/50 rounded p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wider">Key Level</span>
                <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${
                  result.key_level.type === 'SUPPORT' ? 'bg-emerald-950 text-emerald-400' :
                  result.key_level.type === 'RESISTANCE' ? 'bg-rose-950 text-rose-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{result.key_level.type}</span>
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

          {/* Entry & Stop */}
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
                  <Shield className="w-3 h-3" /> Stop Zone
                </div>
                <div className="text-sm font-bold text-rose-400 tabular-nums">{result.stop_zone.level}</div>
                <div className="text-xs text-rose-500/70 mt-0.5">{result.stop_zone.points_risk} pts risk</div>
                <p className="text-xs text-slate-500 mt-1">{result.stop_zone.reasoning}</p>
              </div>
            )}
          </div>

          {result.summary && (
            <div className="bg-slate-800/30 rounded p-3">
              <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
            </div>
          )}

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
  );
}

function ChartTab({
  instrument,
  slot,
  onFile,
  onClear,
}: {
  instrument: Instrument;
  slot: ChartSlot;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  }, [onFile]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Drop zone or preview */}
      {!slot.previewUrl ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-sky-400 bg-sky-950/30'
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
          }`}
        >
          <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-sm text-slate-400 font-medium">Drop {instrument} 15M chart here</div>
          <div className="text-xs text-slate-600 mt-1">or click to upload · PNG, JPEG, WebP</div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInput} className="hidden" />
        </div>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.previewUrl}
            alt={`${instrument} chart`}
            className="w-full rounded-lg border border-slate-700 max-h-56 object-contain bg-slate-900"
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            {/* Re-upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 bg-slate-900/80 hover:bg-slate-700 rounded-full border border-slate-600 transition-colors"
              title="Replace chart"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {/* Clear */}
            <button
              onClick={onClear}
              className="p-1.5 bg-slate-900/80 hover:bg-rose-900/80 rounded-full border border-slate-600 transition-colors"
              title="Remove chart"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          {slot.uploadedAt && (
            <div className="absolute bottom-2 left-2 text-xs bg-slate-900/80 px-2 py-0.5 rounded text-slate-500">
              {slot.uploadedAt}
            </div>
          )}
          {slot.loading && (
            <div className="absolute inset-0 bg-slate-950/70 rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-sky-400 text-sm font-medium">Analysing {instrument}...</div>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInput} className="hidden" />
        </div>
      )}

      {/* Error */}
      {slot.error && (
        <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{slot.error}</span>
        </div>
      )}

      {/* Results */}
      {slot.result && !slot.loading && <AnalysisResult result={slot.result} />}
    </div>
  );
}

export default function ChartAnalysis() {
  const [activeTab, setActiveTab] = useState<Instrument>('DAX');
  const [slots, setSlots] = useState<Record<Instrument, ChartSlot>>({
    DAX:  { ...EMPTY_SLOT },
    FTSE: { ...EMPTY_SLOT },
  });

  const updateSlot = (instrument: Instrument, patch: Partial<ChartSlot>) => {
    setSlots((prev) => ({ ...prev, [instrument]: { ...prev[instrument], ...patch } }));
  };

  const handleFile = useCallback(async (instrument: Instrument, file: File) => {
    const url = URL.createObjectURL(file);
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    updateSlot(instrument, { previewUrl: url, loading: true, error: null, result: null, uploadedAt: now });

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('instrument', instrument);

      const res = await fetch('/api/chart-analysis', { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json: ChartAnalysisResult = await res.json();
      updateSlot(instrument, { result: json, loading: false });
    } catch (e: unknown) {
      updateSlot(instrument, { error: e instanceof Error ? e.message : 'Analysis failed', loading: false });
    }
  }, []);

  const clearSlot = (instrument: Instrument) => {
    updateSlot(instrument, { ...EMPTY_SLOT });
  };

  const dax  = slots.DAX;
  const ftse = slots.FTSE;

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">CHART ANALYSIS</span>
          <span className="text-xs text-slate-600 hidden sm:block">— AI Vision · 15M</span>
        </div>
        {/* Status badges */}
        <div className="flex items-center gap-2">
          {(['DAX', 'FTSE'] as Instrument[]).map((inst) => {
            const s = slots[inst];
            return (
              <div key={inst} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                s.result
                  ? s.result.bias === 'BULLISH'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : s.result.bias === 'BEARISH'
                    ? 'bg-rose-950 text-rose-400 border-rose-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-slate-800 text-slate-600 border-slate-700'
              }`}>
                {s.loading && <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />}
                {s.result && !s.loading && (
                  s.result.bias === 'BULLISH' ? <TrendingUp className="w-3 h-3" /> :
                  s.result.bias === 'BEARISH' ? <TrendingDown className="w-3 h-3" /> :
                  <Minus className="w-3 h-3" />
                )}
                {!s.result && !s.loading && <Upload className="w-3 h-3 opacity-40" />}
                <span className="font-bold">{inst}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-800">
        {(['DAX', 'FTSE'] as Instrument[]).map((inst) => {
          const s = slots[inst];
          return (
            <button
              key={inst}
              onClick={() => setActiveTab(inst)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                activeTab === inst
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {inst}
              {s.uploadedAt && (
                <span className="text-xs font-normal text-slate-600">· {s.uploadedAt}</span>
              )}
              {s.result && (
                <span className={`w-1.5 h-1.5 rounded-full ${
                  s.result.bias === 'BULLISH' ? 'bg-emerald-400' :
                  s.result.bias === 'BEARISH' ? 'bg-rose-400' : 'bg-slate-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {activeTab === 'DAX' && (
          <ChartTab
            instrument="DAX"
            slot={dax}
            onFile={(f) => handleFile('DAX', f)}
            onClear={() => clearSlot('DAX')}
          />
        )}
        {activeTab === 'FTSE' && (
          <ChartTab
            instrument="FTSE"
            slot={ftse}
            onFile={(f) => handleFile('FTSE', f)}
            onClear={() => clearSlot('FTSE')}
          />
        )}
      </div>
    </div>
  );
}
