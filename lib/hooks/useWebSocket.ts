/**
 * WebSocket Hook
 * Manages Server-Sent Events (SSE) connection for live trading updates
 */

import { useEffect, useRef } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

export function useWebSocket() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasConnectedRef = useRef(false);
  const {
    botStatus,
    wsConnected,
    addLog,
    addTrade,
    updateTrade,
    setBalance,
    connectWebSocket,
    disconnectWebSocket,
  } = useAutoTradingStore();

  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (hasConnectedRef.current) {
        disconnectWebSocket();
        hasConnectedRef.current = false;
      }
    };

    // Only connect if bot is running and we haven't connected yet
    if (botStatus === 'running' && !hasConnectedRef.current) {
      connectWebSocket();
      hasConnectedRef.current = true;
      
      // Connect to Server-Sent Events endpoint
      const eventSource = new EventSource('/api/auto-trading/live-updates');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        addLog({
          level: 'success',
          message: 'Live updates connected',
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              addLog({
                level: 'success',
                message: data.message || 'Connected to live updates',
              });
              break;
            case 'balance':
              if (data.data) {
                setBalance(data.data.balance, data.data.equity, data.data.margin);
              }
              break;
            case 'open_trades':
              // Update open trades
              if (data.data && Array.isArray(data.data)) {
                const { openTrades: currentOpen } = useAutoTradingStore.getState();
                const newTradeIds = new Set(data.data.map((t: any) => t.id));
                
                // Remove trades that are no longer open (moved to closed)
                currentOpen.forEach(trade => {
                  if (!newTradeIds.has(trade.id)) {
                    // Trade was closed, will be handled by closed_trades event
                  }
                });
                
                // Add or update open trades
                data.data.forEach((trade: any) => {
                  const existing = currentOpen.find(t => t.id === trade.id);
                  if (existing) {
                    // Update existing trade
                    updateTrade(trade.id, {
                      entryPrice: trade.entryPrice,
                      quantity: trade.quantity,
                    });
                  } else {
                    // Add new trade
                    addTrade({
                      id: trade.id,
                      symbol: trade.symbol,
                      side: trade.side || 'BUY',
                      entryPrice: trade.entryPrice,
                      quantity: trade.quantity,
                      status: 'OPEN',
                      openedAt: trade.openedAt ? new Date(trade.openedAt) : new Date(),
                    });
                  }
                });
              }
              break;
            case 'closed_trades':
              // Update closed trades
              if (data.data && Array.isArray(data.data)) {
                data.data.forEach((trade: any) => {
                  updateTrade(trade.id, { ...trade, status: 'CLOSED' });
                });
              }
              break;
            case 'trade':
              addTrade(data.data);
              break;
            case 'trade_update':
              updateTrade(data.data.id, data.data.updates);
              break;
            default:
              console.log('Unknown update type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        addLog({
          level: 'error',
          message: 'Live updates connection error',
        });
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (useAutoTradingStore.getState().botStatus === 'running') {
            cleanup();
            hasConnectedRef.current = false;
            // Will reconnect on next render
          }
        }, 5000);
      };

      return cleanup;
    }

    // Disconnect when bot stops
    if (botStatus !== 'running' && hasConnectedRef.current) {
      cleanup();
    }

    // Only depend on botStatus to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botStatus]);

  // WebSocket message handler (for future implementation)
  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'log':
          addLog(data.payload);
          break;
        case 'trade':
          addTrade(data.payload);
          break;
        case 'trade_update':
          updateTrade(data.payload.id, data.payload.updates);
          break;
        case 'balance':
          setBalance(data.payload.balance, data.payload.equity, data.payload.margin);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  return { wsConnected };
}



