'use client';

/**
 * Live Stats Cards Component
 * Displays real-time auto-trade statistics synced from the store + persistent database data
 */

import { useEffect, useState } from 'react';
import { useStatistics } from '@/lib/hooks/useStatistics';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrendingUp, Activity, Signal, Database } from 'lucide-react';

export default function LiveStatsCards() {
  const {
    openTrades,
    closedTrades,
    balance,
    equity,
    connectedBroker,
  } = useAutoTradingStore();

  const [isClient, setIsClient] = useState(false);
  const { stats: persistentStats } = useStatistics({ refreshInterval: 30000 });

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Return placeholder during SSR
    return (
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-sm text-gray-400">Active Trades</div>
          <div className="text-2xl font-bold text-gray-100">-</div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-sm text-gray-400">Total P/L</div>
          <div className="text-2xl font-bold text-gray-100">-</div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-sm text-gray-400">Broker Status</div>
          <div className="text-2xl font-bold text-gray-100">-</div>
        </div>
      </div>
    );
  }

  // Calculate metrics from autotrade store (live data)
  const activeTrades = openTrades.length;
  const liveTotalProfitLoss = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const runningPL = openTrades.reduce((sum, trade) => {
    const currentPrice = trade.exitPrice || trade.entryPrice;
    const pl = trade.side === 'BUY'
      ? (currentPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - currentPrice) * trade.quantity;
    return sum + pl;
  }, 0);

  // Use persistent data if available, otherwise use live data
  const totalProfitLoss = persistentStats?.totalProfitLoss ?? liveTotalProfitLoss;
  const totalTrades = persistentStats?.totalTrades ?? closedTrades.length;
  
  // Combine running P/L with closed P/L for total
  const combinedPL = totalProfitLoss + runningPL;

  return (
    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gray-800 border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Trades</span>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              {persistentStats && (
                <Database className="h-3 w-3 text-green-400" title="Persistent data" />
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100">{totalTrades}</div>
          <div className="text-xs text-gray-500 mt-1">
            {activeTrades} open {connectedBroker && `• Live from ${connectedBroker.toUpperCase()}`}
          </div>
          <Link href="/autotrade">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              View auto-trade →
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total P/L</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              {persistentStats && (
                <Database className="h-3 w-3 text-green-400" title="Persistent data" />
              )}
            </div>
          </div>
          <div className={`text-2xl font-bold ${combinedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {combinedPL >= 0 ? '+' : ''}${combinedPL.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {persistentStats ? 'All-time' : 'Session'} P/L
            {runningPL !== 0 && ` • ${runningPL >= 0 ? '+' : ''}$${runningPL.toFixed(2)} unrealized`}
          </div>
          <Link href="/dashboard/analytics">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              View analytics →
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Account Balance</span>
            <Signal className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-gray-100">
            ${balance.toFixed(2)}
          </div>
          {equity !== balance && (
            <div className="text-xs text-gray-500 mt-1">
              Equity: ${equity.toFixed(2)}
            </div>
          )}
          <Link href="/autotrade">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              Manage account →
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

