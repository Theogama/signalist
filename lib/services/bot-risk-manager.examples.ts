/**
 * Bot Risk Manager Usage Examples
 * 
 * Examples showing how to use the bot risk manager service
 */

import { 
  startBot, 
  stopBot, 
  getBotStatus,
  type BotExecutionConfig 
} from '@/lib/services/bot-execution-engine.service';
import { 
  botRiskManager, 
  BotRiskSettings, 
  BotStopReason,
  type BotStopEvent 
} from '@/lib/services/bot-risk-manager.service';

/**
 * Example 1: Basic bot with risk settings
 */
export async function example1_BasicBotWithRiskSettings() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'bot456',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 10,
    duration: 5,
    durationUnit: 'm',
    
    // Risk settings
    riskSettings: {
      // Stop loss: Stop if loss exceeds $5 or 50% of stake
      stopLossEnabled: true,
      stopLossAmount: 5,
      stopLossPercent: 50,
      
      // Take profit: Log when profit exceeds $10 or 100% of stake
      takeProfitEnabled: true,
      takeProfitAmount: 10,
      takeProfitPercent: 100,
      
      // Trade limits
      maxTradesPerDay: 50,
      maxTradesPerHour: 10,
      
      // Loss limits
      maxDailyLoss: 100, // Stop if daily loss exceeds $100
      maxDailyLossPercent: 10, // Or 10% of starting balance
      
      // Drawdown limit
      maxDrawdownPercent: 20, // Stop if drawdown exceeds 20%
      
      // Consecutive losses
      maxConsecutiveLosses: 5, // Stop after 5 consecutive losses
      
      // Minimum balance
      minBalance: 50, // Stop if balance falls below $50
    },
  };

  // Set up event listeners
  botRiskManager.on('bot_stopped', (event: BotStopEvent) => {
    console.log(`Bot stopped: ${event.reason} - ${event.message}`);
    console.log('Metrics:', event.metrics);
  });

  // Start the bot
  await startBot(config);
}

/**
 * Example 2: Conservative risk settings
 */
export async function example2_ConservativeSettings() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'conservative-bot',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 5, // Lower stake
    duration: 5,
    durationUnit: 'm',
    
    riskSettings: {
      stopLossEnabled: true,
      stopLossPercent: 30, // Tight stop loss
      
      takeProfitEnabled: true,
      takeProfitPercent: 50, // Conservative take profit
      
      maxTradesPerDay: 20, // Fewer trades
      maxDailyLoss: 50, // Lower loss limit
      maxDrawdownPercent: 10, // Tight drawdown limit
      maxConsecutiveLosses: 3, // Stop after 3 losses
      minBalance: 100,
    },
  };

  await startBot(config);
}

/**
 * Example 3: Aggressive risk settings
 */
export async function example3_AggressiveSettings() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'aggressive-bot',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 20, // Higher stake
    duration: 5,
    durationUnit: 'm',
    
    riskSettings: {
      stopLossEnabled: true,
      stopLossPercent: 70, // Wider stop loss
      
      takeProfitEnabled: true,
      takeProfitPercent: 150, // Higher take profit target
      
      maxTradesPerDay: 100, // More trades
      maxDailyLoss: 200, // Higher loss tolerance
      maxDrawdownPercent: 30, // Higher drawdown tolerance
      maxConsecutiveLosses: 10, // More consecutive losses allowed
    },
  };

  await startBot(config);
}

/**
 * Example 4: Handling stop events
 */
export async function example4_HandleStopEvents() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'monitored-bot',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 10,
    duration: 5,
    durationUnit: 'm',
    riskSettings: {
      stopLossEnabled: true,
      stopLossPercent: 50,
      maxTradesPerDay: 50,
      maxDailyLoss: 100,
    },
  };

  // Listen for specific stop reasons
  botRiskManager.on(`bot_stopped:${BotStopReason.STOP_LOSS_HIT}`, (event: BotStopEvent) => {
    console.log('Stop loss was hit!');
    // Send notification, log to database, etc.
  });

  botRiskManager.on(`bot_stopped:${BotStopReason.MAX_TRADES_REACHED}`, (event: BotStopEvent) => {
    console.log('Daily trade limit reached');
    // Could restart bot tomorrow, etc.
  });

  botRiskManager.on(`bot_stopped:${BotStopReason.MARKET_CLOSED}`, (event: BotStopEvent) => {
    console.log('Market closed - bot will resume when market opens');
    // Could schedule restart when market opens
  });

  await startBot(config);
}

