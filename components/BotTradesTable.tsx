'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import TradeManagementActions from '@/components/TradeManagementActions';

type BotTrade = {
  tradeId: string;
  signalId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  status: string;
  profitLoss?: number;
  profitLossPct?: number;
  quantity: number;
  createdAt: Date | string;
  filledAt?: Date | string;
  closedAt?: Date | string;
};

export default function BotTradesTable({ initialTrades }: { initialTrades: BotTrade[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<BotTrade[]>(initialTrades);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  useEffect(() => {
    setTrades(initialTrades);
  }, [initialTrades]);

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`/dashboard/bot-trades?${params.toString()}`);
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sortBy', field);
    params.set('sortOrder', newOrder);
    router.push(`/dashboard/bot-trades?${params.toString()}`);
  };

  const filteredTrades = statusFilter === 'all' 
    ? trades 
    : trades.filter(t => t.status === statusFilter);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'text-green-400';
      case 'CLOSED':
        return 'text-blue-400';
      case 'PENDING':
        return 'text-yellow-400';
      case 'CANCELLED':
        return 'text-gray-400';
      case 'FAILED':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  };

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 hover:bg-transparent text-gray-400 hover:text-gray-200"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Status:</label>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FILLED">Filled</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="createdAt">Trade ID</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="symbol">Symbol</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Action</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="entryPrice">Entry Price</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Exit Price</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Quantity</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="profitLoss">P/L</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="status">Status</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                <SortButton field="createdAt">Date</SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-400">
                  No trades found
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <tr key={trade.tradeId} className="hover:bg-gray-700/50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-300 font-mono">
                    {trade.tradeId.substring(0, 8)}...
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-200">{trade.symbol}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        trade.action === 'BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {trade.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">{formatCurrency(trade.entryPrice)}</td>
                  <td className="py-3 px-4 text-sm text-gray-300">
                    {formatCurrency(trade.exitPrice)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">{trade.quantity.toFixed(4)}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-semibold ${
                          (trade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(trade.profitLoss)}
                      </span>
                      <span
                        className={`text-xs ${
                          (trade.profitLossPct || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatPercent(trade.profitLossPct)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-medium ${getStatusColor(trade.status)}`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-400">
                    {formatDate(trade.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <TradeManagementActions 
                      tradeId={trade.tradeId} 
                      status={trade.status}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

