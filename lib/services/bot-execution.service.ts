/**
 * Bot Execution Service
 * Shared logic for executing bot trades (used by both API route and server actions)
 */

import { connectToDatabase } from '@/database/mongoose';
import { UserBotSettings } from '@/database/models/bot-settings.model';
import { BotTrade } from '@/database/models/bot-trade.model';
import { Signal } from '@/database/models/signal.model';
import { randomUUID } from 'crypto';

export interface ExecuteBotResult {
  success: boolean;
  tradeId?: string;
  message?: string;
  error?: string;
}

/**
 * Validate exchange API credentials
 */
async function validateExchangeCredentials(
  exchange: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  if (!apiKey || !apiSecret) {
    return false;
  }
  // TODO: Implement actual credential validation
  return true;
}

/**
 * Get account balance from exchange
 */
async function getAccountBalance(
  exchange: string,
  apiKey: string,
  apiSecret: string,
  quoteCurrency: string = 'USDT'
): Promise<number> {
  // TODO: Implement actual balance fetching
  return 1000; // Placeholder
}

/**
 * Place order on exchange
 */
async function placeExchangeOrder(
  exchange: string,
  apiKey: string,
  apiSecret: string,
  symbol: string,
  action: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  paperMode: boolean
): Promise<{ orderId: string; filledPrice: number }> {
  if (paperMode) {
    console.log(`[PAPER TRADE] ${action} ${quantity} ${symbol} at ${price}`);
    return {
      orderId: `PAPER-${randomUUID()}`,
      filledPrice: price,
    };
  }

  // TODO: Implement actual order placement
  return {
    orderId: `LIVE-${randomUUID()}`,
    filledPrice: price,
  };
}

/**
 * Fetch signal details from database
 */
async function getSignalDetails(signalId: string): Promise<{
  ticker: string;
  action: 'BUY' | 'SELL';
  price: number;
}> {
  await connectToDatabase();
  
  const signal = await Signal.findOne({ signalId }).lean();
  
  if (!signal) {
    throw new Error('Signal not found');
  }
  
  if (signal.status !== 'active') {
    throw new Error(`Signal is ${signal.status} and cannot be executed`);
  }
  
  // Check if signal has expired
  if (signal.expiresAt && new Date(signal.expiresAt) < new Date()) {
    await Signal.findOneAndUpdate({ signalId }, { status: 'expired', updatedAt: new Date() });
    throw new Error('Signal has expired');
  }
  
  return {
    ticker: signal.ticker || signal.symbol,
    action: signal.action,
    price: signal.price,
  };
}

/**
 * Execute bot trade - main execution logic
 */
