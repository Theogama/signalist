'use client';

/**
 * Real-Time P/L Tracker Component
 * Displays current running P/L, total wins, total losses, and win rate
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, Activity, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface PLMetrics {
  currentRunningPL: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalTrades: number;
  totalProfitLoss: number;
  openPositions: number;
  isLoading: boolean;
}

export default function PLTracker() {
  const { openTrades, closedTrades, connectedBroker } = useAutoTradingStore();
  const { wsConnected } = useWebSocket();
  const [metrics, setMetrics] = useState<PLMetrics>({
    currentRunningPL: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    totalTrades: 0,
    totalProfitLoss: 0,
    openPositions: 0,
    isLoading: true,
  });

  const fetchPLMetrics = async () => {
    if (!connectedBroker) {
      setMetrics(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const response = await fetch(`/api/auto-trading/pl?broker=${connectedBroker}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMetrics({
            currentRunningPL: data.data.currentRunningPL || 0,
            totalWins: data.data.totalWins || 0,
            totalLosses: data.data.totalLosses || 0,
            winRate: data.data.winRate || 0,
            totalTrades: data.data.totalTrades || 0,
            totalProfitLoss: data.data.totalProfitLoss || 0,
            openPositions: data.data.openPositions || 0,
            isLoading: false,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching P/L metrics:', error);
      setMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Calculate metrics from store as fallback/real-time update
  useEffect(() => {
    // Calculate running P/L from open trades (unrealized)
    const runningPL = openTrades.reduce((sum, trade) => {
      // For open trades, calculate unrealized P/L
      // Use currentPrice if available, otherwise entryPrice
      const currentPrice = trade.exitPrice || trade.entryPrice;
      const pl = trade.side === 'BUY'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;
      return sum + pl;
    }, 0);

    // Calculate wins/losses from closed trades
    const closed = closedTrades.filter(t => t.profitLoss !== undefined);
    const wins = closed.filter(t => (t.profitLoss || 0) > 0).length;
    const losses = closed.filter(t => (t.profitLoss || 0) <= 0).length;
    const totalProfitLoss = closed.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalTrades = closed.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Update metrics from store data (real-time fallback while API loads)
    // Only update if we have data, otherwise keep API data
    if (openTrades.length > 0 || closedTrades.length > 0) {
      setMetrics(prev => ({
        ...prev,
        currentRunningPL: runningPL,
        totalWins: wins,
        totalLosses: losses,
        winRate: winRate,
        totalTrades: totalTrades,
        totalProfitLoss: totalProfitLoss,
        openPositions: openTrades.length,
      }));
    }
  }, [openTrades, closedTrades]);

  // Fetch from API on mount and periodically (optimized for performance)
  useEffect(() => {
    if (!connectedBroker) {
      setMetrics(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    fetchPLMetrics();
    // Reduced polling frequency - rely on WebSocket and store updates for real-time data
    // Calculate P/L from store data in real-time, only fetch from API periodically
    const interval = setInterval(fetchPLMetrics, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker]);
  
  // PRIORITY: Immediate refresh when trades change (real-time updates from WebSocket)
  useEffect(() => {
    if (wsConnected && connectedBroker && (openTrades.length > 0 || closedTrades.length > 0)) {
      // When WebSocket receives trade updates, refresh P/L metrics IMMEDIATELY
      // No delay - prioritize trade updates for Exness/Deriv
      fetchPLMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades.length, closedTrades.length, wsConnected, connectedBroker]);
  
  // PRIORITY: Real-time P/L calculation from open trades (updates every render when trades change)
  useEffect(() => {
    if (!wsConnected || !connectedBroker) return;
    
    // Calculate running P/L immediately when trades update
    const runningPL = openTrades.reduce((sum, trade) => {
      const currentPrice = trade.exitPrice || trade.entryPrice;
      const pl = trade.side === 'BUY'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;
      return sum + pl;
    }, 0);

    // Update metrics immediately (no API call needed for open trades P/L)
    setMetrics(prev => ({
      ...prev,
      currentRunningPL: runningPL,
      openPositions: openTrades.length,
    }));
  }, [openTrades, wsConnected, connectedBroker]);

  if (metrics.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Profit & Loss Tracker
          </CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Profit & Loss Tracker
          </div>
          <button
            onClick={() => {
              setMetrics(prev => ({ ...prev, isLoading: true }));
              fetchPLMetrics();
            }}
            className="p-1 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
            title="Refresh metrics"
            disabled={metrics.isLoading}
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${metrics.isLoading ? 'animate-spin' : ''}`} />
          </button>
        </CardTitle>
        <CardDescription>
          Real-time trading performance metrics
          {wsConnected && connectedBroker && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-400 text-xs">
              <Activity className="h-3 w-3 animate-pulse" />
              Live ({connectedBroker.toUpperCase()})
              <span className="text-yellow-400 ml-1">⚡ Fast Updates</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Current Running P/L */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Current Running P/L</div>
            <div className={`text-2xl font-bold ${
              metrics.currentRunningPL > 0 ? 'text-green-400' :
              metrics.currentRunningPL < 0 ? 'text-red-400' :
              'text-gray-400'
            }`}>
              ${metrics.currentRunningPL.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              {metrics.openPositions === 0 ? (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  No open positions
                </span>
              ) : metrics.currentRunningPL > 0 ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  In profit ({metrics.openPositions} open)
                </span>
              ) : metrics.currentRunningPL < 0 ? (
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  In loss ({metrics.openPositions} open)
                </span>
              ) : (
                <span>{metrics.openPositions} open position(s)</span>
              )}
            </div>
          </div>

          {/* Total Wins */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Total Wins</div>
            <div className="text-2xl font-bold text-green-400">
              {metrics.totalWins}
            </div>
            <div className="text-xs text-gray-500">
              Winning trades
            </div>
          </div>

          {/* Total Losses */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Total Losses</div>
            <div className="text-2xl font-bold text-red-400">
              {metrics.totalLosses}
            </div>
            <div className="text-xs text-gray-500">
              Losing trades
            </div>
          </div>

          {/* Win Rate */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Win Rate</div>
            <div className={`text-2xl font-bold ${
              metrics.winRate >= 50 ? 'text-green-400' :
              metrics.winRate >= 30 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {metrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              Success rate
            </div>
          </div>

          {/* Total Trades */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Total Trades</div>
            <div className="text-2xl font-bold text-gray-100">
              {metrics.totalTrades}
            </div>
            <div className="text-xs text-gray-500">
              Closed positions
            </div>
          </div>

          {/* Total P/L */}
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Total Profit/Loss</div>
            <div className={`text-2xl font-bold ${
              metrics.totalProfitLoss > 0 ? 'text-green-400' :
              metrics.totalProfitLoss < 0 ? 'text-red-400' :
              'text-gray-400'
            }`}>
              ${metrics.totalProfitLoss.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              All-time P/L
            </div>
          </div>
        </div>

        {/* Win Rate Visual Bar */}
        {metrics.totalTrades > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Win Rate Progress</span>
              <span className="text-gray-400">{metrics.winRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  metrics.winRate >= 50 ? 'bg-green-500' :
                  metrics.winRate >= 30 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, metrics.winRate)}%` }}
              />
            </div>
          </div>
        )}

        {/* No trades message */}
        {metrics.totalTrades === 0 && metrics.openPositions === 0 && (
          <div className="mt-6 text-center py-8 text-gray-400">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No trading activity yet</p>
            <p className="text-xs mt-1">Start trading to see your performance metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
