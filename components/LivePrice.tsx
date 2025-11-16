'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { marketDataService, LivePriceData } from '@/lib/services/market-data.service';

interface LivePriceProps {
  symbol: string;
  showChange?: boolean;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LivePrice({
  symbol,
  showChange = true,
  showPercent = true,
  size = 'md',
  className = '',
}: LivePriceProps) {
  const [priceData, setPriceData] = useState<LivePriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    // Fetch initial price
    marketDataService.getCurrentPrice(symbol)
      .then((data) => {
        if (isMounted && data) {
          setPriceData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // Subscribe to live updates (uses polling by default)
    unsubscribe = marketDataService.subscribe(symbol, (data) => {
      if (isMounted) {
        setPriceData(data);
        setIsLoading(false);
      }
    });

    // Set up periodic refresh as fallback
    const refreshInterval = setInterval(() => {
      if (isMounted && !priceData) {
        marketDataService.getCurrentPrice(symbol)
          .then((data) => {
            if (isMounted && data) {
              setPriceData(data);
              setIsLoading(false);
            }
          })
          .catch(() => {
            // Silently handle errors
          });
      }
    }, 10000); // Refresh every 10 seconds if no data

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      clearInterval(refreshInterval);
    };
  }, [symbol]);

  if (isLoading && !priceData) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse bg-gray-700 rounded h-4 w-20" />
      </div>
    );
  }

  if (!priceData) {
    // Show symbol as fallback if price unavailable
    return (
      <span className={`text-gray-400 text-xs ${className}`} title="Price unavailable">
        {symbol}
      </span>
    );
  }

  const isPositive = priceData.changePercent >= 0;
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-semibold ${sizeClasses[size]}`}>
        ${priceData.price.toFixed(2)}
      </span>
      
      {showChange && (
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {showPercent ? (
            <span className={`text-xs ${sizeClasses[size]}`}>
              {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
            </span>
          ) : (
            <span className={`text-xs ${sizeClasses[size]}`}>
              {isPositive ? '+' : ''}${priceData.change.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

