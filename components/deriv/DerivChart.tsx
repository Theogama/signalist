'use client';

/**
 * Deriv Chart Component
 * 
 * Main chart component for displaying Deriv market data.
 * Supports tick charts, candlestick charts, and technical indicators.
 */

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChartIndicators, { IndicatorConfig } from './ChartIndicators';

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface DerivChartProps {
  symbol: string;
  type?: 'candlestick' | 'line' | 'area';
  timeframe?: '1t' | '5t' | '15t' | '30t' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  height?: number;
  showIndicators?: boolean;
  indicators?: string[];
  className?: string;
  onDataUpdate?: (data: ChartDataPoint[]) => void;
}

export default function DerivChart({
  symbol,
  type = 'candlestick',
  timeframe = '1m',
  height = 400,
  showIndicators = false,
  indicators = [],
  className,
  onDataUpdate,
}: DerivChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/deriv/market-data/history?symbol=${symbol}&timeframe=${timeframe}&count=100`);
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
          if (result.data.length > 0) {
            const latest = result.data[result.data.length - 1];
            setCurrentPrice(latest.close);
            if (result.data.length > 1) {
              const previous = result.data[result.data.length - 2];
              setPriceChange(latest.close - previous.close);
            }
          }
          if (onDataUpdate) {
            onDataUpdate(result.data);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [symbol, timeframe, onDataUpdate]);

  // Draw chart on canvas
  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    // Calculate price range
    const prices = data.flatMap(d => [d.high, d.low]);
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

    // Draw candlesticks or line
    const barWidth = chartWidth / data.length;
    const barSpacing = barWidth * 0.1;

    data.forEach((point, index) => {
      const x = padding + index * barWidth;
      const openY = padding + chartHeight - (point.open - minPrice) * priceScale;
      const closeY = padding + chartHeight - (point.close - minPrice) * priceScale;
      const highY = padding + chartHeight - (point.high - minPrice) * priceScale;
      const lowY = padding + chartHeight - (point.low - minPrice) * priceScale;

      if (type === 'candlestick') {
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
      } else if (type === 'line') {
        if (index > 0) {
          const prevX = padding + (index - 1) * barWidth;
          const prevY = padding + chartHeight - (data[index - 1].close - minPrice) * priceScale;
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prevX + barWidth / 2, prevY);
          ctx.lineTo(x + barWidth / 2, closeY);
          ctx.stroke();
        }
      }
    });

    // Draw current price line
    if (currentPrice > 0) {
      const priceY = padding + chartHeight - (currentPrice - minPrice) * priceScale;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, priceY);
      ctx.lineTo(width - padding, priceY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, type, currentPrice]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height }}>
            <div className="text-gray-400">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center text-red-400" style={{ height }}>
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-gray-700 bg-gray-900', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-100">{symbol}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-100">
                {currentPrice.toFixed(2)}
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
          <div className="flex items-center gap-2">
            <Select value={timeframe} onValueChange={(value) => {
              // Handle timeframe change
              window.location.href = `?timeframe=${value}`;
            }}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1t">1 Tick</SelectItem>
                <SelectItem value="5t">5 Ticks</SelectItem>
                <SelectItem value="15t">15 Ticks</SelectItem>
                <SelectItem value="1m">1 Min</SelectItem>
                <SelectItem value="5m">5 Min</SelectItem>
                <SelectItem value="15m">15 Min</SelectItem>
                <SelectItem value="30m">30 Min</SelectItem>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="4h">4 Hours</SelectItem>
                <SelectItem value="1d">1 Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={height}
            className="w-full"
          />
          {showIndicators && indicators.length > 0 && (
            <>
              <div className="absolute top-2 left-2 flex gap-2 flex-wrap z-10">
                {indicators.map((indicator) => (
                  <Badge key={indicator} variant="outline" className="text-xs">
                    {indicator}
                  </Badge>
                ))}
              </div>
              <div className="mt-2">
                <ChartIndicators
                  data={data}
                  indicators={indicators.map(ind => ({
                    type: ind as IndicatorConfig['type'],
                    enabled: true,
                    period: 14,
                  }))}
                  height={150}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

