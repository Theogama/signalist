/**
 * MT5 Auto-Trade Settings Update API Route
 * Stores auto-trade settings for the user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotSettings } from '@/database/models/signalist-bot-settings.model';

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

    // Find or create bot settings using SignalistBotSettings model
    const userId = session.user.id;
    const instrument = symbol || 'XAUUSD';
    const broker = 'exness';

    // Map fields to SignalistBotSettings schema
    const settingsData: any = {
      userId,
      broker,
      instrument,
      enabled: enabled ?? false,
      riskPerTrade: riskPercent || 1,
      maxDailyLoss: maxDailyLoss || 0,
      maxDailyTrades: maxDailyTrades || 0,
      magicNumber: magicNumber || 2025,
      // Map other fields that don't exist in SignalistBotSettings
      // Store as additional data or use defaults
      candleTimeframe: '5m',
      smaPeriod: 50,
      tpMultiplier: takeProfit > 0 ? (takeProfit / (stopLoss || 1)) : 3,
      slMethod: 'pips',
      slValue: stopLoss || 0,
      strategy: 'Signalist-SMA-3C',
      loggingLevel: 'info',
      fiveMinTrendConfirmation: true,
    };

    // Use findOneAndUpdate with upsert to handle create/update
    const botSettings = await SignalistBotSettings.findOneAndUpdate(
      { userId, broker, instrument },
      settingsData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Return data in the format expected by the frontend
    return NextResponse.json({
      success: true,
      data: {
        enabled: botSettings.enabled,
        symbol: botSettings.instrument,
        riskPercent: botSettings.riskPerTrade,
        lotSize: lotSize || 0.01, // Store separately or use default
        lotSizeMode: lotSizeMode || 'auto',
        takeProfit: (botSettings.tpMultiplier * (botSettings.slValue || 1)) || 0,
        stopLoss: botSettings.slValue || 0,
        magicNumber: botSettings.magicNumber || 2025,
        maxDailyLoss: botSettings.maxDailyLoss || 0,
        maxDailyTrades: botSettings.maxDailyTrades || 0,
        newsFilter: newsFilter ?? false,
      },
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
    const broker = 'exness';
    const instrument = 'XAUUSD'; // Default instrument
    
    const botSettings = await SignalistBotSettings.findOne({ 
      userId, 
      broker, 
      instrument 
    });

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

    // Map SignalistBotSettings to expected format
    return NextResponse.json({
      success: true,
      data: {
        enabled: botSettings.enabled,
        symbol: botSettings.instrument,
        riskPercent: botSettings.riskPerTrade,
        lotSize: 0.01, // Default, not stored in SignalistBotSettings
        lotSizeMode: 'auto', // Default, not stored in SignalistBotSettings
        takeProfit: (botSettings.tpMultiplier * (botSettings.slValue || 1)) || 0,
        stopLoss: botSettings.slValue || 0,
        magicNumber: botSettings.magicNumber || 2025,
        maxDailyLoss: botSettings.maxDailyLoss || 0,
        maxDailyTrades: botSettings.maxDailyTrades || 0,
        newsFilter: false, // Not stored in SignalistBotSettings
      },
    });
  } catch (error: any) {
    console.error('MT5 settings get error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


