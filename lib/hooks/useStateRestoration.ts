/**
 * State Restoration Hook
 * Restores bot and broker connection state after page refresh
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { toast } from 'sonner';

export function useStateRestoration() {
  const [isRestoring, setIsRestoring] = useState(true);
  const {
    connectedBroker,
    botStatus,
    setBalance,
    connectBrokerDemo,
    addLog,
  } = useAutoTradingStore();

  useEffect(() => {
    const restoreState = async () => {
      try {
        setIsRestoring(true);

        // Check server for active bots and connections
        const response = await fetch('/api/auto-trading/status');
        
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await response.json();

        if (!data.success) {
          console.warn('Status check failed:', data.error);
          setIsRestoring(false);
          return;
        }

        const { activeBots, connectedBrokers } = data.data;

        // Restore broker connection if exists
        if (connectedBrokers && connectedBrokers.length > 0) {
          const primaryBroker = connectedBrokers[0];
          
          if (!connectedBroker) {
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
                message: `Broker connection restored: ${primaryBroker.broker.toUpperCase()}`,
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

    // Only restore once on mount
    restoreState();
  }, []); // Empty deps - only run once

  return { isRestoring };
}

