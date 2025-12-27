'use client';

/**
 * Deriv Analytics Component
 * Displays comprehensive Deriv trading analytics
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  RefreshCw,
  Calendar,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface AnalyticsData {
  coreMetrics?: {
    winRate?: number;
    totalProfitLoss?: number;
    profitFactor?: number;
    totalTrades?: number;
  };
  performanceMetrics?: {
    roi?: number;
    maxDrawdown?: number;
    maxDrawdownPercent?: number;
    sharpeRatio?: number;
  };
  activityMetrics?: {
    tradesPerDay?: number;
    averageTradeDuration?: number;
    totalDays?: number;
  };
  strategyPerformance?: Array<{
    strategy: string;
    trades: number;
    winRate: number;
    profitLoss: number;
  }>;
  symbolPerformance?: Array<{
    symbol: string;
    trades: number;
    winRate: number;
    profitLoss: number;
  }>;
  timeBasedAnalysis?: {
    daily?: Array<{ date: string; trades: number; profitLoss: number }>;
    weekly?: Array<{ week: string; trades: number; profitLoss: number }>;
    monthly?: Array<{ month: string; trades: number; profitLoss: number }>;
  };
}

export default function DerivAnalytics() {
  const { connectedBroker } = useAutoTradingStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchAnalytics = async () => {
    try {
      setIsRefreshing(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/deriv/auto-trading/analytics?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch analytics');
      }
    } catch (error: any) {
      console.error('Error fetching Deriv analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (connectedBroker === 'deriv') {
      fetchAnalytics();
    } else {
      // Reset state when broker changes
      setIsLoading(false);
      setAnalytics(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined) return '0%';
    return `${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card className="border-gray-700 bg-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Deriv Trading Analytics
            </CardTitle>
            <CardDescription>Comprehensive trading performance metrics</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Date Filters */}
        <div className="flex gap-2 mt-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder="End Date"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isRefreshing}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core Metrics */}
        {analytics.coreMetrics && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Core Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Win Rate"
                value={formatPercent(analytics.coreMetrics.winRate)}
                icon={<Target className="h-4 w-4" />}
                positive={true}
              />
              <MetricCard
                label="Total P/L"
                value={formatCurrency(analytics.coreMetrics.totalProfitLoss)}
                icon={<DollarSign className="h-4 w-4" />}
                positive={(analytics.coreMetrics.totalProfitLoss || 0) >= 0}
              />
              <MetricCard
                label="Profit Factor"
                value={analytics.coreMetrics.profitFactor?.toFixed(2) || '0.00'}
                icon={<BarChart3 className="h-4 w-4" />}
                positive={(analytics.coreMetrics.profitFactor || 0) >= 1}
              />
              <MetricCard
                label="Total Trades"
                value={analytics.coreMetrics.totalTrades?.toString() || '0'}
                icon={<TrendingUp className="h-4 w-4" />}
                positive={true}
              />
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {analytics.performanceMetrics && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="ROI"
                value={formatPercent(analytics.performanceMetrics.roi)}
                icon={<TrendingUp className="h-4 w-4" />}
                positive={(analytics.performanceMetrics.roi || 0) >= 0}
              />
              <MetricCard
                label="Max Drawdown"
                value={formatCurrency(analytics.performanceMetrics.maxDrawdown)}
                icon={<TrendingDown className="h-4 w-4" />}
                positive={false}
              />
              <MetricCard
                label="Max DD %"
                value={formatPercent(analytics.performanceMetrics.maxDrawdownPercent)}
                icon={<TrendingDown className="h-4 w-4" />}
                positive={false}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={analytics.performanceMetrics.sharpeRatio?.toFixed(2) || '0.00'}
                icon={<BarChart3 className="h-4 w-4" />}
                positive={(analytics.performanceMetrics.sharpeRatio || 0) >= 1}
              />
            </div>
          </div>
        )}

        {/* Activity Metrics */}
        {analytics.activityMetrics && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Activity Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Trades/Day"
                value={analytics.activityMetrics.tradesPerDay?.toFixed(1) || '0'}
                icon={<Target className="h-4 w-4" />}
                positive={true}
              />
              <MetricCard
                label="Avg Duration"
                value={`${analytics.activityMetrics.averageTradeDuration?.toFixed(0) || '0'}m`}
                icon={<Calendar className="h-4 w-4" />}
                positive={true}
              />
              <MetricCard
                label="Total Days"
                value={analytics.activityMetrics.totalDays?.toString() || '0'}
                icon={<Calendar className="h-4 w-4" />}
                positive={true}
              />
            </div>
          </div>
        )}

        {/* Strategy Performance */}
        {analytics.strategyPerformance && analytics.strategyPerformance.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Strategy Performance</h3>
            <div className="space-y-2">
              {analytics.strategyPerformance.map((strategy, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-100">{strategy.strategy}</span>
                    <Badge variant="outline">{strategy.trades} trades</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Win Rate: </span>
                      <span className="text-gray-100 font-semibold">{formatPercent(strategy.winRate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">P/L: </span>
                      <span
                        className={`font-semibold ${
                          strategy.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(strategy.profitLoss)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Performance */}
        {analytics.symbolPerformance && analytics.symbolPerformance.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Symbol Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {analytics.symbolPerformance.map((symbol, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-100">{symbol.symbol}</span>
                    <Badge variant="outline">{symbol.trades} trades</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Win Rate: </span>
                      <span className="text-gray-100 font-semibold">{formatPercent(symbol.winRate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">P/L: </span>
                      <span
                        className={`font-semibold ${
                          symbol.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(symbol.profitLoss)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  positive: boolean;
}) {
  return (
    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`${positive ? 'text-green-400' : 'text-red-400'}`}>{icon}</div>
      </div>
      <p
        className={`text-xl font-semibold ${
          positive ? 'text-gray-100' : 'text-red-400'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

