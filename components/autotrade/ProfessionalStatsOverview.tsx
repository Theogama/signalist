'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  DollarSign,
  Percent,
  BarChart3,
  Clock
} from 'lucide-react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { useEffect, useState } from 'react';

interface StatsData {
  totalPL: number;
  winRate: number;
  totalTrades: number;
  activeTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  dailyPL: number;
  weeklyPL: number;
  monthlyPL: number;
}

export default function ProfessionalStatsOverview() {
  const { closedTrades, openTrades, botStatus } = useAutoTradingStore();
  const [stats, setStats] = useState<StatsData>({
    totalPL: 0,
    winRate: 0,
    totalTrades: 0,
    activeTrades: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    dailyPL: 0,
    weeklyPL: 0,
    monthlyPL: 0,
  });

  const [tradeCounts, setTradeCounts] = useState({ daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    // Calculate statistics from trades
    const calculateStats = () => {
      const allTrades = [...closedTrades];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Filter trades by time period
      const dailyTrades = allTrades.filter(t => 
        t.closedAt ? new Date(t.closedAt) >= oneDayAgo : false
      );
      const weeklyTrades = allTrades.filter(t => 
        t.closedAt ? new Date(t.closedAt) >= oneWeekAgo : false
      );
      const monthlyTrades = allTrades.filter(t => 
        t.closedAt ? new Date(t.closedAt) >= oneMonthAgo : false
      );

      setTradeCounts({
        daily: dailyTrades.length,
        weekly: weeklyTrades.length,
        monthly: monthlyTrades.length,
      });


      // Calculate totals
      const totalPL = allTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const dailyPL = dailyTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const weeklyPL = weeklyTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const monthlyPL = monthlyTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

      // Calculate win rate
      const winningTrades = allTrades.filter(t => (t.profitLoss || 0) > 0);
      const winRate = allTrades.length > 0 
        ? (winningTrades.length / allTrades.length) * 100 
        : 0;

      // Calculate averages
      const wins = winningTrades.map(t => t.profitLoss || 0);
      const losses = allTrades
        .filter(t => (t.profitLoss || 0) < 0)
        .map(t => Math.abs(t.profitLoss || 0));

      const avgWin = wins.length > 0 
        ? wins.reduce((sum, w) => sum + w, 0) / wins.length 
        : 0;
      const avgLoss = losses.length > 0 
        ? losses.reduce((sum, l) => sum + l, 0) / losses.length 
        : 0;

      // Calculate profit factor
      const totalWins = wins.reduce((sum, w) => sum + w, 0);
      const totalLosses = losses.reduce((sum, l) => sum + l, 0);
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

      setStats({
        totalPL,
        winRate,
        totalTrades: allTrades.length,
        activeTrades: openTrades.length,
        avgWin,
        avgLoss,
        profitFactor,
        dailyPL,
        weeklyPL,
        monthlyPL,
      });
    };

    calculateStats();
  }, [closedTrades, openTrades]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend,
    trendValue 
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
  }) => {
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
    const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

    return (
      <Card className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/30 transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
          <Icon className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{value}</div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendValue}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Performance Overview</h2>
          <p className="text-gray-400 text-sm mt-1">
            Real-time trading statistics and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
          <Activity className={`h-4 w-4 ${botStatus === 'running' ? 'text-green-500 animate-pulse' : 'text-gray-500'}`} />
          <span className="text-sm text-gray-300">
            {botStatus === 'running' ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total P/L"
          value={formatCurrency(stats.totalPL)}
          subtitle={`${stats.totalTrades} total trades`}
          icon={DollarSign}
          trend={stats.totalPL >= 0 ? 'up' : 'down'}
          trendValue={stats.totalPL >= 0 ? 'Profit' : 'Loss'}
        />
        <StatCard
          title="Win Rate"
          value={formatPercent(stats.winRate)}
          subtitle={`${stats.totalTrades} trades analyzed`}
          icon={Target}
          trend={stats.winRate >= 50 ? 'up' : 'down'}
        />
        <StatCard
          title="Profit Factor"
          value={stats.profitFactor.toFixed(2)}
          subtitle={stats.profitFactor >= 1 ? 'Profitable' : 'Needs improvement'}
          icon={BarChart3}
          trend={stats.profitFactor >= 1 ? 'up' : 'down'}
        />
        <StatCard
          title="Active Trades"
          value={stats.activeTrades}
          subtitle="Currently open positions"
          icon={Activity}
        />
      </div>

      {/* Time Period Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">24 Hours</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.dailyPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(stats.dailyPL)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {tradeCounts.daily} trades
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">7 Days</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.weeklyPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(stats.weeklyPL)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {tradeCounts.weekly} trades
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">30 Days</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.monthlyPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(stats.monthlyPL)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {tradeCounts.monthly} trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Average Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Average Win</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(stats.avgWin)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Per winning trade
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Average Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(stats.avgLoss)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Per losing trade
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

