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
type Timeframe = '1H' | '15M';

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

function AnalysisResult({ result, timeframe }: { result: ChartAnalysisResult; timeframe: Timeframe }) {
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
              <span className="text-sm font-semibold text-slate-300">{timeframe} Analysis</span>
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

function TimeframeSlot({
  instrument,
  timeframe,
  slot,
  onFile,
  onClear,
}: {
  instrument: Instrument;
  timeframe: Timeframe;
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
    e.target.value = '';
  };

  const tfColor = timeframe === '1H' ? 'text-amber-400' : 'text-sky-400';
  const tfBorder = timeframe === '1H' ? 'border-amber-800/60' : 'border-sky-800/60';

  return (
    <div className={`border rounded-lg overflow-hidden ${slot.previewUrl ? tfBorder : 'border-slate-800'}`}>
      {/* Timeframe label */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900/50`}>
        <span className={`text-xs font-bold ${tfColor}`}>{timeframe}</span>
        {slot.uploadedAt && (
          <span className="text-xs text-slate-600">{slot.uploadedAt}</span>
        )}
        {slot.result?.bias && !slot.loading && (
          <span className={`text-xs font-bold ${
            slot.result.bias === 'BULLISH' ? 'text-emerald-400' :
            slot.result.bias === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
          }`}>{slot.result.bias}</span>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {!slot.previewUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
              dragging ? 'border-sky-400 bg-sky-950/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/20'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <div className="text-xs text-slate-500">Upload {instrument} {timeframe}</div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInput} className="hidden" />
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.previewUrl} alt={`${instrument} ${timeframe}`}
                 className="w-full rounded border border-slate-700 max-h-44 object-contain bg-slate-900" />
            <div className="absolute top-1 right-1 flex gap-1">
              <button onClick={() => fileInputRef.current?.click()}
                      className="p-1 bg-slate-900/80 hover:bg-slate-700 rounded-full border border-slate-600">
                <RefreshCw className="w-3 h-3 text-slate-400" />
              </button>
              <button onClick={onClear}
                      className="p-1 bg-slate-900/80 hover:bg-rose-900/80 rounded-full border border-slate-600">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
            {slot.loading && (
              <div className="absolute inset-0 bg-slate-950/70 rounded flex items-center justify-center">
                <div className="text-center space-y-1">
                  <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-sky-400 text-xs">Analysing...</div>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInput} className="hidden" />
          </div>
        )}

        {slot.error && (
          <div className="flex items-start gap-1.5 p-2 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs mt-2">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{slot.error}</span>
          </div>
        )}

        {slot.result && !slot.loading && (
          <div className="mt-2">
            <AnalysisResult result={slot.result} timeframe={timeframe} />
          </div>
        )}
      </div>
    </div>
  );
}

type SlotKey = `${Instrument}_${Timeframe}`;

export default function ChartAnalysis() {
  const [activeInstrument, setActiveInstrument] = useState<Instrument>('DAX');
  const [slots, setSlots] = useState<Record<SlotKey, ChartSlot>>({
    DAX_1H:  { ...EMPTY_SLOT },
    DAX_15M: { ...EMPTY_SLOT },
    FTSE_1H: { ...EMPTY_SLOT },
    FTSE_15M:{ ...EMPTY_SLOT },
  });

  const updateSlot = (key: SlotKey, patch: Partial<ChartSlot>) => {
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleFile = useCallback(async (instrument: Instrument, timeframe: Timeframe, file: File) => {
    const key: SlotKey = `${instrument}_${timeframe}`;
    const url = URL.createObjectURL(file);
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    updateSlot(key, { previewUrl: url, loading: true, error: null, result: null, uploadedAt: now });

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('instrument', instrument);
      formData.append('timeframe', timeframe);

      const res = await fetch('/api/chart-analysis', { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json: ChartAnalysisResult = await res.json();
      updateSlot(key, { result: json, loading: false });
    } catch (e: unknown) {
      updateSlot(key, { error: e instanceof Error ? e.message : 'Analysis failed', loading: false });
    }
  }, []);

  const clearSlot = (key: SlotKey) => updateSlot(key, { ...EMPTY_SLOT });

  // Status badges for header
  const getInstrumentStatus = (inst: Instrument) => {
    const h1 = slots[`${inst}_1H`];
    const m15 = slots[`${inst}_15M`];
    const biases = [h1.result?.bias, m15.result?.bias].filter(Boolean);
    const bullCount = biases.filter(b => b === 'BULLISH').length;
    const bearCount = biases.filter(b => b === 'BEARISH').length;
    if (bullCount > bearCount) return 'BULLISH';
    if (bearCount > bullCount) return 'BEARISH';
    if (biases.length > 0) return 'NEUTRAL';
    return null;
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">CHART ANALYSIS</span>
          <span className="text-xs text-slate-600 hidden sm:block">— AI Vision · 1H + 15M</span>
        </div>
        <div className="flex items-center gap-2">
          {(['DAX', 'FTSE'] as Instrument[]).map((inst) => {
            const status = getInstrumentStatus(inst);
            return (
              <div key={inst} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                status === 'BULLISH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                status === 'BEARISH' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                status === 'NEUTRAL' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                'bg-slate-800 text-slate-600 border-slate-700'
              }`}>
                {status === 'BULLISH' ? <TrendingUp className="w-3 h-3" /> :
                 status === 'BEARISH' ? <TrendingDown className="w-3 h-3" /> :
                 <Upload className="w-3 h-3 opacity-40" />}
                <span className="font-bold">{inst}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instrument tab switcher */}
      <div className="flex border-b border-slate-800">
        {(['DAX', 'FTSE'] as Instrument[]).map((inst) => {
          const h1Loaded = !!slots[`${inst}_1H`].previewUrl;
          const m15Loaded = !!slots[`${inst}_15M`].previewUrl;
          const status = getInstrumentStatus(inst);
          return (
            <button
              key={inst}
              onClick={() => setActiveInstrument(inst)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                activeInstrument === inst
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {inst}
              {/* Upload progress indicators */}
              <div className="flex gap-0.5">
                <span className={`text-xs px-1 rounded ${h1Loaded ? 'text-amber-400 bg-amber-950' : 'text-slate-700 bg-slate-800'}`}>1H</span>
                <span className={`text-xs px-1 rounded ${m15Loaded ? 'text-sky-400 bg-sky-950' : 'text-slate-700 bg-slate-800'}`}>15M</span>
              </div>
              {status && (
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'BULLISH' ? 'bg-emerald-400' :
                  status === 'BEARISH' ? 'bg-rose-400' : 'bg-slate-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Chart slots — 1H and 15M side by side */}
      <div className="p-3 space-y-3">
        {(['DAX', 'FTSE'] as Instrument[]).map((inst) => (
          activeInstrument === inst && (
            <div key={inst} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['1H', '15M'] as Timeframe[]).map((tf) => (
                <TimeframeSlot
                  key={tf}
                  instrument={inst}
                  timeframe={tf}
                  slot={slots[`${inst}_${tf}`]}
                  onFile={(f) => handleFile(inst, tf, f)}
                  onClear={() => clearSlot(`${inst}_${tf}`)}
                />
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
