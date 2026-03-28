'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, Target, Shield,
  AlertTriangle, Info, ChevronRight,
} from 'lucide-react';

type Direction = 'LONG' | 'SHORT';
type Instrument = 'DAX' | 'FTSE';

interface CalcResult {
  entry: number;
  stopLoss: number;
  breakEven1R: number;
  target15R: number;
  target2R: number;
  riskPts: number;
  riskPct: number;
  reward1R: number;
  reward15R: number;
  reward2R: number;
  isValidStop: boolean;
  stopWarning: string | null;
}

interface Props {
  macroDirection?: Direction | 'NO TRADE';
}

const MAX_STOP: Record<Instrument, number> = {
  DAX: 120,
  FTSE: 50,
};

const TYPICAL_PRICES: Record<Instrument, number> = {
  DAX: 18000,
  FTSE: 8000,
};

function calculate(
  instrument: Instrument,
  direction: Direction,
  entry: number,
  stopPts: number
): CalcResult {
  const maxStop = MAX_STOP[instrument];
  const isValidStop = stopPts > 0 && stopPts <= maxStop;
  const stopWarning = stopPts > maxStop
    ? `Stop exceeds max ${maxStop}pts for ${instrument}`
    : stopPts <= 0
    ? 'Stop distance must be greater than 0'
    : null;

  const sl = direction === 'LONG' ? entry - stopPts : entry + stopPts;
  const be1r = direction === 'LONG' ? entry + stopPts : entry - stopPts;
  const t15r = direction === 'LONG' ? entry + stopPts * 1.5 : entry - stopPts * 1.5;
  const t2r = direction === 'LONG' ? entry + stopPts * 2 : entry - stopPts * 2;

  const riskPct = (stopPts / entry) * 100;

  return {
    entry,
    stopLoss: sl,
    breakEven1R: be1r,
    target15R: t15r,
    target2R: t2r,
    riskPts: stopPts,
    riskPct,
    reward1R: stopPts,
    reward15R: stopPts * 1.5,
    reward2R: stopPts * 2,
    isValidStop,
    stopWarning,
  };
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function LevelRow({
  label,
  value,
  pts,
  color,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  pts?: number;
  color: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded border transition-all ${
      highlight
        ? 'bg-amber-950/30 border-amber-800/50'
        : 'bg-slate-800/40 border-slate-800/60'
    }`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-right">
        {pts !== undefined && (
          <span className={`text-xs tabular-nums ${color} opacity-60`}>
            {pts > 0 ? '+' : ''}{fmt(pts, 1)}pts
          </span>
        )}
        <span className={`text-sm font-bold tabular-nums ${color}`}>
          {fmt(value, value < 100 ? 2 : 0)}
        </span>
      </div>
    </div>
  );
}

export default function TradeCalculator({ macroDirection }: Props) {
  const [instrument, setInstrument] = useState<Instrument>('DAX');
  const [direction, setDirection] = useState<Direction>('LONG');
  const [entryStr, setEntryStr] = useState('');
  const [stopPtsStr, setStopPtsStr] = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [riskAmount, setRiskAmount] = useState('1000');

  // Sync direction from macro score
  useEffect(() => {
    if (macroDirection === 'LONG' || macroDirection === 'SHORT') {
      setDirection(macroDirection);
    }
  }, [macroDirection]);

  const computeResult = useCallback(() => {
    const entry = parseFloat(entryStr);
    const stopPts = parseFloat(stopPtsStr);
    if (isNaN(entry) || isNaN(stopPts) || entry <= 0) {
      setResult(null);
      return;
    }
    setResult(calculate(instrument, direction, entry, stopPts));
  }, [entryStr, stopPtsStr, instrument, direction]);

  useEffect(() => {
    computeResult();
  }, [computeResult]);

  const maxStop = MAX_STOP[instrument];
  const dirColor = direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400';
  const dirBg = direction === 'LONG' ? 'bg-emerald-950 border-emerald-700' : 'bg-rose-950 border-rose-700';

  // Pip value calculation (approximate)
  const riskAmountNum = parseFloat(riskAmount) || 1000;
  const lotSuggestion = result && result.isValidStop && result.riskPts > 0
    ? (riskAmountNum / result.riskPts).toFixed(2)
    : null;

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">TRADE CALCULATOR</span>
          {macroDirection && macroDirection !== 'NO TRADE' && (
            <span className={`text-xs px-2 py-0.5 rounded border ${
              macroDirection === 'LONG'
                ? 'text-emerald-400 bg-emerald-950 border-emerald-800'
                : 'text-rose-400 bg-rose-950 border-rose-800'
            }`}>
              Macro: {macroDirection}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          <span className="hidden sm:block">DAX max {MAX_STOP.DAX}pts · FTSE max {MAX_STOP.FTSE}pts</span>
        </div>
      </div>

      <div className="p-4">
        {/* Controls grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Instrument */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Instrument</label>
            <div className="flex gap-1">
              {(['DAX', 'FTSE'] as Instrument[]).map((inst) => (
                <button
                  key={inst}
                  onClick={() => setInstrument(inst)}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                    instrument === inst
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Direction</label>
            <div className="flex gap-1">
              {(['LONG', 'SHORT'] as Direction[]).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                    direction === dir
                      ? dir === 'LONG'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {dir === 'LONG' ? '↑' : '↓'} {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Entry price */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Entry / Key Level</label>
            <input
              type="number"
              value={entryStr}
              onChange={(e) => setEntryStr(e.target.value)}
              placeholder={String(TYPICAL_PRICES[instrument])}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors tabular-nums"
            />
          </div>

          {/* Stop distance */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">
              Stop Distance (pts · max {maxStop})
            </label>
            <input
              type="number"
              value={stopPtsStr}
              onChange={(e) => setStopPtsStr(e.target.value)}
              placeholder={`e.g. ${instrument === 'DAX' ? '60' : '25'}`}
              min={1}
              max={maxStop}
              className={`w-full px-3 py-2 bg-slate-800 border rounded text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors tabular-nums ${
                result?.stopWarning
                  ? 'border-rose-700 focus:border-rose-500'
                  : 'border-slate-700 hover:border-slate-500 focus:border-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Stop warning */}
        {result?.stopWarning && (
          <div className="flex items-center gap-2 p-2 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs mb-4">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {result.stopWarning}
          </div>
        )}

        {/* Results */}
        {result && result.isValidStop && (
          <div className="space-y-3 animate-slide-up">
            {/* Direction banner */}
            <div className={`flex items-center justify-between px-4 py-3 rounded border ${dirBg}`}>
              <div className="flex items-center gap-2">
                {direction === 'LONG'
                  ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                  : <TrendingDown className="w-5 h-5 text-rose-400" />}
                <span className={`text-lg font-bold ${dirColor}`}>{direction}</span>
                <span className="text-slate-500 text-sm">{instrument}</span>
              </div>
              <div className="text-right text-xs text-slate-400 space-y-0.5">
                <div>Risk: <span className="text-slate-200 tabular-nums">{fmt(result.riskPts, 1)} pts ({result.riskPct.toFixed(2)}%)</span></div>
                <div>R:R targets: <span className="text-slate-200">1R · 1.5R · 2R</span></div>
              </div>
            </div>

            {/* Price levels */}
            <div className="space-y-1.5">
              <LevelRow
                label={direction === 'LONG' ? '▲ STOP LOSS (below entry)' : '▼ STOP LOSS (above entry)'}
                value={result.stopLoss}
                pts={direction === 'LONG' ? -result.riskPts : result.riskPts}
                color="text-rose-400"
                icon={<Shield className="w-4 h-4 text-rose-500" />}
              />

              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 py-0.5">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-2">ENTRY</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <LevelRow
                label="⊙ ENTRY"
                value={result.entry}
                color="text-amber-400"
                icon={<ChevronRight className="w-4 h-4 text-amber-500" />}
                highlight
              />

              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 py-0.5">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-2">TARGETS</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <LevelRow
                label="◎ BREAK EVEN (1R) — move stop here"
                value={result.breakEven1R}
                pts={direction === 'LONG' ? result.reward1R : -result.reward1R}
                color="text-sky-400"
                icon={<Target className="w-4 h-4 text-sky-500" />}
              />
              <LevelRow
                label="◈ TARGET 1.5R"
                value={result.target15R}
                pts={direction === 'LONG' ? result.reward15R : -result.reward15R}
                color="text-emerald-400"
                icon={<Target className="w-4 h-4 text-emerald-600" />}
              />
              <LevelRow
                label="★ TARGET 2R — full profit"
                value={result.target2R}
                pts={direction === 'LONG' ? result.reward2R : -result.reward2R}
                color="text-emerald-300"
                icon={<Target className="w-4 h-4 text-emerald-400" />}
              />
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Risk (pts)', value: fmt(result.riskPts, 1), color: 'text-rose-400' },
                { label: 'Reward 1R', value: fmt(result.reward1R, 1) + 'pts', color: 'text-sky-400' },
                { label: 'Reward 1.5R', value: fmt(result.reward15R, 1) + 'pts', color: 'text-emerald-400' },
                { label: 'Reward 2R', value: fmt(result.reward2R, 1) + 'pts', color: 'text-emerald-300' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-800/40 rounded p-2 text-center">
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Position sizing helper */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Position Size Helper</span>
                <span className="text-xs text-slate-600">(£/€ per point)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-slate-500">Risk £/€:</span>
                  <input
                    type="number"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(e.target.value)}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded text-xs text-slate-200 outline-none tabular-nums"
                  />
                </div>
                {lotSuggestion && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Suggested size: </span>
                    <span className="text-sm font-bold text-amber-400 tabular-nums">
                      £{lotSuggestion}/pt
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && (
          <div className="text-center py-6 text-slate-600 text-sm">
            Enter entry price and stop distance to calculate trade levels
          </div>
        )}
      </div>
    </div>
  );
}
