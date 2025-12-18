'use client';

/**
 * MT5 Real-Time P/L Tracker
 * Shows live profit/loss, equity, balance, drawdown, and trade statistics
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle } from 'lucide-react';

interface AccountStats {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

interface PerformanceStats {
  totalPL: number;
  realizedPL: number;
  unrealizedPL: number;
  winRate: string;
  wins: number;
  losses: number;
  maxDrawdown: string;
  currentDrawdown: string;
}

interface TradeStats {
  open: number;
  closed: number;
  total: number;
}

export default function MT5PLTracker() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  const [trades, setTrades] = useState<TradeStats | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Load connection ID from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('mt5_connection');
    if (stored) {
      try {
        const conn = JSON.parse(stored);
        setConnectionId(conn.connection_id);
      } catch (err) {
        console.error('Error loading connection:', err);
      }
    }
  }, []);

  // Fetch account stats
  const fetchStats = async () => {
    if (!connectionId) return;

    try {
      const response = await fetch(`/api/mt5/account/stats?connection_id=${connectionId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setAccount(data.data.account);
        setPerformance(data.data.performance);
        setTrades(data.data.trades);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (connectionId) {
      fetchStats();
    }
  }, [connectionId]);

  // Poll every 1 second for P/L updates
  useEffect(() => {
    if (!connectionId) return;

    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, [connectionId]);

  if (!connectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P/L Tracker</CardTitle>
          <CardDescription>Connect to MT5 to view live statistics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P/L Tracker</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-yellow-500" />
          Live P/L Tracker
        </CardTitle>
        <CardDescription>Real-time profit/loss and account statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Summary */}
        {account && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Balance</p>
              <p className="text-lg font-semibold text-gray-100">
                {account.currency} {account.balance.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Equity</p>
              <p className={`text-lg font-semibold ${account.equity >= account.balance ? 'text-green-400' : 'text-red-400'}`}>
                {account.currency} {account.equity.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Free Margin</p>
              <p className="text-lg font-semibold text-gray-100">
                {account.currency} {account.freeMargin.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Margin Level</p>
              <p className={`text-lg font-semibold ${parseFloat(account.marginLevel.toFixed(1)) > 200 ? 'text-green-400' : parseFloat(account.marginLevel.toFixed(1)) > 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                {account.marginLevel.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Performance Stats */}
        {performance && (
          <div className="space-y-3 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total P/L</span>
              <span className={`text-lg font-bold ${performance.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performance.totalPL >= 0 ? '+' : ''}{performance.totalPL.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Realized P/L</span>
              <span className={`text-sm font-semibold ${performance.realizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performance.realizedPL >= 0 ? '+' : ''}{performance.realizedPL.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Unrealized P/L</span>
              <span className={`text-sm font-semibold ${performance.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performance.unrealizedPL >= 0 ? '+' : ''}{performance.unrealizedPL.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Win Rate</span>
              <span className="text-sm font-semibold text-gray-100">
                {performance.winRate}% ({performance.wins}W / {performance.losses}L)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Max Drawdown</span>
              <span className={`text-sm font-semibold ${parseFloat(performance.maxDrawdown) > 20 ? 'text-red-400' : 'text-yellow-400'}`}>
                {performance.maxDrawdown}%
              </span>
            </div>
          </div>
        )}

        {/* Trade Stats */}
        {trades && (
          <div className="pt-4 border-t border-gray-700">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-gray-800 rounded">
                <p className="text-xs text-gray-400">Open</p>
                <p className="text-lg font-semibold text-blue-400">{trades.open}</p>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded">
                <p className="text-xs text-gray-400">Closed</p>
                <p className="text-lg font-semibold text-gray-100">{trades.closed}</p>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded">
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-lg font-semibold text-yellow-400">{trades.total}</p>
              </div>
            </div>
          </div>
        )}

        {/* Update Indicator */}
        <div className="pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Updated every 1 second
          </p>
        </div>
      </CardContent>
    </Card>
  );
}






