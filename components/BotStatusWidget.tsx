import Link from 'next/link';
import { Bot, Settings, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBotSettings, getBotTrades } from '@/lib/actions/bot.actions';
import { getBotAnalytics } from '@/lib/actions/bot-analytics.actions';

export default async function BotStatusWidget() {
  const [settingsResult, tradesResult, analyticsResult] = await Promise.all([
    getBotSettings(),
    getBotTrades({ limit: 1000 }),
    getBotAnalytics(),
  ]);

  const settings = settingsResult.success && 'data' in settingsResult ? settingsResult.data : null;
  const trades = tradesResult.success && 'data' in tradesResult ? tradesResult.data || [] : [];
  const analytics = analyticsResult.success && 'data' in analyticsResult ? analyticsResult.data : null;

  const activeTrades = trades.filter(
    (t: any) => t.status === 'PENDING' || t.status === 'FILLED'
  ).length;

  const totalProfitLoss = trades.reduce((sum: number, t: any) => {
    return sum + (t.profitLoss || 0);
  }, 0);

  const stats = {
    enabled: settings?.enabled || false,
    paperMode: settings?.paperMode !== false,
    totalTrades: trades.length,
    activeTrades,
    totalProfitLoss,
    winRate: analytics?.performance?.winRate || 0,
    profitLoss24h: analytics?.timePeriods?.last24h?.profitLoss || 0,
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-gray-100">Auto-Trade Bot</h3>
        </div>
        <Link href="/settings/bot">
          <Button variant="ghost" size="sm" className="text-yellow-400 hover:text-yellow-300">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Status</span>
          <span
            className={`text-sm font-semibold ${
              stats.enabled ? 'text-green-400' : 'text-gray-500'
            }`}
          >
            {stats.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Mode</span>
          <span className="text-sm font-medium text-gray-300">
            {stats.paperMode ? 'Paper Trading' : 'Live Trading'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Total Trades</span>
          <span className="text-sm font-semibold text-gray-100">{stats.totalTrades}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Active Trades</span>
          <span className="text-sm font-semibold text-gray-100">{stats.activeTrades}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <span className="text-sm text-gray-400">Total P/L</span>
          <span
            className={`text-sm font-bold ${
              stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {stats.totalProfitLoss >= 0 ? '+' : ''}${stats.totalProfitLoss.toFixed(2)}
          </span>
        </div>

        {stats.winRate > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
            <span className="text-sm text-gray-400">Win Rate</span>
            <span className="text-sm font-semibold text-gray-100">
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
        )}

        {stats.profitLoss24h !== 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
            <span className="text-sm text-gray-400">24h P/L</span>
            <div className="flex items-center gap-1">
              {stats.profitLoss24h >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <span
                className={`text-sm font-semibold ${
                  stats.profitLoss24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stats.profitLoss24h >= 0 ? '+' : ''}${stats.profitLoss24h.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {!stats.enabled && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-yellow-400">
                Bot is disabled. Enable it in{' '}
                <Link href="/settings/bot" className="underline font-semibold">
                  Bot Settings
                </Link>{' '}
                to start automated trading.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/dashboard/bot-trades">
          <Button variant="outline" size="sm" className="w-full">
            Trades
          </Button>
        </Link>
        <Link href="/signals">
          <Button variant="outline" size="sm" className="w-full">
            Signals
          </Button>
        </Link>
        <Link href="/dashboard/analytics" className="col-span-2">
          <Button variant="outline" size="sm" className="w-full">
            View Analytics
          </Button>
        </Link>
      </div>
    </div>
  );
}

