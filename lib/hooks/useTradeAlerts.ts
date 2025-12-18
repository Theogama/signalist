/**
 * Enhanced Trade Alerts Hook
 * Provides comprehensive position alerts for all bot trades
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Trade } from '@/lib/stores/autoTradingStore';

interface PositionSnapshot {
  id: string;
  profitLoss: number;
  timestamp: number;
}

export function useTradeAlerts() {
  const { openTrades, closedTrades, connectedBroker } = useAutoTradingStore();
  const processedTradeIdsRef = useRef<Set<string>>(new Set());
  const lastClosedTradeIdsRef = useRef<Set<string>>(new Set());
  const positionSnapshotsRef = useRef<Map<string, PositionSnapshot>>(new Map());
  const notificationPermissionRef = useRef<NotificationPermission | null>(null);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = (title: string, options: NotificationOptions) => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      notificationPermissionRef.current === 'granted'
    ) {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  };

  // Play sound notification (optional)
  const playSound = (type: 'success' | 'error' | 'info' = 'info') => {
    // You can add sound files and play them here
    // For now, we'll use a simple beep pattern
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different types
      oscillator.frequency.value = type === 'success' ? 800 : type === 'error' ? 400 : 600;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silently fail if audio context is not available
    }
  };

  // Alert for newly opened trades
  useEffect(() => {
    const currentOpenIds = new Set(openTrades.map((t) => t.id));
    const newTrades = openTrades.filter(
      (trade) => !processedTradeIdsRef.current.has(trade.id) && trade.status === 'OPEN'
    );

    newTrades.forEach((trade) => {
      processedTradeIdsRef.current.add(trade.id);

      const sideEmoji = trade.side === 'BUY' ? '📈' : '📉';
      const sideText = trade.side === 'BUY' ? 'LONG' : 'SHORT';

      toast.success(`🎯 New Position Opened`, {
        description: `${sideEmoji} ${trade.symbol} ${sideText} @ $${trade.entryPrice.toFixed(2)} | Qty: ${trade.quantity}`,
        duration: 5000,
        action: {
          label: 'View',
          onClick: () => {
            // Scroll to trades table or open trade details
            const tradesSection = document.getElementById('open-trades');
            if (tradesSection) {
              tradesSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
        },
      });

      // Browser notification
      showBrowserNotification(`New ${trade.symbol} Position`, {
        body: `${sideText} position opened at $${trade.entryPrice.toFixed(2)}`,
        tag: `trade-opened-${trade.id}`,
      });

      // Sound notification
      playSound('info');
    });
  }, [openTrades]);

  // Alert for closed trades (wins/losses)
  useEffect(() => {
    const currentClosedIds = new Set(closedTrades.map((t) => t.id));
    const newClosedTrades = closedTrades.filter(
      (trade) =>
        !lastClosedTradeIdsRef.current.has(trade.id) &&
        trade.profitLoss !== undefined &&
        trade.status !== 'OPEN'
    );

    newClosedTrades.forEach((trade) => {
      lastClosedTradeIdsRef.current.add(trade.id);

      const profitLoss = trade.profitLoss || 0;
      const isWin = profitLoss > 0;
      const isLoss = profitLoss < 0;
      const isBreakEven = profitLoss === 0;

      // Determine close reason
      let closeReason = 'Closed';
      let closeEmoji = '➖';
      if (trade.status === 'TP_HIT' || trade.status === 'TAKE_PROFIT') {
        closeReason = 'Take Profit Hit';
        closeEmoji = '🎯';
      } else if (trade.status === 'SL_HIT' || trade.status === 'STOP_LOSS') {
        closeReason = 'Stop Loss Hit';
        closeEmoji = '🛑';
      } else if (isWin) {
        closeReason = 'Profit';
        closeEmoji = '💰';
      } else if (isLoss) {
        closeReason = 'Loss';
        closeEmoji = '❌';
      }

      if (isWin) {
        toast.success(`${closeEmoji} Trade Won! +$${profitLoss.toFixed(2)}`, {
          description: `${trade.symbol} ${trade.side} | ${closeReason} | Entry: $${trade.entryPrice?.toFixed(2) || 'N/A'} → Exit: $${trade.exitPrice?.toFixed(2) || 'N/A'}`,
          duration: 6000,
          action: {
            label: 'Details',
            onClick: () => {
              const closedSection = document.getElementById('closed-trades');
              if (closedSection) {
                closedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            },
          },
        });
        playSound('success');
        showBrowserNotification(`💰 Trade Won: ${trade.symbol}`, {
          body: `Profit: +$${profitLoss.toFixed(2)} | ${closeReason}`,
          tag: `trade-won-${trade.id}`,
        });
      } else if (isLoss) {
        toast.error(`${closeEmoji} Trade Lost! $${profitLoss.toFixed(2)}`, {
          description: `${trade.symbol} ${trade.side} | ${closeReason} | Entry: $${trade.entryPrice?.toFixed(2) || 'N/A'} → Exit: $${trade.exitPrice?.toFixed(2) || 'N/A'}`,
          duration: 6000,
          action: {
            label: 'Details',
            onClick: () => {
              const closedSection = document.getElementById('closed-trades');
              if (closedSection) {
                closedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            },
          },
        });
        playSound('error');
        showBrowserNotification(`❌ Trade Lost: ${trade.symbol}`, {
          body: `Loss: $${profitLoss.toFixed(2)} | ${closeReason}`,
          tag: `trade-lost-${trade.id}`,
        });
      } else if (isBreakEven) {
        toast.info(`➖ Trade Closed at Break-Even`, {
          description: `${trade.symbol} ${trade.side} | No profit/loss`,
          duration: 4000,
        });
        showBrowserNotification(`➖ Break-Even: ${trade.symbol}`, {
          body: `Trade closed with no profit/loss`,
          tag: `trade-breakeven-${trade.id}`,
        });
      }
    });

    lastClosedTradeIdsRef.current = currentClosedIds;
  }, [closedTrades]);

  // Alert for significant position P/L changes
  useEffect(() => {
    openTrades.forEach((trade) => {
      const currentPL = trade.profitLoss || 0;
      const snapshot = positionSnapshotsRef.current.get(trade.id);

      if (snapshot) {
        const plChange = currentPL - snapshot.profitLoss;
        const plChangePercent = snapshot.profitLoss !== 0 
          ? (plChange / Math.abs(snapshot.profitLoss)) * 100 
          : 0;

        // Alert on significant P/L changes (more than 10% or $50)
        const significantChange = Math.abs(plChange) > 50 || Math.abs(plChangePercent) > 10;
        const timeSinceLastAlert = Date.now() - snapshot.timestamp;

        // Only alert if significant change and at least 30 seconds since last alert
        if (significantChange && timeSinceLastAlert > 30000) {
          const isPositive = plChange > 0;
          const emoji = isPositive ? '📊' : '📉';
          const color = isPositive ? 'success' : 'warning';

          toast[color](
            `${emoji} Position Update: ${trade.symbol}`,
            {
              description: `P/L: $${currentPL.toFixed(2)} (${isPositive ? '+' : ''}$${plChange.toFixed(2)}) | ${trade.side}`,
              duration: 4000,
            }
          );

          // Update snapshot
          positionSnapshotsRef.current.set(trade.id, {
            id: trade.id,
            profitLoss: currentPL,
            timestamp: Date.now(),
          });
        }
      } else {
        // First snapshot for this position
        positionSnapshotsRef.current.set(trade.id, {
          id: trade.id,
          profitLoss: currentPL,
          timestamp: Date.now(),
        });
      }
    });

    // Clean up snapshots for closed positions
    const openTradeIds = new Set(openTrades.map((t) => t.id));
    positionSnapshotsRef.current.forEach((snapshot, tradeId) => {
      if (!openTradeIds.has(tradeId)) {
        positionSnapshotsRef.current.delete(tradeId);
      }
    });
  }, [openTrades]);

  // Alert for TP/SL hits from logs
  const liveLogs = useAutoTradingStore((state) => state.liveLogs);
  
  useEffect(() => {
    liveLogs.forEach((log) => {
      const logId = `log-${log.id}`;
      if (processedTradeIdsRef.current.has(logId)) return;

      const message = log.message.toLowerCase();
      
      // Detect TP/SL hits
      if (message.includes('take profit') || message.includes('tp hit')) {
        processedTradeIdsRef.current.add(logId);
        toast.success('🎯 Take Profit Hit!', {
          description: log.message,
          duration: 5000,
        });
        playSound('success');
      } else if (message.includes('stop loss') || message.includes('sl hit')) {
        processedTradeIdsRef.current.add(logId);
        toast.error('🛑 Stop Loss Hit!', {
          description: log.message,
          duration: 5000,
        });
        playSound('error');
      }
    });
  }, [liveLogs]);

  return {
    showBrowserNotification,
    playSound,
  };
}

