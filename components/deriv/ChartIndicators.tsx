'use client';

/**
 * Chart Indicators Component
 * 
 * Displays technical indicators overlay on charts
 */

import { useEffect, useRef } from 'react';
import { calculateRSIWithTime, getRSISignal } from '@/lib/indicators/rsi';
import { calculateMACDWithTime, getMACDSignal } from '@/lib/indicators/macd';
import { calculateSMAWithTime, calculateEMAWithTime } from '@/lib/indicators/moving-averages';
import { calculateBollingerBandsWithTime } from '@/lib/indicators/bollinger-bands';
import { ChartDataPoint } from './DerivChart';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface IndicatorConfig {
  type: 'RSI' | 'MACD' | 'SMA' | 'EMA' | 'BollingerBands';
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  multiplier?: number;
  color?: string;
  enabled: boolean;
}

export interface ChartIndicatorsProps {
  data: ChartDataPoint[];
  indicators: IndicatorConfig[];
  height?: number;
  className?: string;
}

export default function ChartIndicators({
  data,
  indicators,
  height = 150,
  className,
}: ChartIndicatorsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabledIndicators = indicators.filter(ind => ind.enabled);

  useEffect(() => {
    if (!canvasRef.current || enabledIndicators.length === 0 || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const chartHeight = height;
    const padding = 20;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, chartHeight);

    // Draw each indicator
    enabledIndicators.forEach((indicator, index) => {
      const yOffset = (chartHeight / enabledIndicators.length) * index;
      const indicatorHeight = chartHeight / enabledIndicators.length;

      if (indicator.type === 'RSI') {
        drawRSI(ctx, data, indicator, width, indicatorHeight, yOffset, padding);
      } else if (indicator.type === 'MACD') {
        drawMACD(ctx, data, indicator, width, indicatorHeight, yOffset, padding);
      } else if (indicator.type === 'SMA' || indicator.type === 'EMA') {
        drawMA(ctx, data, indicator, width, indicatorHeight, yOffset, padding);
      } else if (indicator.type === 'BollingerBands') {
        drawBollingerBands(ctx, data, indicator, width, indicatorHeight, yOffset, padding);
      }
    });
  }, [data, indicators, enabledIndicators, height]);

  if (enabledIndicators.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full"
      />
      <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
        {enabledIndicators.map((ind, i) => (
          <Badge key={i} variant="outline" className="text-xs" style={{ borderColor: ind.color || '#3b82f6' }}>
            {ind.type}
            {ind.period && ` (${ind.period})`}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function drawRSI(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  config: IndicatorConfig,
  width: number,
  height: number,
  yOffset: number,
  padding: number
) {
  const rsiData = calculateRSIWithTime(
    data.map(d => ({ time: d.time, close: d.close })),
    config.period || 14
  );

  if (rsiData.length === 0) return;

  const chartWidth = width - padding * 2;
  const barWidth = chartWidth / rsiData.length;

  // Draw RSI levels (30, 50, 70)
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  [30, 50, 70].forEach(level => {
    const y = yOffset + height - ((level / 100) * (height - padding * 2)) - padding;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  });

  // Draw RSI line
  ctx.strokeStyle = config.color || '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();

  rsiData.forEach((point, i) => {
    const x = padding + i * barWidth;
    const y = yOffset + height - ((point.value / 100) * (height - padding * 2)) - padding;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw overbought/oversold zones
  if (rsiData.length > 0) {
    const lastRSI = rsiData[rsiData.length - 1];
    const signal = getRSISignal(lastRSI.value);

    if (signal === 'overbought') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.fillRect(padding, yOffset + padding, chartWidth, (height - padding * 2) * 0.3);
    } else if (signal === 'oversold') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.fillRect(padding, yOffset + height - padding - (height - padding * 2) * 0.3, chartWidth, (height - padding * 2) * 0.3);
    }
  }
}

function drawMACD(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  config: IndicatorConfig,
  width: number,
  height: number,
  yOffset: number,
  padding: number
) {
  const macdData = calculateMACDWithTime(
    data.map(d => ({ time: d.time, close: d.close })),
    config.fastPeriod || 12,
    config.slowPeriod || 26,
    config.signalPeriod || 9
  );

  if (macdData.length === 0) return;

  const chartWidth = width - padding * 2;
  const barWidth = chartWidth / macdData.length;

  // Find min/max for scaling
  const allValues = macdData.flatMap(d => [d.macd, d.signal, d.histogram]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  // Draw zero line
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  const zeroY = yOffset + height - ((0 - min) / range) * (height - padding * 2) - padding;
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(width - padding, zeroY);
  ctx.stroke();

  // Draw MACD line
  ctx.strokeStyle = config.color || '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  macdData.forEach((point, i) => {
    const x = padding + i * barWidth;
    const y = yOffset + height - ((point.macd - min) / range) * (height - padding * 2) - padding;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Signal line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  macdData.forEach((point, i) => {
    const x = padding + i * barWidth;
    const y = yOffset + height - ((point.signal - min) / range) * (height - padding * 2) - padding;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Histogram
  macdData.forEach((point, i) => {
    const x = padding + i * barWidth;
    const barHeight = (Math.abs(point.histogram) / range) * (height - padding * 2);
    const y = zeroY - (point.histogram > 0 ? barHeight : 0);

    ctx.fillStyle = point.histogram > 0 ? '#10b981' : '#ef4444';
    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  });
}

function drawMA(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  config: IndicatorConfig,
  width: number,
  height: number,
  yOffset: number,
  padding: number
) {
  const maData = config.type === 'SMA'
    ? calculateSMAWithTime(data.map(d => ({ time: d.time, close: d.close })), config.period || 20)
    : calculateEMAWithTime(data.map(d => ({ time: d.time, close: d.close })), config.period || 20);

  if (maData.length === 0) return;

  const chartWidth = width - padding * 2;
  const barWidth = chartWidth / maData.length;

  // Find min/max for scaling
  const prices = data.map(d => d.close);
  const maValues = maData.map(d => d.value);
  const min = Math.min(...prices, ...maValues);
  const max = Math.max(...prices, ...maValues);
  const range = max - min || 1;

  // Draw MA line
  ctx.strokeStyle = config.color || '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  maData.forEach((point, i) => {
    const x = padding + i * barWidth;
    const y = yOffset + height - ((point.value - min) / range) * (height - padding * 2) - padding;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBollingerBands(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  config: IndicatorConfig,
  width: number,
  height: number,
  yOffset: number,
  padding: number
) {
  const bands = calculateBollingerBandsWithTime(
    data.map(d => ({ time: d.time, close: d.close })),
    config.period || 20,
    config.multiplier || 2
  );

  if (bands.length === 0) return;

  const chartWidth = width - padding * 2;
  const barWidth = chartWidth / bands.length;

  // Find min/max for scaling
  const allValues = bands.flatMap(b => [b.upper, b.middle, b.lower]);
  const prices = data.map(d => d.close);
  const min = Math.min(...allValues, ...prices);
  const max = Math.max(...allValues, ...prices);
  const range = max - min || 1;

  // Draw bands area
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.beginPath();
  bands.forEach((band, i) => {
    const x = padding + i * barWidth;
    const upperY = yOffset + height - ((band.upper - min) / range) * (height - padding * 2) - padding;
    if (i === 0) ctx.moveTo(x, upperY);
    else ctx.lineTo(x, upperY);
  });
  bands.reverse().forEach((band, i) => {
    const x = padding + (bands.length - 1 - i) * barWidth;
    const lowerY = yOffset + height - ((band.lower - min) / range) * (height - padding * 2) - padding;
    ctx.lineTo(x, lowerY);
  });
  ctx.closePath();
  ctx.fill();

  // Draw middle line
  ctx.strokeStyle = config.color || '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  bands.forEach((band, i) => {
    const x = padding + i * barWidth;
    const y = yOffset + height - ((band.middle - min) / range) * (height - padding * 2) - padding;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

