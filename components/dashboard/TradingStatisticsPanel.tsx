'use client';

/**
 * Trading Statistics Panel
 * Displays comprehensive persistent trading statistics from database
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStatistics } from '@/lib/hooks/useStatistics';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  Award,
  BarChart3,
  Calendar,
  DollarSign,
  Percent,
  Activity
} from 'lucide-react';

interface TradingStatistics {
  totalTrades: number;
  openTrades: number;
  totalProfitLoss: number;
  totalROI: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalBalance: number;
  totalEquity: number;
  totalInitialBalance: number;
  recentTrades: number;
  recentProfitLoss: number;
  bestTrade: {
    symbol: string;
    side: string;
    profitLoss: number;
    date: Date;
  } | null;
  worstTrade: {
    symbol: string;
    side: string;
    profitLoss: number;
    date: Date;
  } | null;
  dailyStats: Array<{
    date: string;
    trades: number;
    profitLoss: number;
  }>;
}

export default function TradingStatisticsPanel() {
  const [mounted, setMounted] = useState(false);
  
  // Fetch statistics for all brokers, including Deriv
  // Only enable after component is mounted to prevent SSR issues
  const { stats, loading, error } = useStatistics({ 
    broker: null, // null = all brokers including Deriv
    refreshInterval: 30000,
    enabled: mounted
  });
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trading Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">Loading statistics...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trading Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            {error || 'No statistics available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Overall Performance
          </CardTitle>
          <CardDescription>Persistent trading statistics across all sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-400">Total P/L</span>
              </div>
              <div className={`text-2xl font-bold ${
                stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stats.totalProfitLoss >= 0 ? '+' : ''}${stats.totalProfitLoss.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ROI: {stats.totalROI >= 0 ? '+' : ''}{stats.totalROI.toFixed(2)}%
              </div>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-400">Total Trades</span>
              </div>
              <div className="text-2xl font-bold text-gray-100">{stats.totalTrades}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.openTrades} open
              </div>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-green-400" />
                <span className="text-sm text-gray-400">Win Rate</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.winningTrades}W / {stats.losingTrades}L
              </div>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Profit Factor</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.avgProfit > 0 && `Avg: $${stats.avgProfit.toFixed(2)}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Account Summary
          </CardTitle>
          <CardDescription>Current account status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Total Balance</div>
              <div className="text-xl font-bold text-gray-100">
                ${stats.totalBalance.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Equity: ${stats.totalEquity.toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Initial Balance</div>
              <div className="text-xl font-bold text-gray-100">
                ${stats.totalInitialBalance.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalBalance >= stats.totalInitialBalance ? (
                  <span className="text-green-400">
                    +${(stats.totalBalance - stats.totalInitialBalance).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-red-400">
                    ${(stats.totalBalance - stats.totalInitialBalance).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Return on Investment</div>
              <div className={`text-xl font-bold ${
                stats.totalROI >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stats.totalROI >= 0 ? '+' : ''}{stats.totalROI.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Based on initial balance
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Average Profit</span>
                <span className="text-lg font-bold text-green-400">
                  ${stats.avgProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Average Loss</span>
                <span className="text-lg font-bold text-red-400">
                  ${stats.avgLoss.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Max Win Streak</span>
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                  {stats.maxWinStreak} trades
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Max Loss Streak</span>
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                  {stats.maxLossStreak} trades
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Performance (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Recent Trades</span>
                <span className="text-lg font-bold text-gray-100">
                  {stats.recentTrades}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-400">Recent P/L</span>
                <span className={`text-lg font-bold ${
                  stats.recentProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stats.recentProfitLoss >= 0 ? '+' : ''}${stats.recentProfitLoss.toFixed(2)}
                </span>
              </div>
              {stats.bestTrade && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="text-xs text-green-400 mb-1">Best Trade</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {stats.bestTrade.symbol} {stats.bestTrade.side}
                  </div>
                  <div className="text-sm text-green-400">
                    +${stats.bestTrade.profitLoss.toFixed(2)}
                  </div>
                </div>
              )}
              {stats.worstTrade && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="text-xs text-red-400 mb-1">Worst Trade</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {stats.worstTrade.symbol} {stats.worstTrade.side}
                  </div>
                  <div className="text-sm text-red-400">
                    ${stats.worstTrade.profitLoss.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


