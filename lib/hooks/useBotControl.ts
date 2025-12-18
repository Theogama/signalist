/**
 * Hook for controlling bot (start/stop/status)
 */

import { useState, useEffect, useCallback } from 'react';

export interface BotStatus {
  userId: string;
  isRunning: boolean;
  isPaused: boolean;
  broker: 'exness' | 'deriv';
  instrument: string;
  startedAt?: Date;
  stoppedAt?: Date;
  lastCandleProcessed?: Date;
  lastTradeTimestamp?: Date;
  dailyStats: {
    tradesCount: number;
    wins: number;
    losses: number;
    totalPnl: number;
    startingBalance: number;
    currentBalance: number;
    drawdown: number;
    drawdownPercent: number;
  };
  consecutiveLosses: number;
  stopReason?: string;
  error?: string;
}

export function useBotControl() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/bot/status');
      const data = await response.json();

      if (data.success) {
        setStatus(data.status);
        return data.status;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bot status');
      return null;
    }
  }, []);

  const startBot = useCallback(async (broker: string, instrument: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, instrument }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchStatus();
        return { success: true };
      } else {
        throw new Error(data.error || 'Failed to start bot');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start bot');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const stopBot = useCallback(async (reason?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/bot/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Manual stop' }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchStatus();
        return { success: true };
      } else {
        throw new Error(data.error || 'Failed to stop bot');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop bot');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    fetchStatus,
    startBot,
    stopBot,
  };
}






