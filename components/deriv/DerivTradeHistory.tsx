'use client';

/**
 * Deriv Trade History Component
 * Displays Deriv-specific trade history with detailed information
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Using native table elements for simplicity
import {
  TrendingUp,
  TrendingDown,
  History,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface DerivTrade {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  lotOrStake: number;
  status: string;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
  entryTimestamp: string;
  exitTimestamp?: string;
  entryReason?: string;
  exitReason?: string;
}

export default function DerivTradeHistory() {
  const { connectedBroker } = useAutoTradingStore();
  const [trades, setTrades] = useState<DerivTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (connectedBroker === 'deriv') {
      fetchTrades();
    }
  }, [connectedBroker, statusFilter, limit]);

  const fetchTrades = async () => {
    try {
      setIsRefreshing(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      params.append('limit', limit.toString());
      params.append('offset', '0');

      const response = await fetch(`/api/deriv/auto-trading/trades?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setTrades(data.data.trades || []);
      } else {
        toast.error(data.error || 'Failed to fetch trades');
      }
    } catch (error: any) {
      console.error('Error fetching Deriv trades:', error);
      toast.error('Failed to fetch trades');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      OPEN: { variant: 'default', label: 'Open', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
      CLOSED: { variant: 'secondary', label: 'Closed', className: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
      TP_HIT: { variant: 'default', label: 'TP Hit', className: 'bg-green-500/20 text-green-400 border-green-500/50' },
      SL_HIT: { variant: 'destructive', label: 'SL Hit', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
      MANUAL_CLOSE: { variant: 'outline', label: 'Manual', className: 'border-gray-500/50' },
    };

    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.className}>
        {statusInfo.label}
      </Badge>
    );
  };

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

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Deriv Trade History
            </CardTitle>
            <CardDescription>Detailed history of all Deriv trades</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="TP_HIT">TP Hit</option>
              <option value="SL_HIT">SL Hit</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchTrades}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">No trades found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Symbol</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Side</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Entry Price</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Exit Price</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Stake</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">P/L</th>
                  <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const pnl = trade.realizedPnl !== undefined ? trade.realizedPnl : trade.unrealizedPnl || 0;
                  const pnlPercent = trade.realizedPnlPercent !== undefined ? trade.realizedPnlPercent : trade.unrealizedPnlPercent || 0;

                  return (
                    <tr key={trade.tradeId} className="border-b border-gray-700 hover:bg-gray-900/50">
                      <td className="py-3 px-4 text-gray-300 text-sm">
                        {formatDate(trade.entryTimestamp)}
                      </td>
                      <td className="py-3 px-4 text-gray-100 font-medium">
                        {trade.symbol}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={trade.side === 'BUY' ? 'default' : 'destructive'}
                          className={trade.side === 'BUY' ? 'bg-green-600' : 'bg-red-600'}
                        >
                          {trade.side === 'BUY' ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {trade.side}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-100">
                        {formatCurrency(trade.entryPrice)}
                      </td>
                      <td className="py-3 px-4 text-gray-100">
                        {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-100">
                        {formatCurrency(trade.lotOrStake)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatCurrency(pnl)}
                        </span>
                        {pnlPercent !== undefined && (
                          <span
                            className={`text-xs ml-1 ${
                              pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            ({pnlPercent.toFixed(2)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(trade.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Stats */}
        {trades.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total Trades: </span>
                <span className="text-gray-100 font-semibold">{trades.length}</span>
              </div>
              <div>
                <span className="text-gray-400">Wins: </span>
                <span className="text-green-400 font-semibold">
                  {trades.filter(t => (t.realizedPnl || t.unrealizedPnl || 0) > 0).length}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Total P/L: </span>
                <span
                  className={`font-semibold ${
                    trades.reduce((sum, t) => sum + (t.realizedPnl || t.unrealizedPnl || 0), 0) >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {formatCurrency(
                    trades.reduce((sum, t) => sum + (t.realizedPnl || t.unrealizedPnl || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

