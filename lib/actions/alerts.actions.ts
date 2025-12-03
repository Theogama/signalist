'use server';

import { connectToDatabase } from '@/database/mongoose';
import { PriceAlert, type PriceAlertDoc } from '@/database/models/alert.model';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';

type CreatePriceAlertInput = {
  symbol: string;
  company: string;
  targetPrice: number;
  condition: 'greater' | 'less';
};

type ActionResult<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; data?: T; error?: string };

async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) redirect('/sign-in');

  return session.user;
}

const WATCHLIST_PATH = '/watchlist';

export async function getUserAlerts(): Promise<AlertsListItem[]> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const alerts = await PriceAlert.find({ userId: user.id }).sort({ createdAt: -1 }).lean<PriceAlertDoc[]>();

    return alerts.map((alert) => ({
      _id: String(alert._id),
      symbol: alert.symbol,
      company: alert.company,
      targetPrice: alert.targetPrice,
      condition: alert.condition,
      active: alert.active,
      createdAt: alert.createdAt,
    }));
  } catch (error) {
    console.error('getUserAlerts error:', error);
    throw new Error('Failed to fetch alerts');
  }
}

export async function getUserAlertsWithStockData(): Promise<(AlertsListItem & { currentPrice?: number; changePercent?: number })[]> {
  try {
    const alerts = await getUserAlerts();
    const { getStockDetails } = await import('@/lib/actions/finnhub.actions');

    const enriched = await Promise.allSettled(
      alerts.map(async (alert) => {
        try {
          const stockData = await getStockDetails(alert.symbol);
          return {
            ...alert,
            currentPrice: stockData.currentPrice,
            changePercent: stockData.changePercent,
          };
        } catch (e) {
          console.error(`Error fetching stock data for ${alert.symbol}:`, e);
          return {
            ...alert,
            currentPrice: undefined,
            changePercent: undefined,
          };
        }
      })
    );

    const fulfilledResults = enriched.filter((result) => result.status === 'fulfilled');
    return fulfilledResults.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // TypeScript guard - this should never execute
      throw new Error('Unexpected rejected promise');
    });
  } catch (error) {
    console.error('getUserAlertsWithStockData error:', error);
    return [];
  }
}

export async function createPriceAlert(input: CreatePriceAlertInput): Promise<ActionResult<AlertsListItem>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const symbol = input.symbol?.trim().toUpperCase();
    const company = input.company?.trim();
    const condition = input.condition;
    const targetPrice = Number(input.targetPrice);

    if (!symbol || !company) {
      return { success: false, error: 'Symbol and company are required' };
    }

    if (!['greater', 'less'].includes(condition)) {
      return { success: false, error: 'Invalid alert condition' };
    }

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      return { success: false, error: 'Enter a valid price greater than 0' };
    }

    const alert = await PriceAlert.create({
      userId: user.id,
      symbol,
      company,
      targetPrice,
      condition,
      active: true,
    });

    await revalidatePath(WATCHLIST_PATH);

    return {
      success: true,
      data: {
        _id: String(alert._id),
        symbol: alert.symbol,
        company: alert.company,
        targetPrice: alert.targetPrice,
        condition: alert.condition,
        active: alert.active,
        createdAt: alert.createdAt,
      },
    };
  } catch (error) {
    console.error('createPriceAlert error:', error);
    return { success: false, error: 'Failed to create alert' };
  }
}

export async function toggleAlertActive(alertId: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    if (!Types.ObjectId.isValid(alertId)) {
      return { success: false, error: 'Invalid alert id' };
    }

    const updated = await PriceAlert.findOneAndUpdate(
      { _id: alertId, userId: user.id },
      { active },
      { new: true }
    );

    if (!updated) {
      return { success: false, error: 'Alert not found' };
    }

    await revalidatePath(WATCHLIST_PATH);
    return { success: true };
  } catch (error) {
    console.error('toggleAlertActive error:', error);
    return { success: false, error: 'Failed to update alert' };
  }
}

export async function deleteAlert(alertId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    if (!Types.ObjectId.isValid(alertId)) {
      return { success: false, error: 'Invalid alert id' };
    }

    const deleted = await PriceAlert.findOneAndDelete({ _id: alertId, userId: user.id });

    if (!deleted) {
      return { success: false, error: 'Alert not found' };
    }

    await revalidatePath(WATCHLIST_PATH);
    return { success: true };
  } catch (error) {
    console.error('deleteAlert error:', error);
    return { success: false, error: 'Failed to delete alert' };
  }
}

