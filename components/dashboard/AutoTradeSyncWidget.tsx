'use client';

/**
 * Auto-Trade Sync Widget
 * Displays real-time auto-trade data synced from the auto-trading store
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Play, 
  Square,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import PLTracker from '@/components/autotrade/PLTracker';

export default function AutoTradeSyncWidget() {
  const {
    connectedBroker,
    botStatus,
    balance,
    equity,
    margin,
    openTrades,
    closedTrades,
    botParams,
  } = useAutoTradingStore();

  const [isClient, setIsClient] = useState(false);
  const [persistentStats, setPersistentStats] = useState<{
    totalProfitLoss: number;
    totalTrades: number;
  } | null>(null);

  useEffect(() => {
    setIsClient(true);
    
    // Fetch persistent statistics
    const fetchPersistentStats = async () => {
      try {
        const response = await fetch('/api/auto-trading/statistics');
        const data = await response.json();
        if (data.success) {
          setPersistentStats({
            totalProfitLoss: data.data.totalProfitLoss || 0,
            totalTrades: data.data.totalTrades || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching persistent stats:', error);
      }
    };

    fetchPersistentStats();
    const interval = setInterval(fetchPersistentStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate metrics (live data)
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

  const freeMargin = equity - margin;
  const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;

  if (!isClient) {
    return null; // Prevent hydration mismatch
  }

  // If no broker connected, show connection prompt
  if (!connectedBroker) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            Auto-Trade Not Connected
          </CardTitle>
          <CardDescription className="text-gray-400">
            Connect to a broker to see real-time auto-trade data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/autotrade">
            <Button className="w-full">
              Go to Auto-Trade
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bot Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Auto-Trade Status
            </div>
            <Badge
              variant="outline"
              className={
                botStatus === 'running'
                  ? 'border-green-500 text-green-400 bg-green-500/10'
                  : botStatus === 'error'
                  ? 'border-red-500 text-red-400 bg-red-500/10'
                  : 'border-gray-500 text-gray-400'
              }
            >
              {botStatus === 'running' ? (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Running
                </>
              ) : botStatus === 'stopping' ? (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  Stopping
                </>
              ) : (
                'Idle'
              )}
            </Badge>
          </CardTitle>
          <CardDescription>
            Connected to {connectedBroker?.toUpperCase()} • {botStatus === 'running' ? 'Active Trading' : 'Monitoring'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/autotrade">
            <Button variant="outline" className="w-full">
              Open Auto-Trade Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Account Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Summary
          </CardTitle>
          <CardDescription>Real-time account metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Balance</div>
              <div className="text-xl font-bold text-gray-100">
                ${balance.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Equity</div>
              <div className="text-xl font-bold text-gray-100">
                ${equity.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Free Margin</div>
              <div className="text-xl font-bold text-gray-100">
                ${freeMargin.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Margin Level</div>
              <div className="text-xl font-bold text-gray-100">
                {marginLevel.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P/L Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Profit & Loss
          </CardTitle>
          <CardDescription>Live trading performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Running P/L</span>
              <span className={`text-lg font-bold ${
                runningPL > 0 ? 'text-green-400' :
                runningPL < 0 ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {runningPL >= 0 ? '+' : ''}${runningPL.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Total P/L</span>
                {persistentStats && (
                  <span className="text-xs text-green-400" title="Persistent data">●</span>
                )}
              </div>
              <span className={`text-lg font-bold ${
                totalProfitLoss > 0 ? 'text-green-400' :
                totalProfitLoss < 0 ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(2)}
              </span>
            </div>
            {persistentStats && (
              <div className="text-xs text-gray-500 mt-1">
                All-time performance (persisted)
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-400">Open Positions</span>
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                {openTrades.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Total Trades</span>
                {persistentStats && (
                  <span className="text-xs text-green-400" title="Persistent data">●</span>
                )}
              </div>
              <Badge variant="outline" className="border-gray-500 text-gray-400">
                {totalTrades}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Settings */}
      {botParams && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Risk Settings
            </CardTitle>
            <CardDescription>Current auto-trade configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Risk Per Trade</span>
                <span className="text-gray-100 font-semibold">{botParams.riskPercent || 1}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Take Profit</span>
                <span className="text-gray-100 font-semibold">{botParams.takeProfitPercent || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Stop Loss</span>
                <span className="text-gray-100 font-semibold">{botParams.stopLossPercent || 0}%</span>
              </div>
              {botParams.maxTrades && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Trades</span>
                  <span className="text-gray-100 font-semibold">{botParams.maxTrades}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

