'use client';

/**
 * Closed Trades Component
 * Displays recent trade history
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, History, RefreshCw } from 'lucide-react';

export default function ClosedTrades() {
  const { closedTrades, connectedBroker } = useAutoTradingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchClosedTrades = async () => {
    if (!connectedBroker) return;
    
    setIsLoading(true);
    try {
      // Include broker parameter to ensure Deriv data is fetched
      const url = connectedBroker === 'deriv' 
        ? `/api/auto-trading/positions?broker=deriv`
        : '/api/auto-trading/positions';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.closedTrades) {
          // Trades are already in store via syncTrades
        }
      }
    } catch (error) {
      console.error('Error fetching closed trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Don't fetch here - let the dashboard handle it to avoid duplicate calls
    // Only fetch if dashboard hasn't loaded yet (fallback)
    if (closedTrades.length === 0) {
      fetchClosedTrades();
    }
    // Reduced polling - rely on dashboard and WebSocket for updates
    const interval = setInterval(() => {
      // Only fetch if we have no trades (initial load)
      if (closedTrades.length === 0) {
        fetchClosedTrades();
      }
    }, 20000); // Poll every 20 seconds as fallback
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker]);

  const displayedTrades = showAll ? closedTrades : closedTrades.slice(0, 10);

  return (
    <Card id="closed-trades">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Closed Trades
          </div>
          <button
            onClick={fetchClosedTrades}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Refresh trades"
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </CardTitle>
        <CardDescription>
          Recent trade history ({closedTrades.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {closedTrades.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No closed trades yet</p>
            <p className="text-xs mt-1">Completed trades will appear here</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={trade.side === 'BUY' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}
                        >
                          {trade.side}
                        </Badge>
                        <span className="font-semibold text-gray-100">{trade.symbol}</span>
                        <Badge
                          variant="outline"
                          className={
                            trade.status === 'CLOSED' ? 'border-green-500 text-green-400' :
                            'border-red-500 text-red-400'
                          }
                        >
                          {trade.status}
                        </Badge>
                        {connectedBroker === 'deriv' && (
                          <Badge variant="outline" className="border-purple-500 text-purple-400 text-xs">
                            DERIV
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs">Entry Price</div>
                          <div className="text-gray-100 font-semibold">
                            ${trade.entryPrice.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Exit Price</div>
                          <div className="text-gray-100 font-semibold">
                            {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Quantity</div>
                          <div className="text-gray-100 font-semibold">
                            {trade.quantity}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Profit/Loss</div>
                          <div className={`font-semibold flex items-center gap-1 ${
                            (trade.profitLoss || 0) > 0 ? 'text-green-400' :
                            (trade.profitLoss || 0) < 0 ? 'text-red-400' :
                            'text-gray-400'
                          }`}>
                            {(trade.profitLoss || 0) > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (trade.profitLoss || 0) < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : null}
                            ${(trade.profitLoss || 0).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Duration</div>
                          <div className="text-gray-100 font-semibold text-xs">
                            {trade.openedAt && trade.closedAt
                              ? `${Math.round((new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 1000 / 60)}m`
                              : '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-4">
                          {trade.openedAt && (
                            <span>Opened: {new Date(trade.openedAt).toLocaleString()}</span>
                          )}
                          {trade.closedAt && (
                            <span>Closed: {new Date(trade.closedAt).toLocaleString()}</span>
                          )}
                        </div>
                        {connectedBroker === 'deriv' && (trade as any).brokerTradeId && (
                          <span className="text-purple-400">
                            Contract: {(trade as any).brokerTradeId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {closedTrades.length > 10 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showAll ? 'Show Less' : `Show All (${closedTrades.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


