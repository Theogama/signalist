'use client';

/**
 * Open Trades Component
 * Displays currently active positions with live P/L
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';

export default function OpenTrades() {
  const { openTrades, connectedBroker } = useAutoTradingStore();
  const [isLoading, setIsLoading] = useState(false);

  const fetchOpenTrades = async () => {
    if (!connectedBroker) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/auto-trading/positions');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.openTrades) {
          // Trades are already in store via syncTrades
        }
      }
    } catch (error) {
      console.error('Error fetching open trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenTrades();
    const interval = setInterval(fetchOpenTrades, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [connectedBroker]);

  // Calculate unrealized P/L for each trade
  const tradesWithPL = openTrades.map(trade => {
    const currentPrice = trade.exitPrice || trade.entryPrice;
    let unrealizedPnl = 0;
    
    if (trade.side === 'BUY') {
      unrealizedPnl = (currentPrice - trade.entryPrice) * trade.quantity;
    } else {
      unrealizedPnl = (trade.entryPrice - currentPrice) * trade.quantity;
    }

    return {
      ...trade,
      currentPrice,
      unrealizedPnl,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Open Trades
          </div>
          <button
            onClick={fetchOpenTrades}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Refresh trades"
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </CardTitle>
        <CardDescription>Currently active positions ({openTrades.length})</CardDescription>
      </CardHeader>
      <CardContent>
        {openTrades.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No open positions</p>
            <p className="text-xs mt-1">Open trades will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tradesWithPL.map((trade) => (
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
                      <Badge variant="outline" className="border-blue-500 text-blue-400">
                        {trade.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs">Entry Price</div>
                        <div className="text-gray-100 font-semibold">
                          ${trade.entryPrice.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Current Price</div>
                        <div className="text-gray-100 font-semibold">
                          ${trade.currentPrice.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Quantity</div>
                        <div className="text-gray-100 font-semibold">
                          {trade.quantity}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Unrealized P/L</div>
                        <div className={`font-semibold flex items-center gap-1 ${
                          trade.unrealizedPnl > 0 ? 'text-green-400' :
                          trade.unrealizedPnl < 0 ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {trade.unrealizedPnl > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : trade.unrealizedPnl < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          ${trade.unrealizedPnl.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      Opened: {new Date(trade.openedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

