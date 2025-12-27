/**
 * Deriv Market Status Service - Usage Examples
 * Demonstrates how to use the market status service
 */

import { marketStatusService, MarketStatus } from './deriv-market-status.service';

/**
 * Example 1: Basic usage - Check market status
 */
export async function example1_BasicUsage() {
  // Initialize service with user ID
  await marketStatusService.initialize('user-id-here');

  // Get market status for a symbol
  const status = await marketStatusService.getMarketStatus('BOOM1000');

  console.log('Market Status:', status.status); // 'open', 'closed', 'suspended', 'unknown'
  console.log('Is Tradable:', status.isTradable); // true or false
  console.log('Reason:', status.reason); // Why market is closed (if applicable)
  console.log('Source:', status.source); // 'api', 'trading-hours', or 'fallback'
}

/**
 * Example 2: Check if market is tradable (convenience method)
 */
export async function example2_IsTradable() {
  await marketStatusService.initialize('user-id-here');

  const isTradable = await marketStatusService.isMarketTradable('BOOM1000');

  if (isTradable) {
    console.log('Market is open, trades can be executed');
  } else {
    console.log('Market is closed, trades are blocked');
  }
}

/**
 * Example 3: Listen for market status alerts
 */
export async function example3_ListenForAlerts() {
  await marketStatusService.initialize('user-id-here');

  // Listen for market status alerts
  marketStatusService.on('market_status_alert', (alert) => {
    console.log('Market Status Alert:', {
      symbol: alert.symbol,
      previousStatus: alert.previousStatus,
      currentStatus: alert.currentStatus,
      message: alert.message,
      isTradable: alert.isTradable,
      timestamp: alert.timestamp,
    });
  });

  // Listen for non-tradable alerts
  marketStatusService.on('market_not_tradable', (data) => {
    console.warn('Market Not Tradable:', {
      symbol: data.symbol,
      status: data.status,
      reason: data.reason,
    });
  });

  // Check market status (will emit alerts if not tradable)
  await marketStatusService.getMarketStatus('BOOM1000');
}

/**
 * Example 4: Block trade execution when market is closed
 */
export async function example4_BlockTradeExecution() {
  await marketStatusService.initialize('user-id-here');

  const symbol = 'BOOM1000';

  // Check market status before executing trade
  const status = await marketStatusService.getMarketStatus(symbol);

  if (!status.isTradable) {
    console.error('Cannot execute trade:', {
      reason: status.reason,
      status: status.status,
      nextOpen: status.nextOpen,
    });
    return; // Block trade execution
  }

  // Market is open, proceed with trade
  console.log('Market is open, executing trade...');
  // ... execute trade logic here
}

/**
 * Example 5: Check multiple symbols
 */
export async function example5_CheckMultipleSymbols() {
  await marketStatusService.initialize('user-id-here');

  const symbols = ['BOOM1000', 'BOOM500', 'CRASH1000', 'R_10'];

  for (const symbol of symbols) {
    const status = await marketStatusService.getMarketStatus(symbol);
    console.log(`${symbol}: ${status.status} (${status.isTradable ? 'Tradable' : 'Not Tradable'})`);
  }
}

/**
 * Example 6: Handle different market statuses
 */
export async function example6_HandleStatuses() {
  await marketStatusService.initialize('user-id-here');

  const status = await marketStatusService.getMarketStatus('BOOM1000');

  switch (status.status) {
    case MarketStatus.OPEN:
      console.log('Market is open, ready to trade');
      break;

    case MarketStatus.CLOSED:
      console.log('Market is closed:', status.reason);
      if (status.nextOpen) {
        console.log('Next open time:', status.nextOpen);
      }
      break;

    case MarketStatus.SUSPENDED:
      console.log('Market is suspended:', status.reason);
      break;

    case MarketStatus.UNKNOWN:
      console.log('Market status unknown:', status.reason);
      break;
  }
}

/**
 * Example 7: Clear cache
 */
export async function example7_ClearCache() {
  // Clear cache for specific symbol
  marketStatusService.clearCache('BOOM1000');

  // Clear all cache
  marketStatusService.clearCache();
}

/**
 * Example 8: Integration with bot execution
 */
export async function example8_BotIntegration() {
  await marketStatusService.initialize('user-id-here');

  const symbol = 'BOOM1000';
  const userId = 'user-id-here';

  // Before executing trade in bot
  const isTradable = await marketStatusService.isMarketTradable(symbol);

  if (!isTradable) {
    const status = await marketStatusService.getMarketStatus(symbol);
    
    // Log and block
    console.error('Bot trade blocked:', {
      symbol,
      status: status.status,
      reason: status.reason,
    });
    
    // Emit alert or notification
    // ... notification logic here
    
    return false; // Block execution
  }

  // Proceed with trade execution
  return true;
}

/**
 * Example 9: Cleanup
 */
export async function example9_Cleanup() {
  // Disconnect and cleanup
  await marketStatusService.disconnect();
}


