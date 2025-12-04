/**
 * Bot Settings API
 * POST: Save/Update bot settings
 * GET: Get bot settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotSettings } from '@/database/models/signalist-bot-settings.model';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const userId = session.user.id;

    // Validate required fields
    if (!body.broker || !body.instrument) {
      return NextResponse.json(
        { success: false, error: 'Broker and instrument are required' },
        { status: 400 }
      );
    }

    // Validate broker
    if (!['exness', 'deriv'].includes(body.broker)) {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Must be "exness" or "deriv"' },
        { status: 400 }
      );
    }

    // Validate risk per trade (1-50%)
    if (body.riskPerTrade !== undefined && (body.riskPerTrade < 1 || body.riskPerTrade > 50)) {
      return NextResponse.json(
        { success: false, error: 'Risk per trade must be between 1% and 50%' },
        { status: 400 }
      );
    }

    // Find or create settings
    const existingSettings = await SignalistBotSettings.findOne({
      userId,
      broker: body.broker,
      instrument: body.instrument,
    });

    const settingsData = {
      userId,
      broker: body.broker,
      instrument: body.instrument,
      enabled: body.enabled !== undefined ? body.enabled : false,
      riskPerTrade: body.riskPerTrade || 10,
      maxDailyLoss: body.maxDailyLoss || 0,
      maxDailyTrades: body.maxDailyTrades || 0,
      tradeFrequency: 'once-per-candle',
      candleTimeframe: body.candleTimeframe || '5m',
      smaPeriod: body.smaPeriod || 50,
      smaPeriod2: body.smaPeriod2,
      tpMultiplier: body.tpMultiplier || 3,
      slMethod: body.slMethod || 'atr',
      slValue: body.slValue,
      atrPeriod: body.atrPeriod || 14,
      spikeDetectionEnabled: body.spikeDetectionEnabled || false,
      spikeThreshold: body.spikeThreshold,
      strategy: body.strategy || 'Signalist-SMA-3C',
      magicNumber: body.magicNumber,
      loggingLevel: body.loggingLevel || 'info',
      forceStopDrawdown: body.forceStopDrawdown,
      forceStopConsecutiveLosses: body.forceStopConsecutiveLosses,
      minTimeInTrade: body.minTimeInTrade || 1,
      smaCrossLookback: body.smaCrossLookback || 8,
      fiveMinTrendConfirmation: body.fiveMinTrendConfirmation !== false,
      // Broker credentials
      mt5Login: body.mt5Login,
      mt5Password: body.mt5Password,
      mt5Server: body.mt5Server,
      derivToken: body.derivToken,
    };

    let settings;
    if (existingSettings) {
      settings = await SignalistBotSettings.findOneAndUpdate(
        { userId, broker: body.broker, instrument: body.instrument },
        settingsData,
        { new: true }
      );
    } else {
      settings = await SignalistBotSettings.create(settingsData);
    }

    // Don't return sensitive fields
    const responseSettings = settings.toObject();
    delete responseSettings.mt5Password;
    delete responseSettings.derivToken;

    return NextResponse.json({
      success: true,
      settings: responseSettings,
    });
  } catch (error: any) {
    console.error('[BotSettings API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const broker = searchParams.get('broker');
    const instrument = searchParams.get('instrument');

    const query: any = { userId };
    if (broker) query.broker = broker;
    if (instrument) query.instrument = instrument;

    const settings = await SignalistBotSettings.find(query).select('-mt5Password -derivToken').sort({ updatedAt: -1 });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[BotSettings API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get settings' },
      { status: 500 }
    );
  }
}


