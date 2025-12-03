'use server';

import { connectToDatabase } from '@/database/mongoose';
import { UserBotSettings } from '@/database/models/bot-settings.model';
import { BotTrade } from '@/database/models/bot-trade.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; data?: T; error?: string };

async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return session.user;
}

/**
 * Get user bot settings
 */
export async function getBotSettings(): Promise<ActionResult<any>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    // Use .lean() to get plain JavaScript objects instead of Mongoose documents
    const settings = await UserBotSettings.findOne({ userId: user.id }).lean();
    
    if (!settings) {
      // Return default settings if none exist
      return {
        success: true,
        data: {
          enabled: false,
          maxTradeSizePct: 5,
          stopLossPct: 2,
          takeProfitPct: 5,
          trailingStop: false,
          exchange: 'binance',
          paperMode: true,
        },
      };
    }

    // Don't return sensitive API keys and Mongoose internal fields
    const { apiKey, apiSecret, _id, __v, ...safeSettings } = settings;
    
    return {
      success: true,
      data: safeSettings,
    };
  } catch (error: any) {
    console.error('getBotSettings error:', error);
    return { success: false, error: error.message || 'Failed to fetch bot settings' };
  }
}

/**
 * Update user bot settings
 */
export async function updateBotSettings(input: {
  enabled: boolean;
  maxTradeSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  trailingStop: boolean;
  exchange: string;
  apiKey?: string;
  apiSecret?: string;
  paperMode: boolean;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    // Validate input
    if (input.maxTradeSizePct < 0.1 || input.maxTradeSizePct > 100) {
      return { success: false, error: 'Max trade size must be between 0.1% and 100%' };
    }
    if (input.stopLossPct < 0.1 || input.stopLossPct > 50) {
      return { success: false, error: 'Stop loss must be between 0.1% and 50%' };
    }
    if (input.takeProfitPct < 0.1 || input.takeProfitPct > 100) {
      return { success: false, error: 'Take profit must be between 0.1% and 100%' };
    }

    const updateData: any = {
      enabled: Boolean(input.enabled),
      maxTradeSizePct: Number(input.maxTradeSizePct),
      stopLossPct: Number(input.stopLossPct),
      takeProfitPct: Number(input.takeProfitPct),
      trailingStop: Boolean(input.trailingStop),
      exchange: String(input.exchange),
      paperMode: Boolean(input.paperMode),
      updatedAt: new Date(),
    };

    // Only update API keys if provided and not empty
    if (input.apiKey && input.apiKey.trim()) {
      updateData.apiKey = input.apiKey.trim();
    }
    if (input.apiSecret && input.apiSecret.trim()) {
      updateData.apiSecret = input.apiSecret.trim();
    }

    // Ensure createdAt is set on first creation
    const existing = await UserBotSettings.findOne({ userId: user.id });
    if (!existing) {
      updateData.createdAt = new Date();
    }

    await UserBotSettings.findOneAndUpdate(
      { userId: user.id },
      updateData,
      { upsert: true, new: true, runValidators: true }
    );

    revalidatePath('/autotrade');
    return { success: true };
  } catch (error: any) {
    console.error('updateBotSettings error:', error);
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((e: any) => e.message);
      return { success: false, error: validationErrors.join(', ') || 'Validation error' };
    }
    
    if (error.code === 11000) {
      return { success: false, error: 'Bot settings already exist for this user' };
    }
    
    return { success: false, error: error.message || 'Failed to update bot settings' };
  }
}

/**
 * Execute bot trade
 * Directly calls the execution logic instead of making HTTP request
 */
export async function executeBotTrade(signalId: string): Promise<ActionResult<{ tradeId: string }>> {
  try {
    const user = await requireUser();
    
    if (!signalId) {
      return { success: false, error: 'Signal ID is required' };
    }

    // Import and call the execution service directly
    const { executeBotTradeLogic } = await import('@/lib/services/bot-execution.service');
    
    console.log('executeBotTrade: Calling execution service', { userId: user.id, signalId });
    const result = await executeBotTradeLogic(user.id, signalId);
    console.log('executeBotTrade: Execution result', { 
      success: result.success, 
      error: result.error,
      tradeId: result.tradeId 
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to execute trade' };
    }

    if (!result.tradeId) {
      return { success: false, error: 'Trade executed but no trade ID returned' };
    }

    revalidatePath('/dashboard/bot-trades');
    revalidatePath('/signals');
    return { success: true, data: { tradeId: result.tradeId } };
  } catch (error: any) {
    console.error('executeBotTrade error:', error);
    console.error('executeBotTrade error stack:', error.stack);
    return { success: false, error: error.message || 'Failed to execute trade. Please try again.' };
  }
}

/**
 * Get user bot trades with filtering and sorting
 */
export async function getBotTrades(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<any[]>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const query: any = { userId: user.id };
    
    if (filters?.status) {
      query.status = filters.status;
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortBy]: sortOrder };

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const trades = await BotTrade.find(query)
      .sort(sort)
      .limit(limit)
      .skip(offset)
      .lean();

    return {
      success: true,
      data: trades.map((trade) => ({
        tradeId: trade.tradeId,
        signalId: trade.signalId,
        symbol: trade.symbol,
        action: trade.action,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        status: trade.status,
        profitLoss: trade.profitLoss,
        profitLossPct: trade.profitLossPct,
        quantity: trade.quantity,
        createdAt: trade.createdAt,
        filledAt: trade.filledAt,
        closedAt: trade.closedAt,
      })),
    };
  } catch (error: any) {
    console.error('getBotTrades error:', error);
    return { success: false, error: error.message || 'Failed to fetch bot trades' };
  }
}

