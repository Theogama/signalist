'use client';

/**
 * Live Trade Updates Component
 * Real-time timeline showing when trades open, close, hit TP/SL, win, or lose
 */

import { useEffect, useState, useRef } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  XCircle, 
  Target, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';

export interface TradeUpdate {
  id: string;
  type: 'OPEN' | 'CLOSE' | 'TP_HIT' | 'SL_HIT' | 'WIN' | 'LOSE';
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  profitLoss?: number;
  timestamp: Date;
  reason?: string;
}

export default function LiveTradeUpdates() {
  const { openTrades, closedTrades, liveLogs } = useAutoTradingStore();
  const [updates, setUpdates] = useState<TradeUpdate[]>([]);
  const updatesEndRef = useRef<HTMLDivElement>(null);
  const prevTradesRef = useRef<{ open: typeof openTrades; closed: typeof closedTrades }>({
    open: [],
    closed: [],
  });

  // Auto-scroll to bottom when new updates arrive
  useEffect(() => {
    updatesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [updates]);

  // PRIORITY: Immediate trade change detection (optimized for Exness/Deriv)
  useEffect(() => {
    const newUpdates: TradeUpdate[] = [];

    // PRIORITY: Check for new open trades (immediate detection)
    openTrades.forEach(trade => {
      const wasOpen = prevTradesRef.current.open.find(t => t.id === trade.id);
      if (!wasOpen) {
        // IMMEDIATE: Add trade open update with high priority
        newUpdates.push({
          id: `update-${Date.now()}-${Math.random()}`,
          type: 'OPEN',
          tradeId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          price: trade.entryPrice,
          quantity: trade.quantity,
          timestamp: trade.openedAt,
          reason: `${trade.side} ${trade.symbol} opened at $${trade.entryPrice.toFixed(2)}`,
        });
      } else {
        // PRIORITY: Check for P/L updates on existing trades
        const prevTrade = prevTradesRef.current.open.find(t => t.id === trade.id);
        if (prevTrade && trade.profitLoss !== undefined && 
            Math.abs((trade.profitLoss || 0) - (prevTrade.profitLoss || 0)) > 0.01) {
          // Significant P/L change - add update
          const isProfit = (trade.profitLoss || 0) > 0;
          newUpdates.push({
            id: `update-pl-${Date.now()}-${Math.random()}`,
            type: isProfit ? 'WIN' : 'LOSE',
            tradeId: trade.id,
            symbol: trade.symbol,
            side: trade.side,
            price: trade.exitPrice || trade.entryPrice,
            quantity: trade.quantity,
            profitLoss: trade.profitLoss,
            timestamp: new Date(),
            reason: `P/L update: ${isProfit ? '+' : ''}$${(trade.profitLoss || 0).toFixed(2)}`,
          });
        }
      }
    });

    // Check for newly closed trades
    closedTrades.forEach(trade => {
      const wasOpen = prevTradesRef.current.open.find(t => t.id === trade.id);
      const wasClosed = prevTradesRef.current.closed.find(t => t.id === trade.id);
      
      if (wasOpen && !wasClosed) {
        // Trade was just closed
        const profitLoss = trade.profitLoss || 0;
        const isWin = profitLoss > 0;
        const isLoss = profitLoss < 0;
        
        // Determine update type based on trade result
        let updateType: TradeUpdate['type'] = 'CLOSE';
        if (isWin) {
          updateType = 'WIN';
        } else if (isLoss) {
          updateType = 'LOSE';
        }

        // Check logs for TP/SL indicators
        const relevantLog = liveLogs.find(log => 
          log.message.includes(trade.id) && 
          (log.message.toLowerCase().includes('take profit') || 
           log.message.toLowerCase().includes('stop loss') ||
           log.message.toLowerCase().includes('tp hit') ||
           log.message.toLowerCase().includes('sl hit'))
        );
        
        if (relevantLog) {
          const logMsg = relevantLog.message.toLowerCase();
          if (logMsg.includes('take profit') || logMsg.includes('tp hit')) {
            updateType = 'TP_HIT';
          } else if (logMsg.includes('stop loss') || logMsg.includes('sl hit')) {
            updateType = 'SL_HIT';
          }
        }

        newUpdates.push({
          id: `update-${Date.now()}-${Math.random()}`,
          type: updateType,
          tradeId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          price: trade.exitPrice || trade.entryPrice,
          quantity: trade.quantity,
          profitLoss: profitLoss,
          timestamp: trade.closedAt || new Date(),
          reason: isWin 
            ? `Trade closed with profit of $${profitLoss.toFixed(2)}`
            : isLoss
            ? `Trade closed with loss of $${Math.abs(profitLoss).toFixed(2)}`
            : 'Trade closed',
        });
      }
    });

    // PRIORITY: Add new updates immediately (no batching for trade events)
    if (newUpdates.length > 0) {
      // Sort by priority: CLOSE/WIN/LOSE/TP_HIT/SL_HIT first, then OPEN, then P/L updates
      const priorityOrder: Record<TradeUpdate['type'], number> = {
        'TP_HIT': 1,
        'SL_HIT': 2,
        'WIN': 3,
        'LOSE': 4,
        'CLOSE': 5,
        'OPEN': 6,
      };
      
      const sortedUpdates = newUpdates.sort((a, b) => 
        (priorityOrder[a.type] || 99) - (priorityOrder[b.type] || 99)
      );
      
      setUpdates(prev => [...sortedUpdates, ...prev].slice(0, 150)); // Keep last 150 updates
    }

    // Update refs immediately
    prevTradesRef.current = {
      open: openTrades.map(t => ({ ...t })), // Deep copy to detect changes
      closed: closedTrades.map(t => ({ ...t })),
    };
  }, [openTrades, closedTrades, liveLogs]);

  const getUpdateIcon = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'OPEN':
        return <ArrowUpRight className="h-5 w-5 text-blue-400" />;
      case 'CLOSE':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      case 'TP_HIT':
        return <Target className="h-5 w-5 text-green-400" />;
      case 'SL_HIT':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'WIN':
        return <TrendingUp className="h-5 w-5 text-green-400" />;
      case 'LOSE':
        return <TrendingDown className="h-5 w-5 text-red-400" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getUpdateColor = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'OPEN':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'TP_HIT':
      case 'WIN':
        return 'bg-green-500/10 border-green-500/20';
      case 'SL_HIT':
      case 'LOSE':
        return 'bg-red-500/10 border-red-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const getUpdateBadge = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'OPEN':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">OPENED</Badge>;
      case 'CLOSE':
        return <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">CLOSED</Badge>;
      case 'TP_HIT':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">TP HIT</Badge>;
      case 'SL_HIT':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">SL HIT</Badge>;
      case 'WIN':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">WIN</Badge>;
      case 'LOSE':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">LOSE</Badge>;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Live Trade Updates
          {updates.length > 0 && (
            <span className="ml-2 text-xs text-green-400 animate-pulse">
              ⚡ Prioritized
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Real-time timeline of trading activity
          <span className="ml-2 text-xs text-yellow-400">
            (Updates every 500ms)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {updates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No trade updates yet</p>
              <p className="text-xs mt-1">Trades will appear here in real-time</p>
            </div>
          ) : (
            updates.map((update) => (
              <div
                key={update.id}
                className={`p-4 rounded-lg border ${getUpdateColor(update.type)} transition-all`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {getUpdateIcon(update.type)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getUpdateBadge(update.type)}
                        <span className="font-semibold text-gray-100">{update.symbol}</span>
                        <span className={`text-sm font-medium ${
                          update.side === 'BUY' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {update.side}
                        </span>
                        <span className="text-sm text-gray-400">
                          Qty: {update.quantity}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {update.reason || `${update.type} at $${update.price.toFixed(2)}`}
                      </div>
                      {update.profitLoss !== undefined && (
                        <div className={`text-sm font-semibold ${
                          update.profitLoss > 0 ? 'text-green-400' : 
                          update.profitLoss < 0 ? 'text-red-400' : 
                          'text-gray-400'
                        }`}>
                          {update.profitLoss > 0 ? '+' : ''}${update.profitLoss.toFixed(2)} P/L
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTime(update.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={updatesEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}
