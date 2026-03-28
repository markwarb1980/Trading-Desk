'use client';

import { useState, useCallback, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import type { PricesData, PriceItem } from '@/app/page';

interface Props {
  onDataUpdate?: (data: PricesData) => void;
}

const INSTRUMENTS = [
  { key: 'gold', label: 'Gold', symbol: 'XAU/USD', icon: '⊛', unit: '/oz' },
  { key: 'brent_oil', label: 'Brent Oil', symbol: 'BRENT', icon: '◈', unit: '/bbl' },
  { key: 'gbp_usd', label: 'GBP/USD', symbol: 'GBP/USD', icon: '£', unit: '' },
  { key: 'eur_usd', label: 'EUR/USD', symbol: 'EUR/USD', icon: '€', unit: '' },
  { key: 'sp500', label: 'S&P 500', symbol: 'SPX', icon: '◉', unit: '' },
  { key: 'dax', label: 'DAX', symbol: 'DAX', icon: '◉', unit: '' },
  { key: 'ftse100', label: 'FTSE 100', symbol: 'UKX', icon: '◉', unit: '' },
];

function PriceRow({ item, label, symbol }: { item: PriceItem; label: string; symbol: string }) {
  const isUp = item.direction === 'up';
  const isDown = item.direction === 'down';

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 px-1 rounded transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isUp ? 'bg-emerald-400' : isDown ? 'bg-rose-400' : 'bg-slate-500'
        }`} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-200 truncate">{label}</div>
          <div className="text-xs text-slate-600">{symbol}</div>
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-2">
        <div className={`text-sm font-bold tabular-nums ${
          isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-300'
        }`}>
          {item.price}
        </div>
        <div className={`text-xs tabular-nums flex items-center justify-end gap-0.5 ${
          isUp ? 'text-emerald-500' : isDown ? 'text-rose-500' : 'text-slate-500'
        }`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          <span>{item.change_pct}</span>
        </div>
      </div>
    </div>
  );
}

export default function LivePrices({ onDataUpdate }: Props) {
  const [data, setData] = useState<PricesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prices');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json: PricesData = await res.json();
      setData(json);
      onDataUpdate?.(json);
      setLastUpdated(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  }, [onDataUpdate]);

  // Auto-refresh every 90 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    fetchPrices();
    const interval = setInterval(fetchPrices, 90_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPrices]);

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">LIVE PRICES</span>
          {autoRefresh && (
            <span className="text-xs text-emerald-600 hidden sm:block">auto 90s</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-600 hidden sm:block">{lastUpdated}</span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-2 py-1 rounded text-xs border transition-colors ${
              autoRefresh
                ? 'border-emerald-700 text-emerald-500 bg-emerald-950 hover:bg-emerald-900'
                : 'border-slate-700 text-slate-500 bg-slate-800 hover:bg-slate-700'
            }`}
          >
            AUTO
          </button>
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            title="Refresh prices"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-3">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950 border border-rose-800 rounded text-rose-400 text-xs mb-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-2 animate-pulse">
            {INSTRUMENTS.map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-2">
            <Zap className="w-10 h-10 text-slate-700" />
            <div className="text-slate-500 text-sm">Fetching live prices...</div>
          </div>
        )}

        {/* Price list */}
        {data && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
            {INSTRUMENTS.map(({ key, label, symbol }) => {
              const item = data[key as keyof PricesData] as PriceItem | undefined;
              if (!item || typeof item !== 'object' || !('price' in item)) return null;
              return (
                <PriceRow key={key} item={item} label={label} symbol={symbol} />
              );
            })}
          </div>
        )}
      </div>

      {/* Market summary bar */}
      {data && (
        <div className="border-t border-slate-800 px-3 py-2">
          <MarketSummary data={data} />
        </div>
      )}
    </div>
  );
}

function MarketSummary({ data }: { data: PricesData }) {
  const keyMarkets = ['sp500', 'dax', 'ftse100'] as const;
  const labels: Record<string, string> = { sp500: 'S&P', dax: 'DAX', ftse100: 'FTSE' };

  const ups = keyMarkets.filter((k) => (data[k] as PriceItem)?.direction === 'up').length;
  const downs = keyMarkets.filter((k) => (data[k] as PriceItem)?.direction === 'down').length;

  let mood = 'NEUTRAL';
  let moodColor = 'text-slate-400';
  if (ups >= 2) { mood = 'RISK-ON'; moodColor = 'text-emerald-400'; }
  if (downs >= 2) { mood = 'RISK-OFF'; moodColor = 'text-rose-400'; }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {keyMarkets.map((k) => {
          const item = data[k] as PriceItem;
          if (!item) return null;
          const isUp = item.direction === 'up';
          const isDown = item.direction === 'down';
          return (
            <div key={k} className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">{labels[k]}</span>
              {isUp ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : isDown ? (
                <TrendingDown className="w-3 h-3 text-rose-500" />
              ) : (
                <Minus className="w-3 h-3 text-slate-500" />
              )}
            </div>
          );
        })}
      </div>
      <div className={`text-xs font-bold ${moodColor}`}>{mood}</div>
    </div>
  );
}
