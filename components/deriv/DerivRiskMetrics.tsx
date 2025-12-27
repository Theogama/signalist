'use client';

/**
 * Deriv Risk Metrics Component
 * Displays Deriv-specific risk management metrics
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Target,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface RiskMetrics {
  exposure?: {
    totalExposure?: number;
    maxExposure?: number;
    exposurePercent?: number;
  };
  drawdown?: {
    current?: number;
    max?: number;
    maxPercent?: number;
  };
  limits?: {
    dailyLossLimit?: number;
    dailyLossUsed?: number;
    dailyLossPercent?: number;
    maxTradesPerDay?: number;
    tradesToday?: number;
    tradesRemaining?: number;
  };
  positionSizing?: {
    averageSize?: number;
    maxSize?: number;
    riskPerTrade?: number;
  };
  compliance?: {
    isWithinLimits?: boolean;
    violations?: Array<{
      type: string;
      message: string;
      severity: 'warning' | 'error';
    }>;
  };
}

export default function DerivRiskMetrics() {
  const { connectedBroker } = useAutoTradingStore();
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/deriv/auto-trading/risk-metrics');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setMetrics(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch risk metrics');
      }
    } catch (error: any) {
      console.error('Error fetching Deriv risk metrics:', error);
      toast.error('Failed to fetch risk metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (connectedBroker === 'deriv') {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 15000); // Refresh every 15 seconds
      return () => clearInterval(interval);
    } else {
      // Reset state when broker changes
      setIsLoading(false);
      setMetrics(null);
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

  if (!metrics) {
    return null;
  }

  const isCompliant = metrics.compliance?.isWithinLimits ?? true;

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Metrics
            </CardTitle>
            <CardDescription>Real-time risk management metrics</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isCompliant ? 'default' : 'destructive'}
              className={
                isCompliant
                  ? 'bg-green-500/20 text-green-400 border-green-500/50'
                  : 'bg-red-500/20 text-red-400 border-red-500/50'
              }
            >
              {isCompliant ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Compliant
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Warning
                </>
              )}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMetrics}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Exposure Metrics */}
        {metrics.exposure && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Exposure</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Total Exposure"
                value={formatCurrency(metrics.exposure.totalExposure)}
                icon={<DollarSign className="h-4 w-4" />}
              />
              <MetricCard
                label="Max Exposure"
                value={formatCurrency(metrics.exposure.maxExposure)}
                icon={<Target className="h-4 w-4" />}
              />
              <MetricCard
                label="Exposure %"
                value={formatPercent(metrics.exposure.exposurePercent)}
                icon={<TrendingDown className="h-4 w-4" />}
                warning={metrics.exposure.exposurePercent && metrics.exposure.exposurePercent > 80}
              />
            </div>
          </div>
        )}

        {/* Drawdown Metrics */}
        {metrics.drawdown && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Drawdown</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Current DD"
                value={formatCurrency(metrics.drawdown.current)}
                icon={<TrendingDown className="h-4 w-4" />}
                warning={metrics.drawdown.current && metrics.drawdown.current < -100}
              />
              <MetricCard
                label="Max DD"
                value={formatCurrency(metrics.drawdown.max)}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <MetricCard
                label="Max DD %"
                value={formatPercent(metrics.drawdown.maxPercent)}
                icon={<TrendingDown className="h-4 w-4" />}
                warning={metrics.drawdown.maxPercent && metrics.drawdown.maxPercent > 20}
              />
            </div>
          </div>
        )}

        {/* Limits */}
        {metrics.limits && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Daily Limits</h3>
            <div className="space-y-3">
              {/* Daily Loss Limit */}
              {metrics.limits.dailyLossLimit !== undefined && (
                <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Daily Loss Limit</span>
                    <Badge variant="outline">
                      {formatPercent(metrics.limits.dailyLossPercent)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-100">
                      {formatCurrency(metrics.limits.dailyLossUsed)}
                    </span>
                    <span className="text-xs text-gray-500">
                      / {formatCurrency(metrics.limits.dailyLossLimit)}
                    </span>
                  </div>
                  {metrics.limits.dailyLossPercent && (
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          (metrics.limits.dailyLossPercent || 0) > 80
                            ? 'bg-red-500'
                            : (metrics.limits.dailyLossPercent || 0) > 50
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(metrics.limits.dailyLossPercent, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Trade Limits */}
              {metrics.limits.maxTradesPerDay !== undefined && (
                <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Daily Trade Limit</span>
                    <Badge variant="outline">
                      {metrics.limits.tradesToday || 0} / {metrics.limits.maxTradesPerDay}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-100">
                      {metrics.limits.tradesRemaining || 0} remaining
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatPercent(
                        metrics.limits.maxTradesPerDay
                          ? ((metrics.limits.tradesToday || 0) / metrics.limits.maxTradesPerDay) * 100
                          : 0
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Position Sizing */}
        {metrics.positionSizing && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Position Sizing</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Avg Size"
                value={formatCurrency(metrics.positionSizing.averageSize)}
                icon={<DollarSign className="h-4 w-4" />}
              />
              <MetricCard
                label="Max Size"
                value={formatCurrency(metrics.positionSizing.maxSize)}
                icon={<Target className="h-4 w-4" />}
              />
              <MetricCard
                label="Risk/Trade"
                value={formatPercent(metrics.positionSizing.riskPerTrade)}
                icon={<Shield className="h-4 w-4" />}
              />
            </div>
          </div>
        )}

        {/* Compliance Violations */}
        {metrics.compliance?.violations && metrics.compliance.violations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Compliance Issues</h3>
            <div className="space-y-2">
              {metrics.compliance.violations.map((violation, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    violation.severity === 'error'
                      ? 'bg-red-500/10 border-red-500/50'
                      : 'bg-yellow-500/10 border-yellow-500/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 ${
                        violation.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-100">{violation.type}</p>
                      <p className="text-xs text-gray-400 mt-1">{violation.message}</p>
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
  warning,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        warning
          ? 'bg-red-500/10 border-red-500/50'
          : 'bg-gray-900/50 border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={warning ? 'text-red-400' : 'text-gray-400'}>{icon}</div>
      </div>
      <p className={`text-xl font-semibold ${warning ? 'text-red-400' : 'text-gray-100'}`}>
        {value}
      </p>
    </div>
  );
}

