/**
 * Emergency Stop Service
 * Provides emergency stop functionality to immediately stop all bots
 */

import { botManager } from './bot-manager.service';
import { BotExecutionEngine } from './bot-execution-engine.service';
import { userExecutionLockService } from './user-execution-lock.service';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

export interface EmergencyStopResult {
  userId?: string; // If provided, only stops bots for this user
  stoppedBots: string[]; // Bot IDs that were stopped
  closedTrades: string[]; // Trade IDs that were force-closed
  errors: string[];
  stoppedAt: Date;
}

class EmergencyStopService {
  /**
   * Emergency stop all bots for a specific user
   * 
   * @param userId - User ID
   * @param reason - Reason for emergency stop
   * @returns Emergency stop result
   */
  async stopUserBots(userId: string, reason: string = 'Emergency stop'): Promise<EmergencyStopResult> {
    console.log(`[EmergencyStop] Stopping all bots for user ${userId}: ${reason}`);

    const result: EmergencyStopResult = {
      userId,
      stoppedBots: [],
      closedTrades: [],
      errors: [],
      stoppedAt: new Date(),
    };

    try {
      // Get all active bots for user
      const userBots = botManager.getUserBots(userId);

      // Stop each bot
      for (const bot of userBots) {
        try {
          const stopped = botManager.stopBot(userId, bot.botId);
          if (stopped) {
            result.stoppedBots.push(bot.botId);
            console.log(`[EmergencyStop] Stopped bot ${bot.botId} for user ${userId}`);
          }
        } catch (error: any) {
          const errorMsg = `Failed to stop bot ${bot.botId}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`[EmergencyStop] ${errorMsg}`, error);
        }
      }

      // Force release user execution lock
      try {
        await userExecutionLockService.forceRelease(userId);
        console.log(`[EmergencyStop] Released execution lock for user ${userId}`);
      } catch (error: any) {
        const errorMsg = `Failed to release execution lock: ${error.message}`;
        result.errors.push(errorMsg);
        console.warn(`[EmergencyStop] ${errorMsg}`);
      }

      // Log emergency stop
      logEmitter.error(
        `Emergency stop: All bots stopped for user ${userId}. Reason: ${reason}`,
        userId,
        {
          reason,
          stoppedBots: result.stoppedBots,
          errors: result.errors,
        }
      );

      console.log(`[EmergencyStop] Emergency stop complete for user ${userId}: ${result.stoppedBots.length} bot(s) stopped`);
    } catch (error: any) {
      const errorMsg = `Emergency stop failed: ${error.message}`;
      result.errors.push(errorMsg);
      console.error(`[EmergencyStop] ${errorMsg}`, error);
      logEmitter.error(
        `Emergency stop failed for user ${userId}`,
        userId,
        { error: error.message },
        error
      );
    }

    return result;
  }

  /**
   * Emergency stop all bots system-wide
   * 
   * @param reason - Reason for emergency stop
   * @returns Emergency stop result
   */
  async stopAllBots(reason: string = 'System-wide emergency stop'): Promise<EmergencyStopResult> {
    console.log(`[EmergencyStop] Stopping all bots system-wide: ${reason}`);

    const result: EmergencyStopResult = {
      stoppedBots: [],
      closedTrades: [],
      errors: [],
      stoppedAt: new Date(),
    };

    try {
      // Get all active bots (grouped by user)
      const allBots = Array.from(botManager['activeBots'].values());
      const userGroups = new Map<string, typeof allBots>();

      for (const bot of allBots) {
        if (!userGroups.has(bot.userId)) {
          userGroups.set(bot.userId, []);
        }
        userGroups.get(bot.userId)!.push(bot);
      }

      // Stop bots for each user
      for (const [userId, bots] of userGroups.entries()) {
        const userResult = await this.stopUserBots(userId, reason);
        result.stoppedBots.push(...userResult.stoppedBots);
        result.closedTrades.push(...userResult.closedTrades);
        result.errors.push(...userResult.errors);
      }

      // Log system-wide emergency stop
      logEmitter.error(
        `Emergency stop: All bots stopped system-wide. Reason: ${reason}`,
        undefined, // No specific user for system-wide stop
        {
          reason,
          stoppedBots: result.stoppedBots,
          totalBots: result.stoppedBots.length,
          errors: result.errors,
        }
      );

      console.log(`[EmergencyStop] System-wide emergency stop complete: ${result.stoppedBots.length} bot(s) stopped`);
    } catch (error: any) {
      const errorMsg = `System-wide emergency stop failed: ${error.message}`;
      result.errors.push(errorMsg);
      console.error(`[EmergencyStop] ${errorMsg}`, error);
    }

    return result;
  }

  /**
   * Force close all open trades for a user
   * WARNING: This should only be used in extreme emergencies
   * 
   * @param userId - User ID
   * @param reason - Reason for force closing
   */
  async forceCloseUserTrades(userId: string, reason: string = 'Emergency force close'): Promise<string[]> {
    console.log(`[EmergencyStop] Force closing all open trades for user ${userId}: ${reason}`);

    const closedTradeIds: string[] = [];

    try {
      await connectToDatabase();

      // Find all open trades
      const openTrades = await SignalistBotTrade.find({
        userId,
        status: 'OPEN',
      }).lean();

      // Mark all as force-closed
      for (const trade of openTrades) {
        try {
          await SignalistBotTrade.updateOne(
            { _id: trade._id },
            {
              $set: {
                status: 'FORCE_STOP',
                exitReason: reason,
                exitTimestamp: new Date(),
                // Use entry price as exit price (we can't determine actual exit price without API call)
                exitPrice: trade.entryPrice,
                realizedPnl: 0,
                realizedPnlPercent: 0,
              },
            }
          );

          closedTradeIds.push(trade.tradeId);
          console.log(`[EmergencyStop] Force closed trade ${trade.tradeId} for user ${userId}`);
        } catch (error: any) {
          console.error(`[EmergencyStop] Failed to force close trade ${trade.tradeId}:`, error);
        }
      }

      logEmitter.warning(
        `Emergency stop: Force closed ${closedTradeIds.length} open trade(s) for user ${userId}. Reason: ${reason}`,
        userId,
        {
          reason,
          closedTrades: closedTradeIds,
        }
      );

      console.log(`[EmergencyStop] Force closed ${closedTradeIds.length} trade(s) for user ${userId}`);
    } catch (error: any) {
      console.error(`[EmergencyStop] Error force closing trades for user ${userId}:`, error);
      logEmitter.error(
        `Emergency stop: Failed to force close trades for user ${userId}`,
        userId,
        { error: error.message },
        error
      );
    }

    return closedTradeIds;
  }
}

// Export singleton instance
export const emergencyStopService = new EmergencyStopService();

