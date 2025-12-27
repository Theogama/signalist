'use client';

/**
 * Deriv Execution Results Component
 * Displays detailed Deriv auto-trading execution results and statistics
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface DerivExecutionData {
  isRunning: boolean;
  session: {
    sessionId: string;
    strategy: string;
    startedAt: string;
    totalTrades: number;
    totalProfitLoss: number;
    startBalance: number;
    riskSettings: {
      maxTradesPerDay: number;
      dailyLossLimit: number;
      maxStakeSize: number;
      riskPerTrade: number;
    };
  } | null;
  serviceStatus: {
    activeContracts: number;
    dailyTradeCount: number;
    dailyProfitLoss: number;
  };
}

export default function DerivExecutionResults() {
  const [executionData, setExecutionData] = useState<DerivExecutionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExecutionData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/deriv/auto-trading/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setExecutionData(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching Deriv execution data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExecutionData();
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchExecutionData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Deriv Execution Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">Loading execution data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!executionData || !executionData.session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Deriv Execution Results
          </CardTitle>
          <CardDescription>Auto-trading execution statistics and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            No active auto-trading session
          </div>
        </CardContent>
      </Card>
    );
  }

  const { session, serviceStatus } = executionData;
  const sessionDuration = session.startedAt 
    ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000 / 60)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-400" />
          Deriv Execution Results
          <Badge variant="outline" className={`${
            executionData.isRunning 
              ? 'border-green-500 text-green-400' 
              : 'border-gray-500 text-gray-400'
          }`}>
            {executionData.isRunning ? 'Active' : 'Inactive'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time auto-trading execution statistics and performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Strategy</span>
            </div>
            <div className="text-lg font-bold text-gray-100">{session.strategy}</div>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-400">Session Duration</span>
            </div>
            <div className="text-lg font-bold text-gray-100">
              {sessionDuration > 60 
                ? `${Math.floor(sessionDuration / 60)}h ${sessionDuration % 60}m`
                : `${sessionDuration}m`
              }
            </div>
          </div>
        </div>

        {/* Execution Statistics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold text-gray-300">Execution Statistics</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
              <div className="text-xs text-gray-400 mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-purple-400">{session.totalTrades}</div>
              {serviceStatus.activeContracts > 0 && (
                <div className="text-xs text-yellow-400 mt-1">
                  {serviceStatus.activeContracts} active contracts
                </div>
              )}
            </div>

            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
              <div className="text-xs text-gray-400 mb-1">Session P/L</div>
              <div className={`text-2xl font-bold ${
                session.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {session.totalProfitLoss >= 0 ? '+' : ''}${session.totalProfitLoss.toFixed(2)}
              </div>
              {session.startBalance > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  ROI: {((session.totalProfitLoss / session.startBalance) * 100).toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Performance */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-gray-300">Today's Performance</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
              <div className="text-xs text-gray-400 mb-1">Daily Trades</div>
              <div className="text-xl font-bold text-blue-400">{serviceStatus.dailyTradeCount}</div>
              {session.riskSettings.maxTradesPerDay > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Limit: {session.riskSettings.maxTradesPerDay}
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
              <div className="text-xs text-gray-400 mb-1">Daily P/L</div>
              <div className={`text-xl font-bold ${
                serviceStatus.dailyProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {serviceStatus.dailyProfitLoss >= 0 ? '+' : ''}${serviceStatus.dailyProfitLoss.toFixed(2)}
              </div>
              {session.riskSettings.dailyLossLimit > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Limit: ${session.riskSettings.dailyLossLimit.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk Settings */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-semibold text-gray-300">Risk Settings</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Max Stake</div>
              <div className="text-sm font-bold text-gray-100">
                ${session.riskSettings.maxStakeSize.toFixed(2)}
              </div>
            </div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Risk/Trade</div>
              <div className="text-sm font-bold text-gray-100">
                {session.riskSettings.riskPerTrade}%
              </div>
            </div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Start Balance</div>
              <div className="text-sm font-bold text-gray-100">
                ${session.startBalance.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Last updated:</span>
            <span className="text-gray-400">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

