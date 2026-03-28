'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, Target, Shield,
  AlertTriangle, Info, ChevronRight,
} from 'lucide-react';

type Direction = 'LONG' | 'SHORT';
type Instrument = 'DAX' | 'FTSE';
type Tier = 1 | 2;

interface CalcResult {
  entry: number;
  stopLoss: number;
  breakEven: number;      // 8-10pts BEYOND entry (not exactly at entry)
  target15R: number;
  target2R: number;
  riskPts: number;
  reward15R: number;
  reward2R: number;
  isValidStop: boolean;
  stopWarning: string | null;
}

interface Props {
  macroDirection?: Direction | 'NO TRADE';
  macroTier?: number | string;
  macroTradeable?: boolean;
}

const MAX_STOP: Record<Instrument, number> = { DAX: 120, FTSE: 50 };
const TYPICAL_PRICES: Record<Instrument, number> = { DAX: 18000, FTSE: 8000 };
const BE_BUFFER = 9; // 8-10pts beyond entry for break even stop

function calculate(instrument: Instrument, direction: Direction, entry: number, stopPts: number): CalcResult {
  const maxStop = MAX_STOP[instrument];
  const isValidStop = stopPts > 0 && stopPts <= maxStop;
  const stopWarning = stopPts > maxStop
    ? `Stop exceeds max ${maxStop}pts for ${instrument}`
    : stopPts <= 0 ? 'Stop distance must be greater than 0' : null;

  const sl   = direction === 'LONG' ? entry - stopPts : entry + stopPts;
  // Break even = move stop to 8-10pts BEYOND entry (not exactly at entry)
  const be   = direction === 'LONG' ? entry + BE_BUFFER : entry - BE_BUFFER;
  const t15r = direction === 'LONG' ? entry + stopPts * 1.5 : entry - stopPts * 1.5;
  const t2r  = direction === 'LONG' ? entry + stopPts * 2   : entry - stopPts * 2;

  return {
    entry, stopLoss: sl, breakEven: be,
    target15R: t15r, target2R: t2r,
    riskPts: stopPts,
    reward15R: stopPts * 1.5, reward2R: stopPts * 2,
    isValidStop, stopWarning,
  };
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function LevelRow({ label, value, pts, color, icon, highlight, dim }: {
  label: string; value: number; pts?: number; color: string;
  icon: React.ReactNode; highlight?: boolean; dim?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded border transition-all ${
      highlight ? 'bg-amber-950/30 border-amber-800/50' :
      dim ? 'bg-slate-800/20 border-slate-800/40 opacity-60' :
      'bg-slate-800/40 border-slate-800/60'
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

export default function TradeCalculator({ macroDirection, macroTier, macroTradeable }: Props) {
  const [instrument, setInstrument] = useState<Instrument>('DAX');
  const [direction, setDirection] = useState<Direction>('LONG');
  const [tier, setTier] = useState<Tier>(1);
  const [entryStr, setEntryStr] = useState('');
  const [stopPtsStr, setStopPtsStr] = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [riskAmount, setRiskAmount] = useState('1000');

  // Sync from macro score
  useEffect(() => {
    if (macroDirection === 'LONG' || macroDirection === 'SHORT') setDirection(macroDirection);
  }, [macroDirection]);

  useEffect(() => {
    const t = Number(macroTier);
    if (t === 1 || t === 2) setTier(t as Tier);
  }, [macroTier]);

  const compute = useCallback(() => {
    const entry = parseFloat(entryStr);
    const stopPts = parseFloat(stopPtsStr);
    if (isNaN(entry) || isNaN(stopPts) || entry <= 0) { setResult(null); return; }
    setResult(calculate(instrument, direction, entry, stopPts));
  }, [entryStr, stopPtsStr, instrument, direction]);

  useEffect(() => { compute(); }, [compute]);

  const maxStop = MAX_STOP[instrument];
  const dirColor = direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400';
  const dirBg    = direction === 'LONG' ? 'bg-emerald-950 border-emerald-700' : 'bg-rose-950 border-rose-700';
  const riskPct  = tier === 1 ? '1%' : '0.5%';
  const riskAmountNum = parseFloat(riskAmount) || 1000;
  const lotSuggestion = result?.isValidStop && result.riskPts > 0
    ? (riskAmountNum / result.riskPts).toFixed(2) : null;

  // Tier 2: no runner, close all at 1.5R
  const isTier1 = tier === 1;

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">TRADE CALCULATOR</span>
          {macroDirection && macroDirection !== 'NO TRADE' && macroTradeable && (
            <span className={`text-xs px-2 py-0.5 rounded border ${
              macroDirection === 'LONG' ? 'text-emerald-400 bg-emerald-950 border-emerald-800'
                                       : 'text-rose-400 bg-rose-950 border-rose-800'
            }`}>Macro: {macroDirection} · T{macroTier}</span>
          )}
          {macroDirection && !macroTradeable && (
            <span className="text-xs px-2 py-0.5 rounded border text-rose-400 bg-rose-950 border-rose-900">
              ⛔ NO TRADE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          <span className="hidden sm:block">DAX {MAX_STOP.DAX}pts · FTSE {MAX_STOP.FTSE}pts · BE +{BE_BUFFER}pts</span>
        </div>
      </div>

      <div className="p-4">
        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Instrument */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Instrument</label>
            <div className="flex gap-1">
              {(['DAX', 'FTSE'] as Instrument[]).map((inst) => (
                <button key={inst} onClick={() => setInstrument(inst)}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                    instrument === inst ? 'bg-amber-500 text-slate-950 border-amber-500'
                                       : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>{inst}</button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Direction</label>
            <div className="flex gap-1">
              {(['LONG', 'SHORT'] as Direction[]).map((dir) => (
                <button key={dir} onClick={() => setDirection(dir)}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                    direction === dir
                      ? dir === 'LONG' ? 'bg-emerald-600 text-white border-emerald-600'
                                       : 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>{dir === 'LONG' ? '↑' : '↓'} {dir}</button>
              ))}
            </div>
          </div>

          {/* Entry */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Entry / Key Level</label>
            <input type="number" value={entryStr} onChange={(e) => setEntryStr(e.target.value)}
              placeholder={String(TYPICAL_PRICES[instrument])}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded text-sm text-slate-200 placeholder-slate-600 outline-none tabular-nums" />
          </div>

          {/* Stop */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">
              Stop Dist. (pts · max {maxStop})
            </label>
            <input type="number" value={stopPtsStr} onChange={(e) => setStopPtsStr(e.target.value)}
              placeholder={`e.g. ${instrument === 'DAX' ? '60' : '25'}`}
              min={1} max={maxStop}
              className={`w-full px-3 py-2 bg-slate-800 border rounded text-sm text-slate-200 placeholder-slate-600 outline-none tabular-nums ${
                result?.stopWarning ? 'border-rose-700' : 'border-slate-700 hover:border-slate-500 focus:border-amber-500'
              }`} />
          </div>
        </div>

        {/* Tier selector */}
        <div className="flex gap-2 mb-4">
          <span className="text-xs text-slate-500 self-center">Tier:</span>
          {([1, 2] as Tier[]).map((t) => (
            <button key={t} onClick={() => setTier(t)}
              className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${
                tier === t
                  ? t === 1 ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-sky-700 text-white border-sky-700'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
              }`}>
              TIER {t} — {t === 1 ? 'Full size · 1% risk' : 'Half size · 0.5% risk'}
            </button>
          ))}
        </div>

        {/* Stop warning */}
        {result?.stopWarning && (
          <div className="flex items-center gap-2 p-2 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs mb-4">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {result.stopWarning}
          </div>
        )}

        {/* Results */}
        {result?.isValidStop && (
          <div className="space-y-3 animate-slide-up">
            {/* Direction banner */}
            <div className={`flex items-center justify-between px-4 py-3 rounded border ${dirBg}`}>
              <div className="flex items-center gap-2">
                {direction === 'LONG' ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                                      : <TrendingDown className="w-5 h-5 text-rose-400" />}
                <span className={`text-lg font-bold ${dirColor}`}>{direction}</span>
                <span className="text-slate-500 text-sm">{instrument}</span>
                <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
                  tier === 1 ? 'text-amber-400 bg-amber-950 border-amber-700'
                             : 'text-sky-400 bg-sky-950 border-sky-700'
                }`}>TIER {tier} · {riskPct}</span>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Risk: <span className="text-slate-200 tabular-nums">{fmt(result.riskPts, 1)}pts</span></div>
                <div className="text-slate-500 text-xs">BE stop: entry {direction === 'LONG' ? '+' : '-'}{BE_BUFFER}pts</div>
              </div>
            </div>

            {/* Price levels */}
            <div className="space-y-1.5">
              <LevelRow label={direction === 'LONG' ? '▼ STOP LOSS (below entry)' : '▲ STOP LOSS (above entry)'}
                value={result.stopLoss} pts={direction === 'LONG' ? -result.riskPts : result.riskPts}
                color="text-rose-400" icon={<Shield className="w-4 h-4 text-rose-500" />} />

              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 py-0.5">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-2">ENTRY</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <LevelRow label="⊙ ENTRY — next 15M candle open after CLOSE confirms"
                value={result.entry} color="text-amber-400"
                icon={<ChevronRight className="w-4 h-4 text-amber-500" />} highlight />

              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 py-0.5">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-2">TARGETS</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <LevelRow label={`◎ BREAK EVEN STOP — move here after price moves ${BE_BUFFER}pts in your favour`}
                value={result.breakEven} color="text-slate-400"
                icon={<Shield className="w-4 h-4 text-slate-500" />} />

              <LevelRow
                label={isTier1 ? '◈ TARGET 1.5R — PARTIAL close here (Tier 1)' : '★ TARGET 1.5R — CLOSE ALL here (Tier 2)'}
                value={result.target15R} pts={direction === 'LONG' ? result.reward15R : -result.reward15R}
                color={isTier1 ? 'text-emerald-400' : 'text-sky-400'}
                icon={<Target className="w-4 h-4 text-emerald-500" />} />

              {isTier1 && (
                <LevelRow label="★ TARGET 2R — RUNNER closes here · move stop to BE first"
                  value={result.target2R} pts={direction === 'LONG' ? result.reward2R : -result.reward2R}
                  color="text-emerald-300" icon={<Target className="w-4 h-4 text-emerald-400" />} />
              )}

              {!isTier1 && (
                <LevelRow label="— 2R runner not taken on Tier 2 trades"
                  value={result.target2R} pts={direction === 'LONG' ? result.reward2R : -result.reward2R}
                  color="text-slate-600" icon={<Target className="w-4 h-4 text-slate-700" />} dim />
              )}
            </div>

            {/* Tier rules reminder */}
            <div className={`rounded p-3 border text-xs space-y-1 ${
              tier === 1 ? 'bg-amber-950/20 border-amber-900/30' : 'bg-sky-950/20 border-sky-900/30'
            }`}>
              <div className={`font-bold ${tier === 1 ? 'text-amber-400' : 'text-sky-400'}`}>
                Tier {tier} Rules
              </div>
              {tier === 1 ? (
                <>
                  <div className="text-slate-400">• Partial close at 1.5R · Run remainder to 2R</div>
                  <div className="text-slate-400">• Move stop to BE ({BE_BUFFER}pts beyond entry) after partial</div>
                  <div className="text-slate-400">• Hard exit by 21:00 IST · No overnight holds</div>
                </>
              ) : (
                <>
                  <div className="text-slate-400">• KEY level required for entry</div>
                  <div className="text-slate-400">• Close ALL at 1.5R — no runner</div>
                  <div className="text-slate-400">• Hard exit by 21:00 IST · No overnight holds</div>
                </>
              )}
              <div className="text-slate-500 pt-1">Max 1 trade per market · Daily stop: 2% account</div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Risk', value: fmt(result.riskPts, 1) + 'pts', color: 'text-rose-400' },
                { label: 'BE Stop', value: `${direction === 'LONG' ? '+' : '-'}${BE_BUFFER}pts`, color: 'text-slate-400' },
                { label: '1.5R Target', value: fmt(result.reward15R, 1) + 'pts', color: tier === 1 ? 'text-emerald-400' : 'text-sky-400' },
                { label: isTier1 ? '2R Runner' : '2R (N/A)', value: fmt(result.reward2R, 1) + 'pts', color: isTier1 ? 'text-emerald-300' : 'text-slate-600' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-800/40 rounded p-2 text-center">
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Position sizing */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Position Size</span>
                <span className="text-xs text-slate-600">£/€ per point</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Risk £/€:</span>
                  <input type="number" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded text-xs text-slate-200 outline-none tabular-nums" />
                </div>
                {lotSuggestion && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Size: </span>
                    <span className="text-sm font-bold text-amber-400">£{lotSuggestion}/pt</span>
                    <span className="text-xs text-slate-600 ml-1">({riskPct} risk)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="text-center py-6 text-slate-600 text-sm">
            Enter entry price and stop distance to calculate levels
          </div>
        )}
      </div>
    </div>
  );
}
