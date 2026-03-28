import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const runtime = 'nodejs';

const SYMBOLS: Record<string, { yahoo: string; label: string; decimals: number }> = {
  gold:      { yahoo: 'GC=F',      label: 'Gold (XAU/USD)',  decimals: 2 },
  brent_oil: { yahoo: 'BZ=F',      label: 'Brent Crude',     decimals: 2 },
  gbp_usd:   { yahoo: 'GBPUSD=X',  label: 'GBP/USD',         decimals: 4 },
  eur_usd:   { yahoo: 'EURUSD=X',  label: 'EUR/USD',         decimals: 4 },
  sp500:     { yahoo: '^GSPC',     label: 'S&P 500',         decimals: 2 },
  dax:       { yahoo: '^GDAXI',    label: 'DAX',             decimals: 2 },
  ftse100:   { yahoo: '^FTSE',     label: 'FTSE 100',        decimals: 2 },
};

async function fetchQuote(symbol: string): Promise<{
  price: number;
  change: number;
  changePct: number;
} | null> {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price      = meta.regularMarketPrice ?? 0;
  const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change     = price - prevClose;
  const changePct  = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return { price, change, changePct };
}

function fmt(n: number, decimals: number): string {
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export async function GET() {
  try {
    const keys = Object.keys(SYMBOLS);

    // Fetch all symbols in parallel
    const results = await Promise.allSettled(
      keys.map((key) => fetchQuote(SYMBOLS[key].yahoo))
    );

    const output: Record<string, unknown> = {};

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const { decimals, label } = SYMBOLS[key];
      const result = results[i];

      if (result.status === 'fulfilled' && result.value) {
        const { price, change, changePct } = result.value;
        const sign = change >= 0 ? '+' : '';
        output[key] = {
          price:      fmt(price, decimals),
          change:     `${sign}${fmt(change, decimals)}`,
          change_pct: `${sign}${changePct.toFixed(2)}%`,
          direction:  change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
          label,
        };
      } else {
        output[key] = {
          price: 'N/A', change: '--', change_pct: '--', direction: 'flat', label,
        };
      }
    }

    output.timestamp = new Date().toISOString();
    output.source    = 'Yahoo Finance';

    return NextResponse.json(output);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[prices] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
