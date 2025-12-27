'use client';

/**
 * Deriv Auto-Trading Status Component
 * Displays Deriv-specific auto-trading status and session information
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  Play, 
  Square, 
  Clock, 
  TrendingUp, 
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface AutoTradingSession {
  sessionId?: string;
  strategy?: string;
  startedAt?: string;
  totalTrades?: number;
  totalProfitLoss?: number;
  startBalance?: number;
  riskSettings?: {
    maxTradesPerDay?: number;
    dailyLossLimit?: number;
    maxStakeSize?: number;
    riskPerTrade?: number;
    autoStopDrawdown?: number;
  };
}

interface ServiceStatus {
  activeContracts?: number;
  dailyTradeCount?: number;
  dailyProfitLoss?: number;
}

interface StatusData {
  isRunning: boolean;
  session: AutoTradingSession | null;
  serviceStatus?: ServiceStatus;
}

export default function DerivAutoTradingStatus() {
  const { connectedBroker } = useAutoTradingStore();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/deriv/auto-trading/status');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setStatus(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch status');
      }
    } catch (error: any) {
      console.error('Error fetching Deriv auto-trading status:', error);
      toast.error('Failed to fetch auto-trading status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (connectedBroker === 'deriv') {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    } else {
      // Reset state when broker changes
      setIsLoading(false);
      setStatus(null);
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

  const formatDuration = (startTime: string | undefined) => {
    if (!startTime) return 'N/A';
    try {
      const start = new Date(startTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    } catch {
      return startTime;
    }
  };

  // Only show when Deriv is connected
  if (connectedBroker !== 'deriv') {
    return null;
  }

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

  if (!status) {
    return null;
  }

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Deriv Auto-Trading Status
            </CardTitle>
            <CardDescription>Real-time Deriv auto-trading session information</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Status</span>
          <Badge
            variant={status.isRunning ? 'default' : 'secondary'}
            className={
              status.isRunning
                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
            }
          >
            {status.isRunning ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Running
              </>
            ) : (
              <>
                <Square className="h-3 w-3 mr-1" />
                Stopped
              </>
            )}
          </Badge>
        </div>

        {/* Session Information */}
        {status.session && (
          <div className="space-y-3 pt-2 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Strategy</Label>
                <p className="mt-1 text-sm font-semibold text-gray-100">
                  {status.session.strategy || 'N/A'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Session ID</Label>
                <p className="mt-1 text-sm text-gray-300 font-mono text-xs">
                  {status.session.sessionId?.slice(0, 8) || 'N/A'}...
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Started</Label>
                <p className="mt-1 text-sm text-gray-300">{formatDuration(status.session.startedAt)}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Total Trades</Label>
                <p className="mt-1 text-sm font-semibold text-gray-100">
                  {status.session.totalTrades || 0}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Start Balance</Label>
                <p className="mt-1 text-sm font-semibold text-gray-100">
                  {formatCurrency(status.session.startBalance)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Total P/L</Label>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    (status.session.totalProfitLoss || 0) >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {formatCurrency(status.session.totalProfitLoss)}
                </p>
              </div>
            </div>

            {/* Risk Settings */}
            {status.session.riskSettings && (
              <div className="pt-3 border-t border-gray-700">
                <Label className="text-xs text-gray-500 mb-2 block">Risk Settings</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 bg-gray-900/50 rounded">
                    <p className="text-xs text-gray-500">Max Trades/Day</p>
                    <p className="text-sm font-semibold text-gray-100">
                      {status.session.riskSettings.maxTradesPerDay || 'Unlimited'}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-900/50 rounded">
                    <p className="text-xs text-gray-500">Risk/Trade</p>
                    <p className="text-sm font-semibold text-gray-100">
                      {status.session.riskSettings.riskPerTrade || 'N/A'}%
                    </p>
                  </div>
                  <div className="p-2 bg-gray-900/50 rounded">
                    <p className="text-xs text-gray-500">Daily Loss Limit</p>
                    <p className="text-sm font-semibold text-gray-100">
                      {status.session.riskSettings.dailyLossLimit
                        ? formatCurrency(status.session.riskSettings.dailyLossLimit)
                        : 'No Limit'}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-900/50 rounded">
                    <p className="text-xs text-gray-500">Max Stake</p>
                    <p className="text-sm font-semibold text-gray-100">
                      {status.session.riskSettings.maxStakeSize
                        ? formatCurrency(status.session.riskSettings.maxStakeSize)
                        : 'No Limit'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Service Status */}
        {status.serviceStatus && (
          <div className="pt-3 border-t border-gray-700">
            <Label className="text-xs text-gray-500 mb-2 block">Service Status</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2 bg-gray-900/50 rounded text-center">
                <p className="text-xs text-gray-500">Active Contracts</p>
                <p className="text-sm font-semibold text-gray-100 mt-1">
                  {status.serviceStatus.activeContracts || 0}
                </p>
              </div>
              <div className="p-2 bg-gray-900/50 rounded text-center">
                <p className="text-xs text-gray-500">Daily Trades</p>
                <p className="text-sm font-semibold text-gray-100 mt-1">
                  {status.serviceStatus.dailyTradeCount || 0}
                </p>
              </div>
              <div className="p-2 bg-gray-900/50 rounded text-center">
                <p className="text-xs text-gray-500">Daily P/L</p>
                <p
                  className={`text-sm font-semibold mt-1 ${
                    (status.serviceStatus.dailyProfitLoss || 0) >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {formatCurrency(status.serviceStatus.dailyProfitLoss)}
                </p>
              </div>
            </div>
          </div>
        )}

        {!status.isRunning && !status.session && (
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-gray-500 mb-2" />
            <p className="text-sm text-gray-400">No active auto-trading session</p>
            <p className="text-xs text-gray-500 mt-1">Start a bot to begin auto-trading</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


