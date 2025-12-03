'use client';

/**
 * MT5 Closed Trades Component
 * Displays closed positions with profit/loss
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface ClosedDeal {
  ticket: number;
  order: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  time: number;
  comment: string;
}

export default function MT5ClosedTrades() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<ClosedDeal[]>([]);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Load connection ID
  useEffect(() => {
    const stored = localStorage.getItem('mt5_connection');
    if (stored) {
      try {
        const conn = JSON.parse(stored);
        setConnectionId(conn.connection_id);
      } catch (err) {
        console.error('Error loading connection:', err);
      }
    }
  }, []);

  // Fetch closed trades
  const fetchClosedTrades = async () => {
    if (!connectionId) return;

    try {
      const response = await fetch(`/api/mt5/trades/closed?connection_id=${connectionId}`);
      const data = await response.json();

      if (data.success) {
        // Sort by time (newest first) and limit to 50
        const sorted = (data.deals || [])
          .sort((a: ClosedDeal, b: ClosedDeal) => b.time - a.time)
          .slice(0, 50);
        setDeals(sorted);
      }
    } catch (error) {
      console.error('Error fetching closed trades:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling (every 3 seconds)
  useEffect(() => {
    if (connectionId) {
      fetchClosedTrades();
      const interval = setInterval(fetchClosedTrades, 3000);
      return () => clearInterval(interval);
    }
  }, [connectionId]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (!connectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Closed Trades</CardTitle>
          <CardDescription>Connect to MT5 to view closed positions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-400" />
          Closed Trades ({deals.length})
        </CardTitle>
        <CardDescription>Recent closed positions with profit/loss</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : deals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No closed trades</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {deals.map((deal) => (
              <div
                key={deal.ticket}
                className="p-3 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {deal.type === 'BUY' ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-100 text-sm">{deal.symbol}</p>
                      <p className="text-xs text-gray-400">
                        {deal.type} • {deal.volume} lots
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${deal.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {deal.profit >= 0 ? '+' : ''}{deal.profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">{formatTime(deal.time)}</p>
                  </div>
                </div>
                {deal.comment && (
                  <p className="text-xs text-gray-500 mt-1">{deal.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

