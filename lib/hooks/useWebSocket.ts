/**
 * WebSocket Hook
 * Manages Server-Sent Events (SSE) connection for live trading updates
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { throttle } from '@/lib/utils/debounce';

export function useWebSocket() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasConnectedRef = useRef(false);
  const updateQueueRef = useRef<Array<() => void>>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Batch state updates to prevent excessive re-renders
  const batchUpdate = useCallback(() => {
    if (updateQueueRef.current.length === 0) return;
    
    const updates = [...updateQueueRef.current];
    updateQueueRef.current = [];
    
    // Process all queued updates
    updates.forEach(update => update());
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  // Throttled balance update (reduced throttle for better UI responsiveness)
  const throttledSetBalance = useCallback(
    throttle((balance: number, equity: number, margin: number) => {
      setBalance(balance, equity, margin);
    }, 500), // Reduced from 1000ms to 500ms for better responsiveness
    [setBalance]
  );

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
                throttledSetBalance(data.data.balance, data.data.equity, data.data.margin);
              }
              break;
            case 'open_trades':
              // Process trade updates immediately (reduced batching delay)
              if (data.data && Array.isArray(data.data)) {
                const { openTrades: currentOpen } = useAutoTradingStore.getState();
                const newTradeIds = new Set(data.data.map((t: any) => t.id));
                
                // Add or update open trades immediately
                data.data.forEach((trade: any) => {
                  const existing = currentOpen.find(t => t.id === trade.id);
                  if (existing) {
                    updateTrade(trade.id, {
                      entryPrice: trade.entryPrice,
                      quantity: trade.quantity,
                      profitLoss: trade.profitLoss !== undefined ? trade.profitLoss : trade.currentPnl,
                      exitPrice: trade.exitPrice,
                    });
                  } else {
                    addTrade({
                      id: trade.id,
                      symbol: trade.symbol,
                      side: trade.side || 'BUY',
                      entryPrice: trade.entryPrice,
                      quantity: trade.quantity,
                      profitLoss: trade.profitLoss !== undefined ? trade.profitLoss : trade.currentPnl,
                      status: 'OPEN',
                      openedAt: trade.openedAt ? new Date(trade.openedAt) : new Date(),
                    });
                  }
                });
              }
              break;
            case 'closed_trades':
              // Update closed trades - ensure they're properly moved to closedTrades array
              if (data.data && Array.isArray(data.data)) {
                data.data.forEach((trade: any) => {
                  // Ensure trade has all required fields for closed trade
                  const closedTrade = {
                    ...trade,
                    status: (trade.status === 'OPEN' ? 'CLOSED' : trade.status) as 'CLOSED' | 'STOPPED',
                    profitLoss: trade.profitLoss !== undefined ? trade.profitLoss : 
                               (trade.exitPrice && trade.entryPrice ? 
                                 (trade.side === 'BUY' ? 
                                   (trade.exitPrice - trade.entryPrice) * trade.quantity :
                                   (trade.entryPrice - trade.exitPrice) * trade.quantity) : 0),
                    closedAt: trade.closedAt ? new Date(trade.closedAt) : new Date(),
                  };
                  updateTrade(trade.id, closedTrade);
                });
              }
              break;
            case 'trade_closed':
              // Immediate notification when a trade closes
              if (data.data) {
                const trade = data.data;
                // Ensure profitLoss is calculated if missing
                const profitLoss = trade.profitLoss !== undefined ? trade.profitLoss :
                                 (trade.exitPrice && trade.entryPrice && trade.quantity) ?
                                 (trade.side === 'BUY' ? 
                                   (trade.exitPrice - trade.entryPrice) * trade.quantity :
                                   (trade.entryPrice - trade.exitPrice) * trade.quantity) : 0;
                
                updateTrade(trade.id, {
                  ...trade,
                  status: trade.status || 'CLOSED',
                  profitLoss,
                  exitPrice: trade.exitPrice,
                  closedAt: trade.closedAt ? new Date(trade.closedAt) : new Date(),
                });
              }
              break;
            case 'trade_opened':
              // Immediate notification when a trade opens
              if (data.data) {
                const trade = data.data;
                addTrade({
                  id: trade.id || trade.tradeId,
                  symbol: trade.symbol,
                  side: trade.side || 'BUY',
                  entryPrice: trade.entryPrice || trade.price,
                  quantity: trade.quantity || trade.volume,
                  status: 'OPEN',
                  openedAt: trade.openedAt ? new Date(trade.openedAt) : new Date(),
                });
              }
              break;
            case 'position_update':
              // Position P/L update (process immediately for real-time feel)
              if (data.data) {
                const update = data.data;
                // Update immediately without batching for real-time P/L
                updateTrade(update.id || update.tradeId, {
                  profitLoss: update.profitLoss !== undefined ? update.profitLoss : update.currentPnl,
                  exitPrice: update.currentPrice,
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

    // Cleanup batch timeout on unmount
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };

    // Only depend on botStatus to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botStatus, batchUpdate, throttledSetBalance]);

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



