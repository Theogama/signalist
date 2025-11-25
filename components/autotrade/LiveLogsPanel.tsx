'use client';

/**
 * Live Logs Panel Component
 * Displays real-time bot activity logs
 */

import { useEffect, useRef } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function LiveLogsPanel() {
  const { liveLogs, clearLogs, wsConnected, closedTrades } = useAutoTradingStore();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastClosedTradeCountRef = useRef(0);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // Show alerts for wins/losses
  useEffect(() => {
    const currentClosedCount = closedTrades.length;
    if (currentClosedCount > lastClosedTradeCountRef.current) {
      // New closed trade
      const newTrades = closedTrades.slice(lastClosedTradeCountRef.current);
      newTrades.forEach((trade) => {
        if (trade.profitLoss !== undefined) {
          if (trade.profitLoss > 0) {
            toast.success(`💰 Trade Won! +$${trade.profitLoss.toFixed(2)}`, {
              description: `${trade.symbol} ${trade.side} - Profit: $${trade.profitLoss.toFixed(2)}`,
              duration: 5000,
            });
          } else if (trade.profitLoss < 0) {
            toast.error(`❌ Trade Lost! $${trade.profitLoss.toFixed(2)}`, {
              description: `${trade.symbol} ${trade.side} - Loss: $${Math.abs(trade.profitLoss).toFixed(2)}`,
              duration: 5000,
            });
          }
        }
      });
      lastClosedTradeCountRef.current = currentClosedCount;
    }
  }, [closedTrades]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-red-500/20 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/10';
      case 'success':
        return 'border-green-500/20 bg-green-500/10';
      default:
        return 'border-gray-700 bg-gray-800';
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Live Logs</span>
          <div className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-gray-500'}`} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearLogs}
          disabled={liveLogs.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Logs Container */}
      <div className="h-64 overflow-y-auto bg-gray-900 rounded-lg border border-gray-700 p-3 space-y-2">
        {liveLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No logs yet. Start the bot to see activity.
          </div>
        ) : (
          liveLogs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded border text-xs ${getLogColor(log.level)}`}
            >
              <div className="flex items-start gap-2">
                {getLogIcon(log.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`font-semibold ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-gray-300 break-words">{log.message}</div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}



