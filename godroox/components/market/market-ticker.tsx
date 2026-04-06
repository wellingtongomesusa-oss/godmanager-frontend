'use client';

import { useState, useEffect } from 'react';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function MarketTicker() {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([
    { symbol: 'NDX', price: 23501.24, change: 65.78, changePercent: 0.28 },
    { symbol: 'DJI', price: 49098.71, change: -285.32, changePercent: -0.58 },
    { symbol: 'AAPL', price: 248.04, change: -0.30, changePercent: -0.12 },
    { symbol: 'MSFT', price: 465.95, change: 15.12, changePercent: 3.35 },
    { symbol: 'GOOGL', price: 327.94, change: -2.58, changePercent: -0.78 },
    { symbol: 'AMZN', price: 185.23, change: 2.45, changePercent: 1.34 },
    { symbol: 'TSLA', price: 245.67, change: -5.23, changePercent: -2.08 },
    { symbol: 'META', price: 512.34, change: 8.76, changePercent: 1.74 },
  ]);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerItems(prev => prev.map(item => {
        const randomChange = (Math.random() - 0.5) * 0.5;
        const newPrice = item.price * (1 + randomChange / 100);
        const newChange = newPrice - item.price;
        const newChangePercent = (newChange / item.price) * 100;
        return {
          ...item,
          price: Number(newPrice.toFixed(2)),
          change: Number(newChange.toFixed(2)),
          changePercent: Number(newChangePercent.toFixed(2)),
        };
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-secondary-900 text-white py-2 overflow-hidden relative">
      <div className="flex items-center gap-8 whitespace-nowrap" style={{
        animation: 'ticker-scroll 60s linear infinite',
      }}>
          <div className="flex items-center gap-2 px-4 flex-shrink-0">
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-wider">
              AÇÕES
            </span>
          </div>
          {tickerItems.map((item, index) => (
            <div key={index} className="flex items-center gap-3 whitespace-nowrap flex-shrink-0">
              <span className="font-semibold text-sm">{item.symbol}</span>
              <span className="text-sm">${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-sm font-medium ${item.change >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
              </span>
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {tickerItems.map((item, index) => (
            <div key={`dup-${index}`} className="flex items-center gap-3 whitespace-nowrap flex-shrink-0">
              <span className="font-semibold text-sm">{item.symbol}</span>
              <span className="text-sm">${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-sm font-medium ${item.change >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