export async function executeBotTradeLogic(
  userId: string,
  signalId: string
): Promise<ExecuteBotResult> {
  console.log('executeBotTradeLogic: Starting execution', { userId, signalId });
  try {
    await connectToDatabase();
    console.log('executeBotTradeLogic: Database connected');

    // Get user bot settings
    console.log('executeBotTradeLogic: Fetching bot settings for user', userId);
    const botSettings = await UserBotSettings.findOne({ userId }).select('+apiKey +apiSecret');
    if (!botSettings) {
      console.error('executeBotTradeLogic: Bot settings not found');
      return {
        success: false,
        error: 'Bot settings not found. Please configure bot settings first.',
      };
    }
    console.log('executeBotTradeLogic: Bot settings found', { 
      enabled: botSettings.enabled, 
      exchange: botSettings.exchange,
      hasApiKey: !!botSettings.apiKey,
      hasApiSecret: !!botSettings.apiSecret 
    });

    if (!botSettings.enabled) {
      return {
        success: false,
        error: 'Auto-trading is not enabled. Please enable it in bot settings.',
      };
    }

    // Validate exchange credentials
    if (!botSettings.apiKey || !botSettings.apiSecret) {
      return {
        success: false,
        error: 'Exchange API credentials are missing. Please add them in bot settings.',
      };
    }

    const credentialsValid = await validateExchangeCredentials(
      botSettings.exchange,
      botSettings.apiKey,
      botSettings.apiSecret
    );

    if (!credentialsValid) {
      return {
        success: false,
        error: 'Invalid exchange API credentials. Please update them in bot settings.',
      };
    }

    // Fetch signal details
    console.log('executeBotTradeLogic: Fetching signal details', signalId);
    let signalDetails;
    try {
      signalDetails = await getSignalDetails(signalId);
      console.log('executeBotTradeLogic: Signal details fetched', signalDetails);
    } catch (error: any) {
      console.error('executeBotTradeLogic: Error fetching signal', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch signal details',
      };
    }

    const { ticker, action, price: signalPrice } = signalDetails;

    // Get account balance
    const accountBalance = await getAccountBalance(
      botSettings.exchange,
      botSettings.apiKey,
      botSettings.apiSecret
    );

    if (accountBalance <= 0) {
      return {
        success: false,
        error: 'Insufficient account balance',
      };
    }

    // Calculate order size
    const maxTradeSize = (accountBalance * botSettings.maxTradeSizePct) / 100;
    const quantity = maxTradeSize / signalPrice;

    // Get current market price
    let currentMarketPrice = signalPrice;
    try {
      const priceResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/market-data/price/${ticker}`,
        { cache: 'no-store' }
      );
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        currentMarketPrice = priceData.price;
      }
    } catch (error) {
      console.error('Error fetching current price:', error);
      currentMarketPrice = signalPrice;
    }

    const priceDeviation = Math.abs((currentMarketPrice - signalPrice) / signalPrice) * 100;

    if (priceDeviation > 5) {
      return {
        success: false,
        error: `Price deviation too large (${priceDeviation.toFixed(2)}%). Current price ($${currentMarketPrice.toFixed(2)}) differs from signal price ($${signalPrice.toFixed(2)}) by more than 5%.`,
      };
    }

    // Calculate stop loss and take profit prices
    const stopLossPrice =
      action === 'BUY'
        ? signalPrice * (1 - botSettings.stopLossPct / 100)
        : signalPrice * (1 + botSettings.stopLossPct / 100);

    const takeProfitPrice =
      action === 'BUY'
        ? signalPrice * (1 + botSettings.takeProfitPct / 100)
        : signalPrice * (1 - botSettings.takeProfitPct / 100);

    // Place order on exchange
    let orderResult;
    try {
      orderResult = await placeExchangeOrder(
        botSettings.exchange,
        botSettings.apiKey,
        botSettings.apiSecret,
        ticker,
        action,
        quantity,
        signalPrice,
        botSettings.paperMode
      );
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to place order: ${error.message}`,
      };
    }

    // Create trade record
    const tradeId = randomUUID();
    const trade = await BotTrade.create({
      tradeId,
      signalId,
      userId,
      symbol: ticker,
      action,
      entryPrice: orderResult.filledPrice,
      quantity,
      status: botSettings.paperMode ? 'FILLED' : 'PENDING',
      stopLossPrice,
      takeProfitPrice,
      trailingStopEnabled: botSettings.trailingStop,
      exchange: botSettings.exchange,
      exchangeOrderId: orderResult.orderId,
      filledAt: botSettings.paperMode ? new Date() : undefined,
    });

    // Mark signal as executed
    await Signal.findOneAndUpdate(
      { signalId },
      { status: 'executed', updatedAt: new Date() }
    );

    console.log('executeBotTradeLogic: Trade created successfully', { tradeId: trade.tradeId });
    return {
      success: true,
      tradeId: trade.tradeId,
      message: botSettings.paperMode
        ? `Paper trade executed successfully`
        : `Order placed successfully. Trade ID: ${tradeId}`,
    };
  } catch (error: any) {
    console.error('executeBotTradeLogic: Error occurred', error);
    console.error('executeBotTradeLogic: Error stack', error.stack);
    return {
      success: false,
      error: error.message || 'Internal server error',
    };
  }
}

