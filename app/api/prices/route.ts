import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const maxDuration = 30;
export const runtime = 'nodejs';

// Yahoo Finance symbols for each instrument
const SYMBOLS = {
  gold:     'GC=F',     // Gold futures (XAU/USD)
  brent_oil:'BZ=F',     // Brent Crude futures
  gbp_usd:  'GBPUSD=X', // GBP/USD forex
  eur_usd:  'EURUSD=X', // EUR/USD forex
  sp500:    '^GSPC',    // S&P 500 index
  dax:      '^GDAXI',   // DAX index
  ftse100:  '^FTSE',    // FTSE 100 index
};

// Human-readable labels for display
const LABELS: Record<string, string> = {
  gold:     'Gold (XAU/USD)',
  brent_oil:'Brent Crude',
  gbp_usd:  'GBP/USD',
  eur_usd:  'EUR/USD',
  sp500:    'S&P 500',
  dax:      'DAX',
  ftse100:  'FTSE 100',
};

function formatPrice(price: number, key: string): string {
  // Forex pairs: 4 decimal places
  if (key === 'gbp_usd' || key === 'eur_usd') {
    return price.toFixed(4);
  }
  // Large indices & commodities: 2 decimal places
  return price.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(change: number, key: string): string {
  const sign = change >= 0 ? '+' : '';
  if (key === 'gbp_usd' || key === 'eur_usd') {
    return `${sign}${change.toFixed(4)}`;
  }
  return `${sign}${change.toFixed(2)}`;
}

export async function GET() {
  try {
    const keys = Object.keys(SYMBOLS) as (keyof typeof SYMBOLS)[];
    const symbolList = Object.values(SYMBOLS);

    // Fetch all quotes in one batch request
    const quotes = await yahooFinance.quote(symbolList);

    // Normalise to array regardless of return shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quoteArray: any[] = Array.isArray(quotes) ? quotes : [quotes];

    // Build a lookup by symbol
    const bySymbol: Record<string, unknown> = {};
    for (const q of quoteArray) {
      if (q?.symbol) bySymbol[q.symbol] = q;
    }

    const result: Record<string, unknown> = {};

    for (const key of keys) {
      const symbol = SYMBOLS[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = bySymbol[symbol];

      if (!q) {
        result[key] = {
          price: 'N/A',
          change: 'N/A',
          change_pct: 'N/A',
          direction: 'flat',
          label: LABELS[key],
        };
        continue;
      }

      const price   = q.regularMarketPrice ?? 0;
      const change  = q.regularMarketChange ?? 0;
      const pct     = q.regularMarketChangePercent ?? 0;
      const dir     = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

      result[key] = {
        price:      formatPrice(price, key),
        change:     formatChange(change, key),
        change_pct: `${change >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        direction:  dir,
        label:      LABELS[key],
      };
    }

    result.timestamp = new Date().toISOString();
    result.source    = 'Yahoo Finance';

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[prices] Yahoo Finance error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
