'use client';

/**
 * Time-Based Analytics Component
 * Displays hourly, daily, and weekly profit analytics for Deriv auto-trading
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  BarChart3,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface HourlyData {
  hour: string;
  date: string;
  hourOfDay: number;
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}

interface DailyData {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}

interface WeeklyData {
  week: string;
  weekStart: string;
  weekEnd: string;
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
  dailyBreakdown: DailyData[];
}

interface AnalyticsSummary {
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalProfitLoss: number;
  totalStake: number;
  averageWinRate: number;
}

export default function TimeBasedAnalytics() {
  const { selectedBot, connectedBroker } = useAutoTradingStore();
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const fetchAnalytics = async (period: 'hourly' | 'daily' | 'weekly') => {
    if (!selectedBot?.id || connectedBroker !== 'deriv') {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        botId: selectedBot.id,
        period,
        isDemo: isDemo.toString(),
        hours: '24',
        days: '30',
        weeks: '12',
      });

      const response = await fetch(`/api/auto-trading/analytics/time-based?${params}`);
      const result = await response.json();

      if (result.success) {
        if (period === 'hourly') {
          setHourlyData(result.data);
        } else if (period === 'daily') {
          setDailyData(result.data);
        } else if (period === 'weekly') {
          setWeeklyData(result.data);
        }
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(activeTab);
  }, [activeTab, selectedBot, isDemo, connectedBroker]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Time-Based Analytics
            </CardTitle>
            <CardDescription>
              Hourly, daily, and weekly profit analysis for Deriv auto-trading
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isDemo ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setIsDemo(!isDemo);
              }}
            >
              {isDemo ? 'Demo' : 'Live'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalytics(activeTab)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedBot ? (
          <div className="text-center py-8 text-gray-400">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a bot to view analytics</p>
          </div>
        ) : connectedBroker !== 'deriv' ? (
          <div className="text-center py-8 text-gray-400">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Analytics available for Deriv broker only</p>
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Total P/L</div>
                  <div className={`text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(summary.totalProfitLoss)}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Total Trades</div>
                  <div className="text-2xl font-bold text-white">
                    {summary.totalTrades}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Win Rate</div>
                  <div className="text-2xl font-bold text-white">
                    {formatPercent(summary.averageWinRate)}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Wins / Losses</div>
                  <div className="text-2xl font-bold text-white">
                    {summary.totalWins} / {summary.totalLosses}
                  </div>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="hourly">
                  <Clock className="h-4 w-4 mr-2" />
                  Hourly
                </TabsTrigger>
                <TabsTrigger value="daily">
                  <Calendar className="h-4 w-4 mr-2" />
                  Daily
                </TabsTrigger>
                <TabsTrigger value="weekly">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Weekly
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hourly" className="mt-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : hourlyData.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No hourly data available</div>
                  ) : (
                    hourlyData.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-sm font-medium">{item.hour}</div>
                            <div className="text-xs text-gray-400">{item.date}</div>
                          </div>
                          <Badge variant="outline">{item.trades} trades</Badge>
                          <Badge variant={item.winRate >= 50 ? 'default' : 'secondary'}>
                            {formatPercent(item.winRate)}
                          </Badge>
                        </div>
                        <div className={`text-lg font-bold ${item.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(item.profitLoss)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="daily" className="mt-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : dailyData.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No daily data available</div>
                  ) : (
                    dailyData.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-sm font-medium">{item.date}</div>
                            <div className="text-xs text-gray-400">
                              {item.wins}W / {item.losses}L
                            </div>
                          </div>
                          <Badge variant="outline">{item.trades} trades</Badge>
                          <Badge variant={item.winRate >= 50 ? 'default' : 'secondary'}>
                            {formatPercent(item.winRate)}
                          </Badge>
                        </div>
                        <div className={`text-lg font-bold ${item.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(item.profitLoss)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="weekly" className="mt-4">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : weeklyData.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No weekly data available</div>
                  ) : (
                    weeklyData.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-medium">
                              Week {item.week} ({item.weekStart} to {item.weekEnd})
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.wins}W / {item.losses}L • {item.trades} trades
                            </div>
                          </div>
                          <div className={`text-xl font-bold ${item.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(item.profitLoss)}
                          </div>
                        </div>
                        {item.dailyBreakdown.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className="text-xs text-gray-400 mb-2">Daily Breakdown:</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {item.dailyBreakdown.map((day, dayIndex) => (
                                <div key={dayIndex} className="text-xs">
                                  <div className="text-gray-300">{day.date}</div>
                                  <div className={`font-medium ${day.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(day.profitLoss)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}


