/**
 * Hook for Deriv WebSocket connection
 * Provides real-time price updates for Deriv instruments
 */

import { useEffect, useState, useRef } from 'react';
import { derivWebSocketService, DerivTickData } from '@/lib/services/deriv-websocket.service';

export function useDerivWebSocket(symbol?: string) {
  const [tickData, setTickData] = useState<DerivTickData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let statusInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Connect to WebSocket
    derivWebSocketService
      .connect()
      .then(() => {
        if (!isMounted) return;
        setIsConnected(true);
        
        // Subscribe to symbol if provided
        if (symbol) {
          const subscription = derivWebSocketService.subscribe(symbol, (data) => {
            if (isMounted) {
              setTickData(data);
            }
          });
          subscriptionRef.current = subscription;
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('[useDerivWebSocket] Connection error:', error);
          setIsConnected(false);
        }
      });

    // Check connection status periodically (only update if changed)
    statusInterval = setInterval(() => {
      if (isMounted) {
        const connected = derivWebSocketService.isConnected();
        setIsConnected((prev) => {
          // Only update if state actually changed
          return prev !== connected ? connected : prev;
        });
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [symbol]);

  return {
    tickData,
    isConnected,
  };
}

