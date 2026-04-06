'use client';

import { useEffect, useState } from 'react';

const TICKER_ITEMS = [
  { symbol: 'AAPL', price: 228.42, change: 0.84 },
  { symbol: 'MSFT', price: 415.50, change: -0.32 },
  { symbol: 'GOOGL', price: 171.20, change: 1.12 },
  { symbol: 'AMZN', price: 178.25, change: 0.56 },
  { symbol: 'BTC', price: 43250, change: 2.1 },
  { symbol: 'ETH', price: 2280, change: -0.8 },
  { symbol: 'NVDA', price: 495.00, change: 1.45 },
  { symbol: 'META', price: 485.30, change: -0.22 },
  { symbol: 'TSLA', price: 248.90, change: 0.91 },
  { symbol: 'SOL', price: 98.50, change: 3.2 },
  { symbol: 'XRP', price: 0.62, change: -1.1 },
  { symbol: 'SPY', price: 502.15, change: 0.35 },
];

function TickerContent() {
  const list = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="flex shrink-0 gap-8 animate-ticker">
      {list.map((item, i) => (
        <span key={`${item.symbol}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-semibold text-white">{item.symbol}</span>
          <span className="text-secondary-300">${typeof item.price === 'number' && item.price < 100 ? item.price.toFixed(2) : item.price.toLocaleString()}</span>
          <span className={item.change >= 0 ? 'text-green-400' : 'text-red-400'}>
            {item.change >= 0 ? '+' : ''}{item.change}%
          </span>
        </span>
      ))}
    </div>
  );
}

export function MarketTicker() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="relative z-[60] overflow-hidden border-b border-secondary-200 bg-secondary-900 py-2 text-sm text-white">
      <div className="flex w-max gap-8">
        <TickerContent />
      </div>
    </div>
  );
}
