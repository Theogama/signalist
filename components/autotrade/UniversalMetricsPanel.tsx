'use client';

/**
 * Universal Metrics Panel
 * Displays broker-agnostic trading metrics: balance, equity, win/loss, drawdown, etc.
 * Works for both Deriv (live API) and Exness (manual data)
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3,
  Target,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface UniversalMetrics {
  balance: number;
  equity: number;
  totalProfitLoss: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  riskExposure: number;
}

export default function UniversalMetricsPanel() {
  const {
    connectedBroker,
    balance,
    equity,
    openTrades,
    closedTrades,
  } = useAutoTradingStore();

  const [metrics, setMetrics] = useState<UniversalMetrics>({
    balance: 0,
    equity: 0,
    totalProfitLoss: 0,
    winRate: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    averageWin: 0,
    averageLoss: 0,
    profitFactor: 0,
    riskExposure: 0,
  });

  const [derivExecutionData, setDerivExecutionData] = useState<{
    totalTrades: number;
    totalProfitLoss: number;
    dailyTradeCount: number;
    dailyProfitLoss: number;
    activeContracts: number;
    sessionStartedAt?: Date;
  } | null>(null);

  // Fetch Deriv execution data
  useEffect(() => {
    if (connectedBroker === 'deriv') {
      const fetchDerivExecutionData = async () => {
        try {
          const response = await fetch('/api/deriv/auto-trading/status');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.session) {
              const session = data.data.session;
              const serviceStatus = data.data.serviceStatus || {};
              setDerivExecutionData({
                totalTrades: session.totalTrades || 0,
                totalProfitLoss: session.totalProfitLoss || 0,
                dailyTradeCount: serviceStatus.dailyTradeCount || 0,
                dailyProfitLoss: serviceStatus.dailyProfitLoss || 0,
                activeContracts: serviceStatus.activeContracts || 0,
                sessionStartedAt: session.startedAt ? new Date(session.startedAt) : undefined,
              });
            } else {
              setDerivExecutionData(null);
            }
          }
        } catch (error) {
          console.error('Error fetching Deriv execution data:', error);
        }
      };

      fetchDerivExecutionData();
      // Refresh every 10 seconds
      const interval = setInterval(fetchDerivExecutionData, 10000);
      return () => clearInterval(interval);
    } else {
      setDerivExecutionData(null);
    }
  }, [connectedBroker]);

  useEffect(() => {
    // Calculate metrics from trades
    const closed = closedTrades || [];
    const open = openTrades || [];

    // Calculate P/L
    const closedPL = closed.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const openPL = open.reduce((sum, t) => {
      const currentPrice = t.exitPrice || t.entryPrice;
      const pl = t.side === 'BUY'
        ? (currentPrice - t.entryPrice) * t.quantity
        : (t.entryPrice - currentPrice) * t.quantity;
      return sum + pl;
    }, 0);
    const totalPL = closedPL + openPL;

    // Win/Loss stats
    const winning = closed.filter(t => (t.profitLoss || 0) > 0);
    const losing = closed.filter(t => (t.profitLoss || 0) <= 0);
    const winRate = closed.length > 0 ? (winning.length / closed.length) * 100 : 0;

    // Average win/loss
    const avgWin = winning.length > 0
      ? winning.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / winning.length
      : 0;
    const avgLoss = losing.length > 0
      ? losing.reduce((sum, t) => sum + Math.abs(t.profitLoss || 0), 0) / losing.length
      : 0;

    // Profit factor
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);

    // Drawdown calculation (simplified)
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peakBalance = balance;
    let runningBalance = balance;

    // Calculate drawdown from closed trades
    for (const trade of closed) {
      runningBalance += trade.profitLoss || 0;
      if (runningBalance > peakBalance) {
        peakBalance = runningBalance;
      }
      const drawdown = peakBalance - runningBalance;
      const drawdownPercent = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdownPercent = drawdownPercent;
      }
    }

    // Risk exposure (sum of open position values)
    const riskExposure = open.reduce((sum, t) => {
      return sum + (t.entryPrice * t.quantity);
    }, 0);

    // If Deriv execution data is available, use it to enhance metrics
    let finalTotalTrades = closed.length;
    let finalTotalPL = totalPL;
    let finalWinningTrades = winning.length;
    let finalLosingTrades = losing.length;
    let finalWinRate = winRate;

    if (derivExecutionData && connectedBroker === 'deriv') {
      // Prefer Deriv execution data for total trades and P/L
      finalTotalTrades = derivExecutionData.totalTrades || finalTotalTrades;
      finalTotalPL = derivExecutionData.totalProfitLoss || finalTotalPL;
      
      // Calculate win/loss from Deriv data if available
      // Note: We can't calculate exact win/loss from session data alone,
      // so we'll keep the calculated values but use Deriv totals as primary
      if (derivExecutionData.totalTrades > closed.length) {
        // Deriv has more trades than our closed trades list
        // This means some trades might be in progress or not yet synced
        finalTotalTrades = derivExecutionData.totalTrades;
      }
    }

    setMetrics({
      balance,
      equity,
      totalProfitLoss: finalTotalPL,
      winRate: finalWinRate,
      totalTrades: finalTotalTrades,
      winningTrades: finalWinningTrades,
      losingTrades: finalLosingTrades,
      maxDrawdown,
      maxDrawdownPercent,
      averageWin: avgWin,
      averageLoss: avgLoss,
      profitFactor,
      riskExposure,
    });
  }, [balance, equity, openTrades, closedTrades, derivExecutionData, connectedBroker]);

  const isDeriv = connectedBroker === 'deriv';
  const isExness = connectedBroker === 'exness';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Universal Metrics
          {isDeriv && (
            <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
              Live API Data
            </Badge>
          )}
          {isExness && (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400">
              Manual Data
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Broker-agnostic trading performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance & Equity */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-400">Balance</span>
            </div>
            <div className="text-2xl font-bold text-gray-100">
              ${metrics.balance.toFixed(2)}
            </div>
            {isDeriv && (
              <div className="text-xs text-purple-400 mt-1">Live from API</div>
            )}
            {isExness && (
              <div className="text-xs text-yellow-400 mt-1">From uploaded data</div>
            )}
          </div>

          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Equity</span>
            </div>
            <div className="text-2xl font-bold text-gray-100">
              ${metrics.equity.toFixed(2)}
            </div>
            <div className={`text-xs mt-1 ${
              metrics.equity >= metrics.balance ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.equity >= metrics.balance ? '+' : ''}
              ${(metrics.equity - metrics.balance).toFixed(2)}
            </div>
          </div>
        </div>

        {/* P/L & Win Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Total P/L</span>
            </div>
            <div className={`text-2xl font-bold ${
              metrics.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.totalProfitLoss >= 0 ? '+' : ''}${metrics.totalProfitLoss.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-100">
              {metrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.winningTrades}W / {metrics.losingTrades}L
            </div>
          </div>
        </div>

        {/* Trade Statistics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-3 bg-gray-800 rounded">
            <div className="text-gray-500">Total Trades</div>
            <div className="text-lg font-bold text-gray-100">{metrics.totalTrades}</div>
            {isDeriv && derivExecutionData && (
              <div className="text-purple-400 text-xs mt-1">
                {derivExecutionData.activeContracts > 0 && (
                  <span>{derivExecutionData.activeContracts} active</span>
                )}
              </div>
            )}
          </div>
          <div className="p-3 bg-gray-800 rounded">
            <div className="text-gray-500">Avg Win</div>
            <div className="text-lg font-bold text-green-400">
              ${metrics.averageWin.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-gray-800 rounded">
            <div className="text-gray-500">Avg Loss</div>
            <div className="text-lg font-bold text-red-400">
              ${metrics.averageLoss.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Deriv Execution Results Section */}
        {isDeriv && derivExecutionData && (
          <div className="pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-gray-300">Deriv Execution Results</span>
              <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                Live
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                <div className="text-gray-400">Daily Trades</div>
                <div className="text-lg font-bold text-purple-400">
                  {derivExecutionData.dailyTradeCount}
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                <div className="text-gray-400">Daily P/L</div>
                <div className={`text-lg font-bold ${
                  derivExecutionData.dailyProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {derivExecutionData.dailyProfitLoss >= 0 ? '+' : ''}
                  ${derivExecutionData.dailyProfitLoss.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                <div className="text-gray-400">Session Trades</div>
                <div className="text-lg font-bold text-purple-400">
                  {derivExecutionData.totalTrades}
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                <div className="text-gray-400">Session P/L</div>
                <div className={`text-lg font-bold ${
                  derivExecutionData.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {derivExecutionData.totalProfitLoss >= 0 ? '+' : ''}
                  ${derivExecutionData.totalProfitLoss.toFixed(2)}
                </div>
              </div>
              {derivExecutionData.activeContracts > 0 && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded col-span-2">
                  <div className="text-gray-400">Active Contracts</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {derivExecutionData.activeContracts}
                  </div>
                </div>
              )}
            </div>
            {derivExecutionData.sessionStartedAt && (
              <div className="text-xs text-gray-500 mt-2">
                Session started: {derivExecutionData.sessionStartedAt.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Risk Metrics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-gray-300">Risk Metrics</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-gray-800 rounded">
              <div className="text-gray-500">Max Drawdown</div>
              <div className="text-lg font-bold text-red-400">
                ${metrics.maxDrawdown.toFixed(2)}
              </div>
              <div className="text-gray-500">
                ({metrics.maxDrawdownPercent.toFixed(2)}%)
              </div>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <div className="text-gray-500">Profit Factor</div>
              <div className="text-lg font-bold text-yellow-400">
                {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-800 rounded col-span-2">
              <div className="text-gray-500">Risk Exposure</div>
              <div className="text-lg font-bold text-gray-100">
                ${metrics.riskExposure.toFixed(2)}
              </div>
              <div className="text-gray-500">
                {metrics.balance > 0 
                  ? `${((metrics.riskExposure / metrics.balance) * 100).toFixed(1)}% of balance`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Data Source Indicator */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Data Source:</span>
            {isDeriv && (
              <Badge variant="outline" className="border-purple-500 text-purple-400">
                <Activity className="h-3 w-3 mr-1" />
                Deriv API - Real-time
              </Badge>
            )}
            {isExness && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Exness - Manual Upload
              </Badge>
            )}
            {!connectedBroker && (
              <span className="text-gray-400">Not connected</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


