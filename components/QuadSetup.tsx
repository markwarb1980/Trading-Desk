'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Spade, Upload, X, AlertTriangle, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, RefreshCw,
} from 'lucide-react';
import type { QuadVerdict, QuadInstrumentKey } from '@/lib/quadSetupRules';

async function compressImage(file: File, maxWidth = 1100, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

const INSTRUMENTS: { key: QuadInstrumentKey; label: string }[] = [
  { key: 'DE30EUR', label: 'DE30EUR' },
  { key: 'SPX500', label: 'SPX500' },
];

interface Slot {
  previewUrl: string | null;
  result: QuadVerdict | null;
  loading: boolean;
  error: string | null;
  uploadedAt: string | null;
}

const EMPTY_SLOT: Slot = { previewUrl: null, result: null, loading: false, error: null, uploadedAt: null };

const HAND_LABEL: Record<string, { label: string; color: string }> = {
  NONE: { label: 'No Trade', color: 'text-slate-500 bg-slate-800 border-slate-700' },
  THREE_OF_A_KIND: { label: 'Three of a Kind', color: 'text-sky-400 bg-sky-950 border-sky-800' },
  FULL_HOUSE: { label: 'Full House', color: 'text-amber-400 bg-amber-950 border-amber-800' },
  FOUR_OF_A_KIND: { label: 'Four of a Kind', color: 'text-orange-400 bg-orange-950 border-orange-800' },
  THE_NUTS: { label: 'The Nuts', color: 'text-emerald-400 bg-emerald-950 border-emerald-800' },
};

function ChecklistRow({
  step, met, skipped, label, note,
}: {
  step: number; met: boolean; skipped: boolean; label: string; note?: string;
}) {
  return (
    <div className="flex items-start gap-1.5 text-xs">
      {skipped ? (
        <XCircle className="w-3.5 h-3.5 text-slate-700 flex-shrink-0 mt-0.5" />
      ) : met ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-rose-500/70 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <span className={skipped ? 'text-slate-700' : met ? 'text-slate-300' : 'text-slate-500'}>
          {step}. {label}
        </span>
        {note && !skipped && <p className="text-slate-600 mt-0.5">{note}</p>}
        {skipped && <p className="text-slate-700 mt-0.5 italic">not reached</p>}
      </div>
    </div>
  );
}

const DIVERGENCE_COLOR: Record<string, string> = {
  STRONG: 'text-emerald-400 bg-emerald-950 border-emerald-800',
  MEDIUM: 'text-sky-400 bg-sky-950 border-sky-800',
  WEAK: 'text-slate-400 bg-slate-800 border-slate-700',
  HIDDEN: 'text-slate-500 bg-slate-800 border-slate-700',
  NONE: 'text-slate-600 bg-slate-800 border-slate-700',
};

function VerdictPanel({ result }: { result: QuadVerdict }) {
  if (result.error || result.raw_analysis) {
    return (
      <div className="p-3 bg-slate-800/50 rounded text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
        {result.error || result.raw_analysis}
      </div>
    );
  }

  const hand = HAND_LABEL[result.hand] ?? HAND_LABEL.NONE;
  const cl = result.checklist;
  const stoppedAt = result.stopped_at_step;
  const reached = (step: number) => stoppedAt === null || step <= stoppedAt;
  const div = result.divergence;

  return (
    <div className="space-y-2 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded border text-xs font-bold ${
          result.trade_valid
            ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
            : 'bg-slate-800 text-slate-500 border-slate-700'
        }`}>
          {result.trade_valid ? 'TRADE VALID' : stoppedAt ? `STOP — STEP ${stoppedAt}` : 'PASS'}
        </span>
        <div className="flex items-center gap-2">
          {result.direction && (
            <span className={`flex items-center gap-1 text-xs font-bold ${
              result.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {result.direction === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {result.direction}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded border text-xs font-bold ${hand.color}`}>{hand.label}</span>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded p-2.5 space-y-1.5">
        <ChecklistRow step={1} met={cl.step1_open_settled.met} skipped={!reached(1)} label="Open has settled" note={cl.step1_open_settled.note} />
        <ChecklistRow step={2} met={cl.step2_valid_channel.met} skipped={!reached(2)} label="Valid channel" note={cl.step2_valid_channel.note} />
        <ChecklistRow step={3} met={cl.step3_price_at_line.met} skipped={!reached(3)} label="Price at the line" note={cl.step3_price_at_line.note} />
        <ChecklistRow step={4} met={cl.step4_full_quad.met} skipped={!reached(4)} label="Full Quad" note={cl.step4_full_quad.note} />
        <ChecklistRow
          step={5}
          met={cl.step5_trend_aligned.met}
          skipped={!reached(5)}
          label={`Trend aligned${cl.step5_trend_aligned.channel_slope ? ` (channel: ${cl.step5_trend_aligned.channel_slope})` : ''}`}
          note={cl.step5_trend_aligned.note}
        />
      </div>

      <div className="flex items-center justify-between bg-slate-800/40 rounded p-2 text-xs">
        <span className="text-slate-500">9-3 divergence</span>
        <div className="flex items-center gap-2">
          {div.direction && <span className="text-slate-500">{div.direction}</span>}
          <span className={`px-1.5 py-0.5 rounded border font-bold ${DIVERGENCE_COLOR[div.grade] ?? DIVERGENCE_COLOR.NONE}`}>
            {div.grade}{div.counts ? ' ✓ counts' : ''}
          </span>
        </div>
      </div>
      {div.note && <p className="text-xs text-slate-600 -mt-1 px-1">{div.note}</p>}

      {cl.step4_full_quad.readings && (
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {(['9-3', '14-3', '44', '60-10'] as const).map((k) => (
            <div key={k} className="bg-slate-800/40 rounded p-1.5 text-center">
              <div className="text-slate-600">{k}</div>
              <div className="font-bold tabular-nums text-slate-300">
                {cl.step4_full_quad.readings[k] ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {(result.entry_trigger || result.stop) && (
        <div className="grid grid-cols-2 gap-2">
          {result.entry_trigger && result.entry_trigger !== 'n/a' && (
            <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2">
              <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Entry</div>
              <p className="text-xs text-slate-400">{result.entry_trigger}</p>
            </div>
          )}
          {result.stop && result.stop !== 'n/a' && (
            <div className="bg-rose-950/30 border border-rose-900/30 rounded p-2">
              <div className="text-xs text-rose-600 uppercase tracking-wider mb-1">Stop</div>
              <p className="text-xs text-slate-400">{result.stop}</p>
            </div>
          )}
        </div>
      )}

      {result.summary && (
        <div className="bg-slate-800/30 rounded p-3">
          <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {result.caveats && result.caveats.length > 0 && (
        <div className="space-y-1">
          {result.caveats.map((cv, i) => (
            <div key={i} className="flex gap-1.5 items-start text-xs">
              <AlertTriangle className="w-3 h-3 text-amber-500/70 flex-shrink-0 mt-0.5" />
              <span className="text-amber-400/70">{cv}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotPanel({
  instrument, label, slot, onFile, onClear,
}: {
  instrument: QuadInstrumentKey; label: string; slot: Slot;
  onFile: (file: File) => void; onClear: () => void;
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

  return (
    <div className={`border rounded-lg overflow-hidden ${slot.previewUrl ? 'border-sky-800/60' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900/50">
        <span className="text-xs font-bold text-sky-400">5M — {label}</span>
        {slot.uploadedAt && <span className="text-xs text-slate-600">{slot.uploadedAt}</span>}
      </div>

      <div className="p-2 space-y-2">
        {!slot.previewUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              dragging ? 'border-sky-400 bg-sky-950/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/20'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <div className="text-xs text-slate-500">Upload today&apos;s {instrument} 5M chart</div>
            <div className="text-xs text-slate-700 mt-0.5">Drag & drop or click</div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInput} className="hidden" />
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.previewUrl} alt={`${instrument} 5M`}
                 className="w-full rounded border border-slate-700 max-h-48 object-contain bg-slate-900" />
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
                  <div className="text-sky-400 text-xs">Checking Quad...</div>
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
            <VerdictPanel result={slot.result} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuadSetup() {
  const [slots, setSlots] = useState<Record<QuadInstrumentKey, Slot>>({
    DE30EUR: { ...EMPTY_SLOT },
    SPX500: { ...EMPTY_SLOT },
  });
  const lastRequestRef = useRef<number>(0);

  const updateSlot = (key: QuadInstrumentKey, patch: Partial<Slot>) => {
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleFile = useCallback(async (instrument: QuadInstrumentKey, file: File) => {
    const url = URL.createObjectURL(file);
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    updateSlot(instrument, { previewUrl: url, loading: true, error: null, result: null, uploadedAt: now });

    try {
      const gap = Date.now() - lastRequestRef.current;
      if (gap < 3000) await new Promise((r) => setTimeout(r, 3000 - gap));
      lastRequestRef.current = Date.now();

      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('image', compressed, 'chart.jpg');
      formData.append('instrument', instrument);
      formData.append('timeframe', '5M');

      const res = await fetch('/api/quad-setup', { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      updateSlot(instrument, { result: json, loading: false });
    } catch (e: unknown) {
      updateSlot(instrument, { error: e instanceof Error ? e.message : 'Analysis failed', loading: false });
    }
  }, []);

  const clearSlot = (key: QuadInstrumentKey) => updateSlot(key, { ...EMPTY_SLOT });

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Spade className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">QUAD SETUP</span>
          <span className="text-xs text-slate-600 hidden sm:block">— 5M · DE30EUR &amp; SPX500</span>
        </div>
      </div>

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INSTRUMENTS.map(({ key, label }) => (
          <SlotPanel
            key={key}
            instrument={key}
            label={label}
            slot={slots[key]}
            onFile={(f) => handleFile(key, f)}
            onClear={() => clearSlot(key)}
          />
        ))}
      </div>
    </div>
  );
}
