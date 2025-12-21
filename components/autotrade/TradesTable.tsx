'use client';

/**
 * Trades Table Component
 * Displays open or closed trades in a table format
 */

import { Trade } from '@/lib/stores/autoTradingStore';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradesTableProps {
  trades: Trade[];
}

export default function TradesTable({ trades }: TradesTableProps) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No trades to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left p-2 text-xs font-semibold text-gray-400">Symbol</th>
            <th className="text-left p-2 text-xs font-semibold text-gray-400">Side</th>
            <th className="text-right p-2 text-xs font-semibold text-gray-400">Entry</th>
            <th className="text-right p-2 text-xs font-semibold text-gray-400">Exit</th>
            <th className="text-right p-2 text-xs font-semibold text-gray-400">Qty</th>
            <th className="text-right p-2 text-xs font-semibold text-gray-400">P/L</th>
            <th className="text-left p-2 text-xs font-semibold text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="p-2 text-sm text-gray-100">{trade.symbol}</td>
              <td className="p-2">
                <Badge
                  variant="outline"
                  className={trade.side === 'BUY' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}
                >
                  {trade.side}
                </Badge>
              </td>
              <td className="p-2 text-right text-sm text-gray-300">
                ${trade.entryPrice.toFixed(2)}
              </td>
              <td className="p-2 text-right text-sm text-gray-300">
                {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
              </td>
              <td className="p-2 text-right text-sm text-gray-300">
                {trade.quantity}
              </td>
              <td className="p-2 text-right">
                {trade.profitLoss !== undefined && (
                  <div className={`flex items-center justify-end gap-1 ${
                    trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.profitLoss >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="font-semibold">
                      ${trade.profitLoss.toFixed(2)}
                    </span>
                  </div>
                )}
              </td>
              <td className="p-2">
                <Badge
                  variant="outline"
                  className={
                    trade.status === 'OPEN' ? 'border-blue-500 text-blue-400' :
                    trade.status === 'CLOSED' ? 'border-green-500 text-green-400' :
                    'border-red-500 text-red-400'
                  }
                >
                  {trade.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}











