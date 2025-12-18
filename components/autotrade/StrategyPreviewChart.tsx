'use client';

/**
 * Strategy Preview Chart Component
 * Displays a visual preview of the trading strategy with entry/exit points
 */

import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StrategyPreviewChart() {
  const { selectedBot, selectedInstrument, botParams } = useAutoTradingStore();

  if (!selectedBot || !selectedInstrument || !botParams) {
    return (
      <div className="text-center py-12 text-gray-400">
        Select a bot and instrument to preview strategy
      </div>
    );
  }

  // Mock chart data - in real implementation, this would come from backtesting
  const mockData = Array.from({ length: 20 }, (_, i) => ({
    time: i,
    price: 2000 + Math.sin(i * 0.5) * 50 + Math.random() * 20,
    entry: i === 5 || i === 12,
    exit: i === 8 || i === 15,
    side: i === 5 ? 'BUY' : i === 12 ? 'SELL' : null,
  }));

  const minPrice = Math.min(...mockData.map(d => d.price));
  const maxPrice = Math.max(...mockData.map(d => d.price));
  const range = maxPrice - minPrice;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="relative h-64 bg-gray-900 rounded-lg border border-gray-700 p-4">
        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y * 200}
              x2="400"
              y2={y * 200}
              stroke="#374151"
              strokeWidth="0.5"
            />
          ))}

          {/* Price line */}
          <polyline
            points={mockData.map((d, i) => `${(i / (mockData.length - 1)) * 400},${200 - ((d.price - minPrice) / range) * 200}`).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Entry/Exit markers */}
          {mockData.map((d, i) => {
            if (!d.entry && !d.exit) return null;
            const x = (i / (mockData.length - 1)) * 400;
            const y = 200 - ((d.price - minPrice) / range) * 200;
            
            return (
              <g key={i}>
                {d.entry && (
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill={d.side === 'BUY' ? '#10b981' : '#ef4444'}
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
                {d.exit && (
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    fill={d.side === 'BUY' ? '#10b981' : '#ef4444'}
                    stroke="white"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute top-2 right-2 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400">Entry</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500"></div>
            <span className="text-gray-400">Exit</span>
          </div>
        </div>
      </div>

      {/* Strategy Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Take Profit</div>
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="font-semibold">+{botParams.takeProfitPercent}%</span>
          </div>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Stop Loss</div>
          <div className="flex items-center gap-1 text-red-400">
            <TrendingDown className="h-4 w-4" />
            <span className="font-semibold">-{botParams.stopLossPercent}%</span>
          </div>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Risk</div>
          <div className="font-semibold text-gray-100">{botParams.riskPercent}%</div>
        </div>
      </div>
    </div>
  );
}









