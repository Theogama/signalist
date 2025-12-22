
import BotStatusWidget from '@/components/BotStatusWidget';
import AutoTradeSyncWidget from '@/components/dashboard/AutoTradeSyncWidget';
import LiveStatsCards from '@/components/dashboard/LiveStatsCards';
import TradingStatisticsPanel from '@/components/dashboard/TradingStatisticsPanel';
import { getBotTrades } from '@/lib/actions/bot.actions';
import { getSignals } from '@/lib/actions/signals.actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Activity, Signal, BarChart3, Store } from 'lucide-react';
import TradingViewWidget from '@/components/TradingViewWidget';
import { MARKET_OVERVIEW_WIDGET_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [tradesResult, signalsResult] = await Promise.all([
    getBotTrades({ limit: 10 }),
    getSignals({ status: 'active', limit: 5 }),
  ]);

  const recentTrades = tradesResult.success && 'data' in tradesResult 
    ? tradesResult.data || [] 
    : [];
  const recentSignals = signalsResult.success && 'data' in signalsResult 
    ? signalsResult.data || [] 
    : [];

  const activeTrades = recentTrades.filter(
    (t: any) => t.status === 'PENDING' || t.status === 'FILLED'
  ).length;

  const totalProfitLoss = recentTrades.reduce((sum: number, t: any) => {
    return sum + (t.profitLoss || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
          <p className="text-gray-400">Overview of your trading activity and bot performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Auto-Trade Sync Widget - Shows live data from autotrade */}
        <div className="lg:col-span-1">
          <AutoTradeSyncWidget />
        </div>

        {/* Live Stats Cards - Real-time auto-trade stats */}
        <LiveStatsCards />

        {/* Legacy Bot Status Widget - Fallback for database stats */}
        <div className="lg:col-span-1 hidden lg:block">
          <BotStatusWidget />
        </div>
      </div>

      {/* Trading Statistics Panel - Persistent Data */}
      <TradingStatisticsPanel />

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Database Trades</span>
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-100">{activeTrades}</div>
          <Link href="/dashboard/bot-trades">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              View all trades →
            </Button>
          </Link>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Database P/L</span>
            <TrendingUp className="h-5 w-5 text-green-400" />
          </div>
          <div className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(2)}
          </div>
          <Link href="/dashboard/analytics">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              View analytics →
            </Button>
          </Link>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Active Signals</span>
            <Signal className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-gray-100">{recentSignals.length}</div>
          <Link href="/signals">
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-gray-400 hover:text-gray-300">
              View all signals →
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link href="/signals">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors cursor-pointer">
            <Signal className="h-6 w-6 text-yellow-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Trading Signals</h3>
            <p className="text-sm text-gray-400">View and manage trading signals</p>
          </div>
        </Link>

        <Link href="/marketplace">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors cursor-pointer">
            <Store className="h-6 w-6 text-orange-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Bot Marketplace</h3>
            <p className="text-sm text-gray-400">Discover and install trading bots</p>
          </div>
        </Link>

        <Link href="/dashboard/bot-trades">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors cursor-pointer">
            <Activity className="h-6 w-6 text-blue-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Bot Trades</h3>
            <p className="text-sm text-gray-400">Monitor your automated trades</p>
          </div>
        </Link>

        <Link href="/analytics">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors cursor-pointer">
            <BarChart3 className="h-6 w-6 text-green-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Live Analytics</h3>
            <p className="text-sm text-gray-400">Real-time charts and analysis</p>
          </div>
        </Link>

        <Link href="/watchlist">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors cursor-pointer">
            <TrendingUp className="h-6 w-6 text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Watchlist</h3>
            <p className="text-sm text-gray-400">Track your favorite stocks</p>
          </div>
        </Link>
      </div>

      {/* Market Overview Widget */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Market Overview</h2>
        <TradingViewWidget
          scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
          config={MARKET_OVERVIEW_WIDGET_CONFIG}
          height={500}
        />
      </div>
    </div>
  );
}
