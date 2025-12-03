'use client';

/**
 * MT5 Open Trades Component
 * Displays all open positions with live P/L updates
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, X, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface OpenPosition {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  commission: number;
  sl: number;
  tp: number;
  magic: number;
  comment: string;
  time: number;
  time_update: number;
}

export default function MT5OpenTrades() {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
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

  // Fetch open positions
  const fetchPositions = async () => {
    if (!connectionId) return;

    try {
      const response = await fetch(`/api/mt5/trades/open?connection_id=${connectionId}`);
      const data = await response.json();

      if (data.success) {
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Error fetching open positions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (connectionId) {
      fetchPositions();
      const interval = setInterval(fetchPositions, 1000); // Update every 1 second
      return () => clearInterval(interval);
    }
  }, [connectionId]);

  const handleClosePosition = async (ticket: number) => {
    if (!connectionId) return;

    try {
      const response = await fetch('/api/mt5/position/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: connectionId,
          ticket,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Position closed successfully');
        fetchPositions();
      } else {
        toast.error(data.error || 'Failed to close position');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to close position');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getDuration = (openedAt: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - openedAt;
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (!connectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Trades</CardTitle>
          <CardDescription>Connect to MT5 to view open positions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          Open Trades ({positions.length})
        </CardTitle>
        <CardDescription>Live positions with real-time P/L updates</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No open positions</div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos) => (
              <div
                key={pos.ticket}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {pos.type === 'BUY' ? (
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-100">{pos.symbol}</p>
                      <p className="text-xs text-gray-400">
                        {pos.type} • {pos.volume} lots • Ticket: {pos.ticket}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleClosePosition(pos.ticket)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Entry Price</p>
                    <p className="font-semibold text-gray-100">{pos.price_open.toFixed(5)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Current Price</p>
                    <p className="font-semibold text-gray-100">{pos.price_current.toFixed(5)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">P/L</p>
                    <p className={`font-bold ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Duration</p>
                    <p className="font-semibold text-gray-100">{getDuration(pos.time)}</p>
                  </div>
                </div>

                {(pos.sl > 0 || pos.tp > 0) && (
                  <div className="flex gap-4 text-xs text-gray-400 pt-2 border-t border-gray-700">
                    {pos.sl > 0 && <span>SL: {pos.sl.toFixed(5)}</span>}
                    {pos.tp > 0 && <span>TP: {pos.tp.toFixed(5)}</span>}
                  </div>
                )}

                {pos.comment && (
                  <p className="text-xs text-gray-500 pt-1">{pos.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

