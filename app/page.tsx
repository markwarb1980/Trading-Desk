'use client';

import Header from '@/components/Header';
import MacroScore from '@/components/MacroScore';
import MacroFromCharts from '@/components/MacroFromCharts';
import LivePrices from '@/components/LivePrices';
import ChartAnalysis from '@/components/ChartAnalysis';
import TradeCalculator from '@/components/TradeCalculator';
import NewsCalendar from '@/components/NewsCalendar';
import { useState } from 'react';

export interface MacroData {
  scores: {
    geopolitical_risk: number;
    central_banks: number;
    market_direction: number;
    news_adjustment: number;
  };
  total_score: number;
  tier: number | string;
  direction: 'LONG' | 'SHORT' | 'NO TRADE';
  reasoning: {
    geopolitical_risk: string;
    central_banks: string;
    market_direction: string;
    news_adjustment: string;
  };
  summary: string;
  key_risks: string[];
  prices_found?: Record<string, string>;
  timestamp: string;
}

export interface PricesData {
  gold: PriceItem;
  brent_oil: PriceItem;
  gbp_usd: PriceItem;
  eur_usd: PriceItem;
  sp500: PriceItem;
  dax: PriceItem;
  ftse100: PriceItem;
  timestamp: string;
}

export interface PriceItem {
  price: string;
  change: string;
  change_pct: string;
  direction: 'up' | 'down' | 'flat';
}

export default function TradingDashboard() {
  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [, setPricesData] = useState<PricesData | null>(null);
  const [macroTab, setMacroTab] = useState<'ai' | 'charts'>('charts');

  return (
    <div className="min-h-screen bg-slate-950 font-mono">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-8 space-y-4">

        {/* Row 1: Macro Score + Live Prices */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Macro panel with tab switcher */}
          <div className="xl:col-span-3">
            {/* Tab switcher */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setMacroTab('charts')}
                className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                  macroTab === 'charts'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}
              >
                📊 MACRO FROM CHARTS
              </button>
              <button
                onClick={() => setMacroTab('ai')}
                className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${
                  macroTab === 'ai'
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}
              >
                🌐 AI + WEB SEARCH
              </button>
            </div>

            {macroTab === 'charts' && <MacroFromCharts />}
            {macroTab === 'ai' && <MacroScore onDataUpdate={setMacroData} />}
          </div>

          <div className="xl:col-span-2">
            <LivePrices onDataUpdate={setPricesData} />
          </div>
        </div>

        {/* Row 2: Trade Calculator */}
        <TradeCalculator macroDirection={macroData?.direction} />

        {/* Row 3: Chart Analysis (15M) + News */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartAnalysis />
          <NewsCalendar />
        </div>

      </main>

      <footer className="border-t border-slate-800 py-4 px-4 text-center">
        <p className="text-slate-600 text-xs">
          GS Trading Desk — For informational purposes only. Not financial advice.
          AI analysis powered by Claude (Anthropic).
        </p>
      </footer>
    </div>
  );
}
