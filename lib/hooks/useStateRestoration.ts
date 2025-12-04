/**
 * State Restoration Hook
 * Restores bot and broker connection state after page refresh
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { toast } from 'sonner';

export function useStateRestoration() {
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);
  const {
    connectedBroker,
    botStatus,
    setBalance,
    connectBrokerDemo,
    addLog,
  } = useAutoTradingStore();

  useEffect(() => {
    // Only run in browser (not SSR)
    if (typeof window === 'undefined') {
      setIsRestoring(false);
      return;
    }

    const restoreState = async () => {
      try {
        setIsRestoring(true);

        // Check server for active bots and connections
        let response;
        try {
          response = await fetch('/api/auto-trading/status', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (fetchError: any) {
          console.warn('Failed to fetch status (network error):', fetchError?.message || fetchError);
          setIsRestoring(false);
          return;
        }
        
        if (!response || !response.ok) {
          console.warn('Status check failed:', response?.status || 'No response');
          setIsRestoring(false);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (parseError: any) {
          console.warn('Failed to parse status response:', parseError?.message || parseError);
          setIsRestoring(false);
          return;
        }

        if (!data || !data.success) {
          console.warn('Status check failed:', data?.error || 'Unknown error');
          setIsRestoring(false);
          return;
        }

        const { activeBots, connectedBrokers } = data.data;

        // IMPORTANT: Only restore broker connection if there's an ACTIVE BOT running
        // This prevents auto-connecting when user hasn't explicitly started a bot
        // We don't auto-connect just because there's a session on the server
        
        // Check if there's a persisted broker connection but no active bot
        // If so, clear it to prevent showing as "connected" when not actually connected
        if (connectedBroker && (!activeBots || activeBots.length === 0)) {
          // There's a persisted connection but no active bot
          // This means the user disconnected or the bot stopped
          // We should clear the connection state to reflect reality
          const { disconnectBroker } = useAutoTradingStore.getState();
          disconnectBroker();
          addLog({
            level: 'info',
            message: 'Cleared stale broker connection (no active bot)',
          });
        }

        // Only restore broker connection if:
        // 1. There's an active bot running (user explicitly started it)
        // 2. There's a connected broker from the server
        // 3. The local state doesn't already have a broker connected
        // This prevents auto-connecting when user hasn't explicitly connected
        if (activeBots && activeBots.length > 0 && connectedBrokers && connectedBrokers.length > 0) {
          const primaryBroker = connectedBrokers[0];
          const activeBot = activeBots[0];
          
          // Only restore if:
          // - No broker is currently connected in local state, AND
          // - The active bot's broker matches the connected broker
          if (!connectedBroker && activeBot.broker === primaryBroker.broker) {
            try {
              // Reconnect to broker (demo mode)
              await connectBrokerDemo(primaryBroker.broker);
              
              // Fetch account balance
              const accountResponse = await fetch(`/api/auto-trading/account?broker=${primaryBroker.broker}`);
              if (accountResponse.ok) {
                const accountData = await accountResponse.json();
                if (accountData.success && accountData.data) {
                  setBalance(
                    accountData.data.balance || 10000,
                    accountData.data.equity || 10000,
                    accountData.data.margin || 0
                  );
                }
              }

              addLog({
                level: 'success',
                message: `Broker connection restored: ${primaryBroker.broker.toUpperCase()} (bot is running)`,
              });
            } catch (error: any) {
              console.error('Failed to restore broker connection:', error);
              addLog({
                level: 'warning',
                message: `Failed to restore broker connection: ${error.message}`,
              });
            }
          }
        }

        // Restore bot status if active bots exist
        if (activeBots && activeBots.length > 0) {
          const activeBot = activeBots[0];
          
          if (botStatus !== 'running') {
            addLog({
              level: 'info',
              message: `Active bot detected: ${activeBot.botId} on ${activeBot.instrument}. Bot is running on server.`,
            });
            
            // Note: We don't automatically restart the bot here because:
            // 1. The bot is already running on the server
            // 2. We just need to sync the UI state
            // The bot will continue running even if the page is refreshed
          }
        }

        // Sync trades if bot is running
        if (activeBots && activeBots.length > 0) {
          try {
            const tradesResponse = await fetch('/api/auto-trading/positions');
            if (tradesResponse.ok) {
              const tradesData = await tradesResponse.json();
              if (tradesData.success && tradesData.data) {
                const { syncTrades } = useAutoTradingStore.getState();
                syncTrades(
                  tradesData.data.openPositions || [],
                  tradesData.data.closedPositions || []
                );
              }
            }
          } catch (error) {
            console.error('Failed to sync trades:', error);
          }
        }

      } catch (error: any) {
        console.error('State restoration error:', error);
        // Don't show error toast - just log it
        // The app can still function without restoration
      } finally {
        setIsRestoring(false);
      }
    };

    // Only restore once on mount, and only if we haven't checked yet
    if (!hasChecked) {
      setHasChecked(true);
      restoreState();
    }
  }, [hasChecked]); // Only run once

  return { isRestoring };
}

