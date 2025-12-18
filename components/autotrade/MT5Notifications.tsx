'use client';

/**
 * MT5 Notifications Component
 * Displays real-time trade notifications
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

export default function MT5Notifications() {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  // Setup SSE connection
  useEffect(() => {
    if (!connectionId) return;

    const eventSource = new EventSource(
      `/api/mt5/notifications?connection_id=${connectionId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'trades_update') {
          // Handle trade updates
          const positions = data.data || [];
          // You can add logic here to detect new trades and show notifications
        } else if (data.type === 'trade_opened') {
          toast.success('New trade opened', {
            description: `${data.symbol} ${data.type} at ${data.price}`,
          });
        } else if (data.type === 'trade_closed') {
          const isProfit = data.profit > 0;
          toast[isProfit ? 'success' : 'error'](
            `Trade closed ${isProfit ? 'in profit' : 'in loss'}`,
            {
              description: `${data.symbol} - P/L: ${data.profit.toFixed(2)}`,
            }
          );
        } else if (data.type === 'bot_stopped') {
          toast.warning('Bot stopped', {
            description: data.reason || 'Auto-trading has been stopped',
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [connectionId]);

  return null; // This component only handles notifications, no UI
}






