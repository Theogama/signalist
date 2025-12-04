/**
 * Hook for subscribing to bot events via Server-Sent Events
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export type BotEventType =
  | 'trade_opened'
  | 'trade_closed'
  | 'signal_detected'
  | 'stop_triggered'
  | 'error'
  | 'status_update'
  | 'candle_processed'
  | 'connected';

export interface BotEvent {
  type: BotEventType;
  data?: any;
  status?: any;
  reason?: string;
  error?: string;
  candle?: any;
  timestamp: string;
}

export function useBotEvents() {
  const [events, setEvents] = useState<BotEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<BotEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return; // Already connected
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/bot/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useBotEvents] Connected to bot events stream');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: BotEvent = JSON.parse(event.data);
          setLastEvent(data);
          setEvents((prev) => {
            const newEvents = [...prev, data];
            // Keep only last 100 events
            return newEvents.slice(-100);
          });
        } catch (error) {
          console.error('[useBotEvents] Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[useBotEvents] EventSource error:', error);
        setIsConnected(false);
        eventSource.close();

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[useBotEvents] Failed to create EventSource:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return {
    events,
    lastEvent,
    isConnected,
    connect,
    disconnect,
    clearEvents,
  };
}


