'use client';

/**
 * Timeframe Selector Component
 * 
 * Allows users to select chart timeframes (1 tick, 1 min, 5 min, etc.)
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Timeframe = '1t' | '5t' | '15t' | '30t' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  className?: string;
  variant?: 'select' | 'buttons';
}

const timeframes: Array<{ value: Timeframe; label: string; group: string }> = [
  { value: '1t', label: '1 Tick', group: 'Ticks' },
  { value: '5t', label: '5 Ticks', group: 'Ticks' },
  { value: '15t', label: '15 Ticks', group: 'Ticks' },
  { value: '30t', label: '30 Ticks', group: 'Ticks' },
  { value: '1m', label: '1 Min', group: 'Minutes' },
  { value: '5m', label: '5 Min', group: 'Minutes' },
  { value: '15m', label: '15 Min', group: 'Minutes' },
  { value: '30m', label: '30 Min', group: 'Minutes' },
  { value: '1h', label: '1 Hour', group: 'Hours' },
  { value: '4h', label: '4 Hours', group: 'Hours' },
  { value: '1d', label: '1 Day', group: 'Days' },
];

export default function TimeframeSelector({
  value,
  onChange,
  className,
  variant = 'select',
}: TimeframeSelectorProps) {
  if (variant === 'buttons') {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <span>Timeframe:</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              variant={value === tf.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(tf.value)}
              className={cn(
                'text-xs',
                value === tf.value
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-800 hover:bg-gray-700'
              )}
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Clock className="h-4 w-4" />
        <span>Timeframe:</span>
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as Timeframe)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400">Ticks</div>
          {timeframes.filter(tf => tf.group === 'Ticks').map((tf) => (
            <SelectItem key={tf.value} value={tf.value}>
              {tf.label}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 mt-2">Minutes</div>
          {timeframes.filter(tf => tf.group === 'Minutes').map((tf) => (
            <SelectItem key={tf.value} value={tf.value}>
              {tf.label}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 mt-2">Hours</div>
          {timeframes.filter(tf => tf.group === 'Hours').map((tf) => (
            <SelectItem key={tf.value} value={tf.value}>
              {tf.label}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 mt-2">Days</div>
          {timeframes.filter(tf => tf.group === 'Days').map((tf) => (
            <SelectItem key={tf.value} value={tf.value}>
              {tf.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

