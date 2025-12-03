/**
 * MT5 Auto-Trade Settings Update API Route
 * Stores auto-trade settings for the user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import BotSettings from '@/database/models/bot-settings.model';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      enabled,
      symbol,
      riskPercent,
      lotSize,
      lotSizeMode, // 'auto' or 'fixed'
      takeProfit,
      stopLoss,
      magicNumber,
      maxDailyLoss,
      maxDailyTrades,
      newsFilter,
    } = body;

    await connectToDatabase();

    // Find or create bot settings
    const userId = session.user.id;
    let botSettings = await BotSettings.findOne({ userId });

    const settingsData: any = {
      userId,
      enabled: enabled ?? false,
      symbol: symbol || 'XAUUSD',
      riskPercent: riskPercent || 1,
      lotSize: lotSize || 0.01,
      lotSizeMode: lotSizeMode || 'auto',
      takeProfit: takeProfit || 0,
      stopLoss: stopLoss || 0,
      magicNumber: magicNumber || 2025,
      maxDailyLoss: maxDailyLoss || 0,
      maxDailyTrades: maxDailyTrades || 0,
      newsFilter: newsFilter ?? false,
      broker: 'exness',
      connectionType: 'mt5',
    };

    if (botSettings) {
      botSettings = await BotSettings.findOneAndUpdate(
        { userId },
        settingsData,
        { new: true }
      );
    } else {
      botSettings = await BotSettings.create(settingsData);
    }

    return NextResponse.json({
      success: true,
      data: botSettings,
    });
  } catch (error: any) {
    console.error('MT5 settings update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const userId = session.user.id;
    const botSettings = await BotSettings.findOne({ userId, broker: 'exness', connectionType: 'mt5' });

    if (!botSettings) {
      return NextResponse.json({
        success: true,
        data: {
          enabled: false,
          symbol: 'XAUUSD',
          riskPercent: 1,
          lotSize: 0.01,
          lotSizeMode: 'auto',
          takeProfit: 0,
          stopLoss: 0,
          magicNumber: 2025,
          maxDailyLoss: 0,
          maxDailyTrades: 0,
          newsFilter: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: botSettings,
    });
  } catch (error: any) {
    console.error('MT5 settings get error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