/**
 * Example 5: Manual risk check
 */
export async function example5_ManualRiskCheck() {
  const botId = 'bot123';
  const userId = 'user123';
  const currentBalance = 1000;
  const symbol = 'BOOM500';

  // Check risk before executing a trade
  const riskCheck = await botRiskManager.checkRisk(
    botId,
    userId,
    currentBalance,
    symbol
  );

  if (!riskCheck.allowed) {
    console.log(`Trade not allowed: ${riskCheck.message}`);
    if (riskCheck.shouldStop) {
      console.log(`Bot should be stopped: ${riskCheck.reason}`);
    }
    return;
  }

  console.log('Risk check passed, trade can proceed');
  console.log('Current metrics:', riskCheck.metrics);
}

/**
 * Example 6: Get current metrics
 */
export function example6_GetMetrics() {
  const botId = 'bot123';
  const userId = 'user123';

  const metrics = botRiskManager.getMetrics(botId, userId);
  
  if (metrics) {
    console.log('Daily trade count:', metrics.dailyTradeCount);
    console.log('Daily P/L:', metrics.dailyProfitLoss);
    console.log('Current drawdown:', metrics.currentDrawdown);
    console.log('Consecutive losses:', metrics.consecutiveLosses);
  }
}

/**
 * Example 7: Reset daily metrics (for testing)
 */
export function example7_ResetMetrics() {
  const botId = 'bot123';
  const userId = 'user123';

  // Reset daily metrics (useful for testing or manual reset)
  botRiskManager.resetDailyMetrics(botId, userId);
  console.log('Daily metrics reset');
}

/**
 * Example 8: Complete bot lifecycle with risk management
 */
export async function example8_CompleteLifecycle() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'complete-bot',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 10,
    duration: 5,
    durationUnit: 'm',
    riskSettings: {
      stopLossEnabled: true,
      stopLossPercent: 50,
      takeProfitEnabled: true,
      takeProfitPercent: 100,
      maxTradesPerDay: 50,
      maxDailyLoss: 100,
      maxDrawdownPercent: 20,
      maxConsecutiveLosses: 5,
    },
  };

  // Set up all event listeners
  botRiskManager.on('bot_stopped', (event: BotStopEvent) => {
    console.log(`Bot stopped: ${event.reason}`);
    console.log(`Message: ${event.message}`);
    console.log(`Timestamp: ${event.timestamp}`);
    
    // Handle different stop reasons
    switch (event.reason) {
      case BotStopReason.STOP_LOSS_HIT:
        console.log('Stop loss was hit - consider reviewing strategy');
        break;
      case BotStopReason.MAX_TRADES_REACHED:
        console.log('Daily trade limit reached - bot will resume tomorrow');
        break;
      case BotStopReason.DAILY_LOSS_LIMIT:
        console.log('Daily loss limit reached - bot stopped for safety');
        break;
      case BotStopReason.MARKET_CLOSED:
        console.log('Market closed - bot will resume when market opens');
        break;
      case BotStopReason.API_ERROR:
        console.log('API error - bot stopped, check connection');
        break;
      default:
        console.log(`Bot stopped: ${event.reason}`);
    }
  });

  try {
    // Start bot
    await startBot(config);
    console.log('Bot started successfully');

    // Monitor bot status
    const status = getBotStatus(config.botId, config.userId);
    console.log('Bot status:', status);

    // Bot will run until stopped by risk manager or manually
    // You can stop it manually:
    // await stopBot(config.botId, config.userId);

  } catch (error) {
    console.error('Error starting bot:', error);
  }
}


