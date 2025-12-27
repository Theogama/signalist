'use client';

/**
 * Live Chart Component
 * 
 * Real-time chart that updates with live market data streaming.
 * Integrates with useDerivMarketData hook for live updates.
 */

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Wifi, WifiOff } from 'lucide-react';
import { useDerivMarketData } from '@/lib/hooks/useDerivMarketData';
import TimeframeSelector, { Timeframe } from './TimeframeSelector';
import { cn } from '@/lib/utils';

export interface LiveChartProps {
  symbol: string;
  timeframe?: Timeframe;
  height?: number;
  className?: string;
  showConnectionStatus?: boolean;
}

const timeframeToGranularity: Record<Timeframe, number> = {
  '1t': 1,
  '5t': 5,
  '15t': 15,
  '30t': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

export default function LiveChart({
  symbol,
  timeframe = '1m',
  height = 400,
  className,
  showConnectionStatus = true,
}: LiveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartData, setChartData] = useState<Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);

  const granularity = timeframeToGranularity[timeframe];
  const useOHLC = granularity >= 60; // Use OHLC for timeframes >= 1 minute

  // Fetch initial historical data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch(
          `/api/deriv/market-data/history?symbol=${symbol}&timeframe=${timeframe}&count=100`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setChartData(result.data);
            if (result.data.length > 0) {
              const latest = result.data[result.data.length - 1];
              setCurrentPrice(latest.close);
              if (result.data.length > 1) {
                const previous = result.data[result.data.length - 2];
                setPriceChange(latest.close - previous.close);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, [symbol, timeframe]);

  // Subscribe to live data
  const { tick, ohlc, isConnected, error } = useDerivMarketData({
    symbol,
    type: useOHLC ? 'ohlc' : 'ticks',
    granularity,
    enabled: true,
    onTick: (tickData) => {
      // Update current price for tick data
      setCurrentPrice(tickData.quote);
      if (chartData.length > 0) {
        const previous = chartData[chartData.length - 1];
        setPriceChange(tickData.quote - previous.close);
      }
    },
    onOHLC: (ohlcData) => {
      // Update chart with new OHLC candle
      const newCandle = {
        time: ohlcData.epoch * 1000,
        open: ohlcData.open,
        high: ohlcData.high,
        low: ohlcData.low,
        close: ohlcData.close,
      };

      setChartData(prev => {
        const updated = [...prev];
        const lastCandle = updated[updated.length - 1];
        
        // Check if this is an update to the last candle or a new one
        if (lastCandle && Math.abs(lastCandle.time - newCandle.time) < granularity * 1000) {
          // Update last candle
          updated[updated.length - 1] = newCandle;
        } else {
          // Add new candle
          updated.push(newCandle);
          // Keep only last 100 candles
          if (updated.length > 100) {
            updated.shift();
          }
        }
        
        return updated;
      });

      setCurrentPrice(ohlcData.close);
      if (chartData.length > 0) {
        const previous = chartData[chartData.length - 1];
        setPriceChange(ohlcData.close - previous.close);
      }
    },
  });

  // Draw chart
  useEffect(() => {
    if (!canvasRef.current || chartData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const chartHeight = height;
    const padding = 40;
    const chartWidth = width - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, chartHeight);

    // Calculate price range
    const prices = chartData.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const priceScale = chartHeight / priceRange;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw candlesticks
    const barWidth = chartWidth / chartData.length;
    const barSpacing = barWidth * 0.1;

    chartData.forEach((point, index) => {
      const x = padding + index * barWidth;
      const openY = padding + chartHeight - (point.open - minPrice) * priceScale;
      const closeY = padding + chartHeight - (point.close - minPrice) * priceScale;
      const highY = padding + chartHeight - (point.high - minPrice) * priceScale;
      const lowY = padding + chartHeight - (point.low - minPrice) * priceScale;

      // Draw wick
      ctx.strokeStyle = point.close >= point.open ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(x + barWidth / 2, highY);
      ctx.lineTo(x + barWidth / 2, lowY);
      ctx.stroke();

      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;
      ctx.fillStyle = point.close >= point.open ? '#10b981' : '#ef4444';
      ctx.fillRect(x + barSpacing, bodyTop, barWidth - barSpacing * 2, bodyHeight);
    });

    // Draw current price line
    if (currentPrice > 0) {
      const priceY = padding + chartHeight - (currentPrice - minPrice) * priceScale;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, priceY);
      ctx.lineTo(width - padding, priceY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [chartData, currentPrice, height]);

  return (
    <Card className={cn('border-gray-700 bg-gray-900', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-gray-100">{symbol}</CardTitle>
              {showConnectionStatus && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isConnected
                      ? 'border-green-500 text-green-400'
                      : 'border-red-500 text-red-400'
                  )}
                >
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Live
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 mr-1" />
                      Disconnected
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-100">
                {currentPrice > 0 ? currentPrice.toFixed(2) : '--'}
              </span>
              {priceChange !== 0 && (
                <span
                  className={cn(
                    'text-sm font-medium flex items-center gap-1',
                    priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {priceChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(priceChange).toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <TimeframeSelector
            value={timeframe}
            onChange={(tf) => {
              // Handle timeframe change
              window.location.href = `?timeframe=${tf}`;
            }}
            variant="select"
          />
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-400">
            Error: {error.message}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={height}
            className="w-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}


