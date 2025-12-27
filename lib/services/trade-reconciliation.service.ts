/**
 * Trade Reconciliation Service
 * Verifies open trades against Deriv API and closes stale trades
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';
import { decrypt } from '@/lib/utils/encryption';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';
import { tradeLoggingService } from './trade-logging.service';

export interface ReconciliationResult {
  userId: string;
  checked: number;
  closed: number;
  errors: number;
  details: {
    tradeId: string;
    brokerTradeId: string;
    action: 'closed' | 'verified' | 'error';
    error?: string;
  }[];
}

export interface ReconciliationStats {
  totalUsers: number;
  totalTradesChecked: number;
  totalTradesClosed: number;
  totalErrors: number;
  results: ReconciliationResult[];
}

class TradeReconciliationService {
  private reconciliationInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private reconciliationIntervalMs: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Start periodic reconciliation
   * 
   * @param intervalMs - Interval between reconciliations (default: 5 minutes)
   */
  start(intervalMs: number = 5 * 60 * 1000): void {
    if (this.isRunning) {
      console.warn('[TradeReconciliation] Reconciliation already running');
      return;
    }

    this.reconciliationIntervalMs = intervalMs;
    this.isRunning = true;

    // Run immediately
    this.reconcileAll().catch((error) => {
      console.error('[TradeReconciliation] Error in initial reconciliation:', error);
    });

    // Then run periodically
    this.reconciliationInterval = setInterval(() => {
      this.reconcileAll().catch((error) => {
        console.error('[TradeReconciliation] Error in periodic reconciliation:', error);
      });
    }, this.reconciliationIntervalMs);

    console.log(`[TradeReconciliation] Started periodic reconciliation (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic reconciliation
   */
  stop(): void {
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }
    this.isRunning = false;
    console.log('[TradeReconciliation] Stopped periodic reconciliation');
  }

  /**
   * Reconcile all users' open trades
   */
  async reconcileAll(): Promise<ReconciliationStats> {
    console.log('[TradeReconciliation] Starting reconciliation for all users...');

    await connectToDatabase();

    // Find all users with open trades
    const openTrades = await SignalistBotTrade.find({ status: 'OPEN' })
      .select('userId brokerTradeId broker')
      .lean();

    // Group by user and broker
    const userTrades = new Map<string, Array<{ tradeId: string; brokerTradeId: string; broker: string }>>();
    for (const trade of openTrades) {
      const key = `${trade.userId}:${trade.broker}`;
      if (!userTrades.has(key)) {
        userTrades.set(key, []);
      }
      userTrades.get(key)!.push({
        tradeId: trade._id.toString(),
        brokerTradeId: trade.brokerTradeId || '',
        broker: trade.broker || 'deriv',
      });
    }

    const results: ReconciliationResult[] = [];
    let totalTradesChecked = 0;
    let totalTradesClosed = 0;
    let totalErrors = 0;

    // Reconcile for each user
    for (const [userKey, trades] of userTrades.entries()) {
      const [userId, broker] = userKey.split(':');
      
      // Only reconcile Deriv trades for now (other brokers can be added later)
      if (broker !== 'deriv') {
        continue;
      }

      try {
        const result = await this.reconcileUserTrades(userId, trades);
        results.push(result);
        totalTradesChecked += result.checked;
        totalTradesClosed += result.closed;
        totalErrors += result.errors;
      } catch (error: any) {
        console.error(`[TradeReconciliation] Error reconciling user ${userId}:`, error);
        totalErrors++;
      }
    }

    const stats: ReconciliationStats = {
      totalUsers: userTrades.size,
      totalTradesChecked,
      totalTradesClosed,
      totalErrors,
      results,
    };

    console.log(`[TradeReconciliation] Reconciliation complete: ${stats.totalTradesChecked} checked, ${stats.totalTradesClosed} closed, ${stats.totalErrors} errors`);

    return stats;
  }

  /**
   * Reconcile a specific user's open trades
   * 
   * @param userId - User ID
   * @param trades - Array of trades to check
   */
  async reconcileUserTrades(
    userId: string,
    trades: Array<{ tradeId: string; brokerTradeId: string; broker: string }>
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      userId,
      checked: 0,
      closed: 0,
      errors: 0,
      details: [],
    };

    if (trades.length === 0) {
      return result;
    }

    await connectToDatabase();

    // Get user's Deriv API token
    const tokenDoc = await DerivApiToken.findOne({ userId, isValid: true }).select('+token');
    if (!tokenDoc || !tokenDoc.token) {
      console.warn(`[TradeReconciliation] No valid token for user ${userId}, skipping reconciliation`);
      return result;
    }

    const token = await decrypt(tokenDoc.token);
    let wsClient: DerivServerWebSocketClient | null = null;

    try {
      // Connect to Deriv API
      wsClient = new DerivServerWebSocketClient(token);
      await wsClient.connect();

      // Get open contracts from Deriv API
      const openContracts = await wsClient.getOpenContracts();

      // Create a map of contract IDs from API
      const apiContractIds = new Set(
        openContracts.map((c) => c.contract_id?.toString() || c.contract_id)
      );

      // Check each trade
      for (const trade of trades) {
        result.checked++;

        try {
          if (!trade.brokerTradeId) {
            result.details.push({
              tradeId: trade.tradeId,
              brokerTradeId: '',
              action: 'error',
              error: 'No broker trade ID',
            });
            result.errors++;
            continue;
          }

          // Check if contract still exists in Deriv API
          if (!apiContractIds.has(trade.brokerTradeId)) {
            // Contract no longer exists - close the trade
            await this.closeStaleTrade(trade.tradeId, trade.brokerTradeId);
            result.closed++;
            result.details.push({
              tradeId: trade.tradeId,
              brokerTradeId: trade.brokerTradeId,
              action: 'closed',
            });

            logEmitter.warning(
              `Trade reconciliation: Closed stale trade ${trade.tradeId} (contract ${trade.brokerTradeId} no longer exists)`,
              userId,
              { tradeId: trade.tradeId, brokerTradeId: trade.brokerTradeId }
            );
          } else {
            // Trade is still valid
            result.details.push({
              tradeId: trade.tradeId,
              brokerTradeId: trade.brokerTradeId,
              action: 'verified',
            });
          }
        } catch (error: any) {
          console.error(`[TradeReconciliation] Error checking trade ${trade.tradeId}:`, error);
          result.errors++;
          result.details.push({
            tradeId: trade.tradeId,
            brokerTradeId: trade.brokerTradeId,
            action: 'error',
            error: error.message || 'Unknown error',
          });
        }
      }
    } catch (error: any) {
      console.error(`[TradeReconciliation] Error reconciling trades for user ${userId}:`, error);
      result.errors += trades.length - result.checked;
      logEmitter.error(
        `Trade reconciliation failed for user ${userId}`,
        userId,
        { error: error.message },
        error
      );
    } finally {
      // Disconnect WebSocket client
      if (wsClient) {
        try {
          await wsClient.disconnect();
        } catch (error) {
          // Ignore disconnect errors
        }
      }
    }

    return result;
  }


  /**
   * Close a stale trade (contract no longer exists in Deriv API)
   */
  private async closeStaleTrade(tradeId: string, brokerTradeId: string): Promise<void> {
    await connectToDatabase();

    const trade = await SignalistBotTrade.findOne({ _id: tradeId });
    if (!trade || trade.status !== 'OPEN') {
      return; // Trade already closed or doesn't exist
    }

    // Update trade status to closed with reconciliation reason
    await tradeLoggingService.updateTradeResult(tradeId, {
      status: 'CLOSED',
      exitReason: 'Reconciliation: Contract no longer exists in broker',
      exitPrice: trade.entryPrice || 0, // Use entry price as exit price (contract already closed)
      profitLoss: 0, // Cannot determine P/L without contract data
      profitLossPercent: 0,
    });

    console.log(`[TradeReconciliation] Closed stale trade ${tradeId} (contract ${brokerTradeId})`);
  }

  /**
   * Reconcile trades for a specific user (manual trigger)
   */
  async reconcileUser(userId: string): Promise<ReconciliationResult> {
    await connectToDatabase();

    const openTrades = await SignalistBotTrade.find({
      userId,
      status: 'OPEN',
      broker: 'deriv',
    })
      .select('_id brokerTradeId broker')
      .lean();

    const trades = openTrades.map(trade => ({
      tradeId: trade._id.toString(),
      brokerTradeId: trade.brokerTradeId || '',
      broker: trade.broker || 'deriv',
    }));

    return this.reconcileUserTrades(userId, trades);
  }

  /**
   * Get reconciliation status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.reconciliationIntervalMs,
    };
  }
}

// Export singleton instance
export const tradeReconciliationService = new TradeReconciliationService();

// Start reconciliation on module load (only in production)
if (process.env.NODE_ENV === 'production' && typeof setInterval !== 'undefined') {
  // Start after 1 minute to allow server to fully initialize
  setTimeout(() => {
    tradeReconciliationService.start();
  }, 60000);
}

