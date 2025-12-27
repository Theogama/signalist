/**
 * useDerivMarketData Hook
 * 
 * React hook for consuming real-time Deriv market data streams.
 * Uses Server-Sent Events (SSE) for real-time updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface TickData {
  symbol: string;
  quote: number;
  timestamp: number;
  id?: string;
}

export interface OHLCData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  epoch: number;
  granularity: number;
}

export interface UseDerivMarketDataOptions {
  symbol: string;
  type?: 'ticks' | 'ohlc';
  granularity?: number;
  enabled?: boolean;
  onTick?: (data: TickData) => void;
  onOHLC?: (data: OHLCData) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseDerivMarketDataReturn {
  tick: TickData | null;
  ohlc: OHLCData | null;
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Hook for consuming Deriv market data streams
 */
export function useDerivMarketData(
  options: UseDerivMarketDataOptions
): UseDerivMarketDataReturn {
  const {
    symbol,
    type = 'ticks',
    granularity = 60,
    enabled = true,
    onTick,
    onOHLC,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [tick, setTick] = useState<TickData | null>(null);
  const [ohlc, setOHLC] = useState<OHLCData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    if (onDisconnect) {
      onDisconnect();
    }
  }, [onDisconnect]);

  const connect = useCallback(() => {
    if (!enabled || !symbol) {
      return;
    }

    // Close existing connection
    disconnect();

    try {
      const params = new URLSearchParams({
        symbol,
        type,
        ...(type === 'ohlc' && { granularity: granularity.toString() }),
      });

      const eventSource = new EventSource(
        `/api/deriv/market-data/stream?${params.toString()}`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        if (onConnect) {
          onConnect();
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            setIsConnected(true);
            if (onConnect) {
              onConnect();
            }
          } else if (data.type === 'tick' && data.data) {
            const tickData: TickData = data.data;
            setTick(tickData);
            if (onTick) {
              onTick(tickData);
            }
          } else if (data.type === 'ohlc' && data.data) {
            const ohlcData: OHLCData = data.data;
            setOHLC(ohlcData);
            if (onOHLC) {
              onOHLC(ohlcData);
            }
          } else if (data.type === 'heartbeat') {
            // Heartbeat received, connection is alive
            setIsConnected(true);
          }
        } catch (err: any) {
          console.error('[useDerivMarketData] Error parsing message:', err);
          const error = new Error(`Failed to parse message: ${err.message}`);
          setError(error);
          if (onError) {
            onError(error);
          }
        }
      };

      eventSource.onerror = (err) => {
        console.error('[useDerivMarketData] EventSource error:', err);
        setIsConnected(false);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          const error = new Error('Max reconnection attempts reached');
          setError(error);
          if (onError) {
            onError(error);
          }
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err: any) {
      const error = new Error(`Failed to connect: ${err.message}`);
      setError(error);
      setIsConnected(false);
      if (onError) {
        onError(error);
      }
    }
  }, [symbol, type, granularity, enabled, onTick, onOHLC, onError, onConnect, disconnect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled && symbol) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [symbol, type, granularity, enabled, connect, disconnect]);

  return {
    tick,
    ohlc,
    isConnected,
    error,
    reconnect,
    disconnect,
  };
}


