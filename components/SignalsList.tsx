'use client';

import { useState } from 'react';
import ExecuteBotButton from '@/components/ExecuteBotButton';
import LivePrice from '@/components/LivePrice';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';

// Signal type is now defined in global.d.ts

type SignalsListProps = {
  signals: Signal[];
  isBotEnabled: boolean;
};

export default function SignalsList({ signals, isBotEnabled }: SignalsListProps) {
  const [localSignals] = useState<Signal[]>(signals);

  if (localSignals.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
        <TrendingUp className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Signals Available</h3>
        <p className="text-gray-400">
          Trading signals will appear here when available. Check back later or configure your signal sources.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localSignals.map((signal) => (
        <div
          key={signal.id}
          className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                    signal.action === 'BUY'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {signal.action === 'BUY' ? (
                    <ArrowUp className="h-6 w-6" />
                  ) : (
                    <ArrowDown className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">{signal.symbol}</h3>
                  <p className="text-sm text-gray-400">{signal.ticker}</p>
                </div>
                <div className="ml-auto text-right">
                  <LivePrice symbol={signal.symbol} showChange={true} showPercent={true} size="lg" />
                  <div
                    className={`text-sm font-medium flex items-center gap-1 mt-1 ${
                      signal.action === 'BUY' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {signal.action === 'BUY' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {signal.action}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                {signal.source && (
                  <span>
                    Source: <span className="text-gray-300 capitalize">{signal.source.replace('_', ' ')}</span>
                  </span>
                )}
                <span>
                  {new Date(signal.timestamp).toLocaleString()}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  signal.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  signal.status === 'executed' ? 'bg-blue-500/20 text-blue-400' :
                  signal.status === 'expired' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {signal.status.toUpperCase()}
                </span>
              </div>

              {(signal.stopLoss || signal.takeProfit || signal.description) && (
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
                  {signal.stopLoss && (
                    <span>Stop Loss: <span className="text-red-400">${signal.stopLoss.toFixed(2)}</span></span>
                  )}
                  {signal.takeProfit && (
                    <span>Take Profit: <span className="text-green-400">${signal.takeProfit.toFixed(2)}</span></span>
                  )}
                  {signal.description && (
                    <span className="text-gray-400 italic">{signal.description}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-shrink-0">
              {signal.status === 'active' ? (
                <ExecuteBotButton 
                  signalId={signal.signalId || signal.id} 
                  isBotEnabled={isBotEnabled} 
                />
              ) : (
                <div className="text-sm text-gray-500 text-center">
                  {signal.status === 'executed' && 'Already Executed'}
                  {signal.status === 'expired' && 'Expired'}
                  {signal.status === 'cancelled' && 'Cancelled'}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

