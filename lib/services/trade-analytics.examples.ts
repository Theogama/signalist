/**
 * Trade Analytics Usage Examples
 * 
 * Examples showing how to use trade logging and analytics services
 */

import { tradeLoggingService } from '@/lib/services/trade-logging.service';
import { botAnalyticsService } from '@/lib/services/bot-analytics.service';

/**
 * Example 1: Log a trade
 */
export async function example1_LogTrade() {
  const tradeId = await tradeLoggingService.logTrade({
    userId: 'user123',
    botId: 'bot456',
    broker: 'deriv',
    symbol: 'BOOM500',
    side: 'BUY',
    stake: 10,
    entryPrice: 1000,
    status: 'OPEN',
    entryTimestamp: new Date(),
    isDemo: false,
    entryReason: 'Bot signal triggered',
  });

  console.log('Trade logged:', tradeId);
}

/**
 * Example 2: Log trade result
 */
export async function example2_LogTradeResult() {
  await tradeLoggingService.logTradeResult(
    'user123',
    'bot456',
    'deriv',
    'BOOM500',
    'BUY',
    10, // stake
    1000, // entry price
    {
      success: true,
      tradeId: 'trade-123',
      profitLoss: 5.5, // $5.50 profit
      profitLossPercent: 55, // 55% return
      status: 'won',
    },
    false // isDemo
  );
}

/**
 * Example 3: Update trade with result
 */
export async function example3_UpdateTradeResult() {
  await tradeLoggingService.updateTradeResult('trade-123', {
    exitPrice: 1055,
    profitLoss: 5.5,
    profitLossPercent: 55,
    status: 'TP_HIT',
    exitReason: 'Take profit reached',
  });
}

/**
 * Example 4: Get bot performance
 */
export async function example4_GetBotPerformance() {
  const performance = await botAnalyticsService.getBotPerformance(
    'user123',
    'bot456',
    {
      startDate: new Date('2024-01-01'),
      endDate: new Date(),
      isDemo: false,
    }
  );

  console.log('Bot Performance:', {
    totalTrades: performance.totalTrades,
    winRate: performance.winRate.toFixed(2) + '%',
    totalProfitLoss: `$${performance.totalProfitLoss.toFixed(2)}`,
    profitFactor: performance.profitFactor.toFixed(2),
  });
}

/**
 * Example 5: Get daily P/L
 */
export async function example5_GetDailyPL() {
  const dailyPL = await botAnalyticsService.getDailyPerformance(
    'user123',
    'bot456',
    30, // Last 30 days
    {
      isDemo: false,
    }
  );

  console.log('Daily P/L (last 30 days):');
  dailyPL.forEach(day => {
    console.log(`${day.date}: ${day.trades} trades, P/L: $${day.profitLoss.toFixed(2)}`);
  });
}

/**
 * Example 6: Get comprehensive bot analytics
 */
export async function example6_GetBotAnalytics() {
  const analytics = await botAnalyticsService.getBotAnalytics(
    'user123',
    'bot456',
    {
      startDate: new Date('2024-01-01'),
      endDate: new Date(),
      isDemo: false,
      includeRecentTrades: 10,
    }
  );

  console.log('Bot Analytics Summary:');
  console.log('Performance:', analytics.performance);
  console.log('Daily Performance:', analytics.dailyPerformance);
  console.log('Symbol Performance:', analytics.symbolPerformance);
  console.log('Recent Trades:', analytics.recentTrades);
}

/**
 * Example 7: Get all bots performance
 */
export async function example7_GetAllBotsPerformance() {
  const allBots = await botAnalyticsService.getAllBotsPerformance('user123', {
    isDemo: false,
  });

  console.log('All Bots Performance:');
  allBots.forEach(bot => {
    console.log(`${bot.botId}:`, {
      trades: bot.performance.totalTrades,
      winRate: bot.performance.winRate.toFixed(2) + '%',
      profitLoss: `$${bot.performance.totalProfitLoss.toFixed(2)}`,
    });
  });
}

/**
 * Example 8: Get daily P/L summary
 */
export async function example8_GetDailyPLSummary() {
  const today = new Date();
  const summary = await botAnalyticsService.getDailyPLSummary(
    'user123',
    today,
    {
      isDemo: false,
    }
  );

  console.log(`Daily P/L Summary for ${summary.date}:`);
  console.log(`Total Trades: ${summary.totalTrades}`);
  console.log(`Total P/L: $${summary.totalProfitLoss.toFixed(2)}`);
  console.log('Bot Breakdown:');
  summary.botBreakdown.forEach(bot => {
    console.log(`  ${bot.botId}: ${bot.trades} trades, P/L: $${bot.profitLoss.toFixed(2)}`);
  });
}

/**
 * Example 9: Get bot trades with filters
 */
export async function example9_GetBotTrades() {
  const trades = await tradeLoggingService.getBotTrades(
    'user123',
    'bot456',
    {
      status: 'TP_HIT', // Only winning trades
      startDate: new Date('2024-01-01'),
      limit: 50,
      offset: 0,
    }
  );

  console.log(`Found ${trades.length} trades`);
  trades.forEach(trade => {
    console.log(`${trade.tradeId}: ${trade.symbol} - P/L: $${trade.profitLoss?.toFixed(2)}`);
  });
}

/**
 * Example 10: Get user trades (all bots)
 */
export async function example10_GetUserTrades() {
  const trades = await tradeLoggingService.getUserTrades('user123', {
    isDemo: false, // Only live trades
    startDate: new Date('2024-01-01'),
    limit: 100,
  });

  console.log(`Found ${trades.length} trades across all bots`);
  
  // Group by bot
  const byBot: Record<string, number> = {};
  trades.forEach(trade => {
    byBot[trade.botId] = (byBot[trade.botId] || 0) + 1;
  });

  console.log('Trades by bot:');
  Object.entries(byBot).forEach(([botId, count]) => {
    console.log(`  ${botId}: ${count} trades`);
  });
}

/**
 * Example 11: Compare demo vs live performance
 */
export async function example11_CompareDemoVsLive() {
  const botId = 'bot456';
  const userId = 'user123';

  // Get demo performance
  const demoPerformance = await botAnalyticsService.getBotPerformance(
    userId,
    botId,
    { isDemo: true }
  );

  // Get live performance
  const livePerformance = await botAnalyticsService.getBotPerformance(
    userId,
    botId,
    { isDemo: false }
  );

  console.log('Demo Performance:', {
    trades: demoPerformance.totalTrades,
    winRate: demoPerformance.winRate.toFixed(2) + '%',
    profitLoss: `$${demoPerformance.totalProfitLoss.toFixed(2)}`,
  });

  console.log('Live Performance:', {
    trades: livePerformance.totalTrades,
    winRate: livePerformance.winRate.toFixed(2) + '%',
    profitLoss: `$${livePerformance.totalProfitLoss.toFixed(2)}`,
  });
}

/**
 * Example 12: Get symbol performance for a bot
 */
export async function example12_GetSymbolPerformance() {
  const symbolPerf = await botAnalyticsService.getSymbolPerformance(
    'user123',
    'bot456',
    {
      startDate: new Date('2024-01-01'),
    }
  );

  console.log('Symbol Performance:');
  symbolPerf.forEach(symbol => {
    console.log(`${symbol.symbol}:`, {
      trades: symbol.trades,
      winRate: symbol.winRate.toFixed(2) + '%',
      profitLoss: `$${symbol.profitLoss.toFixed(2)}`,
    });
  });
}

