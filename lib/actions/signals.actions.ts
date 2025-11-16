'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Signal } from '@/database/models/signal.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
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
 * Get all active signals (optionally filtered by user)
 */
export async function getSignals(filters?: {
  userId?: string;
  status?: 'active' | 'executed' | 'expired' | 'cancelled';
  symbol?: string;
  action?: 'BUY' | 'SELL';
  limit?: number;
  offset?: number;
}): Promise<ActionResult<any[]>> {
  try {
    await connectToDatabase();

    const query: any = {};

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    if (filters?.status) {
      query.status = filters.status;
    } else {
      // Default to active signals only
      query.status = 'active';
    }

    if (filters?.symbol) {
      query.symbol = filters.symbol.toUpperCase();
    }

    if (filters?.action) {
      query.action = filters.action;
    }

    // Filter out expired signals
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const signals = await Signal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return {
      success: true,
      data: signals.map((signal) => ({
        id: signal.signalId,
        signalId: signal.signalId,
        symbol: signal.symbol,
        ticker: signal.ticker,
        action: signal.action,
        price: signal.price,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        source: signal.source,
        status: signal.status,
        description: signal.description,
        timestamp: signal.createdAt,
        expiresAt: signal.expiresAt,
      })),
    };
  } catch (error: any) {
    console.error('getSignals error:', error);
    return { success: false, error: error.message || 'Failed to fetch signals' };
  }
}

/**
 * Get a single signal by ID
 */
export async function getSignalById(signalId: string): Promise<ActionResult<any>> {
  try {
    await connectToDatabase();

    const signal = await Signal.findOne({ signalId }).lean();

    if (!signal) {
      return { success: false, error: 'Signal not found' };
    }

    return {
      success: true,
      data: {
        id: signal.signalId,
        signalId: signal.signalId,
        symbol: signal.symbol,
        ticker: signal.ticker,
        action: signal.action,
        price: signal.price,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        source: signal.source,
        status: signal.status,
        description: signal.description,
        timestamp: signal.createdAt,
        expiresAt: signal.expiresAt,
      },
    };
  } catch (error: any) {
    console.error('getSignalById error:', error);
    return { success: false, error: error.message || 'Failed to fetch signal' };
  }
}

/**
 * Create a new signal
 */
export async function createSignal(input: {
  symbol: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  source?: 'manual' | 'algorithm' | 'external_api' | 'user_alert';
  description?: string;
  expiresAt?: Date;
  userId?: string;
}): Promise<ActionResult<{ signalId: string }>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const signalId = randomUUID();

    const signal = await Signal.create({
      signalId,
      userId: input.userId || user.id,
      symbol: input.symbol.toUpperCase(),
      ticker: input.ticker,
      action: input.action,
      price: input.price,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      source: input.source || 'manual',
      status: 'active',
      description: input.description,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/signals');
    return { success: true, data: { signalId: signal.signalId } };
  } catch (error: any) {
    console.error('createSignal error:', error);
    return { success: false, error: error.message || 'Failed to create signal' };
  }
}

/**
 * Update signal status
 */
export async function updateSignalStatus(
  signalId: string,
  status: 'active' | 'executed' | 'expired' | 'cancelled'
): Promise<ActionResult> {
  try {
    await connectToDatabase();

    await Signal.findOneAndUpdate(
      { signalId },
      { status, updatedAt: new Date() }
    );

    revalidatePath('/signals');
    return { success: true };
  } catch (error: any) {
    console.error('updateSignalStatus error:', error);
    return { success: false, error: error.message || 'Failed to update signal' };
  }
}

/**
 * Delete a signal
 */
export async function deleteSignal(signalId: string): Promise<ActionResult> {
  try {
    await connectToDatabase();

    await Signal.findOneAndDelete({ signalId });

    revalidatePath('/signals');
    return { success: true };
  } catch (error: any) {
    console.error('deleteSignal error:', error);
    return { success: false, error: error.message || 'Failed to delete signal' };
  }
}


