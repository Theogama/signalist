'use client';

import { TrendingUp, TrendingDown, Target, BarChart3, DollarSign, Percent } from 'lucide-react';

type AnalyticsData = {
  overview: {
    totalTrades: number;
    closedTrades: number;
    activeTrades: number;
    winningTrades: number;
    losingTrades: number;
  };
  performance: {
    totalProfitLoss: number;
    totalProfitLossPct: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  };
  timePeriods: {
    last24h: { trades: number; profitLoss: number };
    last7d: { trades: number; profitLoss: number };
    last30d: { trades: number; profitLoss: number };
  };
  topSymbols: Array<{ symbol: string; count: number; profitLoss: number }>;
};

export default function AnalyticsDashboard({ analytics }: { analytics: AnalyticsData | null }) {
  if (!analytics) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
        <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Analytics Available</h3>
        <p className="text-gray-400">Start trading to see your performance metrics</p>
      </div>
    );
  }

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend 
  }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: any;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <Icon className={`h-5 w-5 ${
          trend === 'up' ? 'text-green-400' : 
          trend === 'down' ? 'text-red-400' : 
          'text-gray-400'
        }`} />
      </div>
      <div className="text-2xl font-bold text-gray-100 mb-1">{value}</div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Trades"
          value={analytics.overview.totalTrades}
          subtitle={`${analytics.overview.closedTrades} closed, ${analytics.overview.activeTrades} active`}
          icon={BarChart3}
        />
        <StatCard
          title="Win Rate"
          value={`${analytics.performance.winRate.toFixed(1)}%`}
          subtitle={`${analytics.overview.winningTrades} wins, ${analytics.overview.losingTrades} losses`}
          icon={Target}
          trend={analytics.performance.winRate >= 50 ? 'up' : 'down'}
        />
        <StatCard
          title="Total P/L"
          value={`${analytics.performance.totalProfitLoss >= 0 ? '+' : ''}$${analytics.performance.totalProfitLoss.toFixed(2)}`}
          subtitle={`${analytics.performance.totalProfitLossPct >= 0 ? '+' : ''}${analytics.performance.totalProfitLossPct.toFixed(2)}%`}
          icon={DollarSign}
          trend={analytics.performance.totalProfitLoss >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Profit Factor"
          value={analytics.performance.profitFactor === Infinity ? '∞' : analytics.performance.profitFactor.toFixed(2)}
          subtitle={`Avg win: $${analytics.performance.avgWin.toFixed(2)}`}
          icon={TrendingUp}
          trend={analytics.performance.profitFactor >= 1 ? 'up' : 'down'}
        />
      </div>

      {/* Time Period Performance */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Performance by Period</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Last 24 Hours</div>
            <div className="text-2xl font-bold text-gray-100 mb-1">
              {analytics.timePeriods.last24h.profitLoss >= 0 ? '+' : ''}
              ${analytics.timePeriods.last24h.profitLoss.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">{analytics.timePeriods.last24h.trades} trades</div>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Last 7 Days</div>
            <div className="text-2xl font-bold text-gray-100 mb-1">
              {analytics.timePeriods.last7d.profitLoss >= 0 ? '+' : ''}
              ${analytics.timePeriods.last7d.profitLoss.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">{analytics.timePeriods.last7d.trades} trades</div>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Last 30 Days</div>
            <div className="text-2xl font-bold text-gray-100 mb-1">
              {analytics.timePeriods.last30d.profitLoss >= 0 ? '+' : ''}
              ${analytics.timePeriods.last30d.profitLoss.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">{analytics.timePeriods.last30d.trades} trades</div>
          </div>
        </div>
      </div>

      {/* Top Performing Symbols */}
      {analytics.topSymbols.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Performing Symbols</h2>
          <div className="space-y-3">
            {analytics.topSymbols.map((symbol) => (
              <div key={symbol.symbol} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-semibold">
                    {symbol.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-100">{symbol.symbol}</div>
                    <div className="text-xs text-gray-400">{symbol.count} trades</div>
                  </div>
                </div>
                <div className={`text-lg font-bold ${
                  symbol.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {symbol.profitLoss >= 0 ? '+' : ''}${symbol.profitLoss.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Average Performance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Average Win</span>
              <span className="text-sm font-semibold text-green-400">
                ${analytics.performance.avgWin.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Average Loss</span>
              <span className="text-sm font-semibold text-red-400">
                ${analytics.performance.avgLoss.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-400">Risk/Reward Ratio</span>
              <span className="text-sm font-semibold text-gray-100">
                {analytics.performance.avgLoss > 0 
                  ? (analytics.performance.avgWin / analytics.performance.avgLoss).toFixed(2)
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Trade Statistics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total Trades</span>
              <span className="text-sm font-semibold text-gray-100">
                {analytics.overview.totalTrades}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Winning Trades</span>
              <span className="text-sm font-semibold text-green-400">
                {analytics.overview.winningTrades}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Losing Trades</span>
              <span className="text-sm font-semibold text-red-400">
                {analytics.overview.losingTrades}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-400">Active Positions</span>
              <span className="text-sm font-semibold text-yellow-400">
                {analytics.overview.activeTrades}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


