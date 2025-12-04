/**
 * Start Bot API
 * POST: Start the trading bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotSettings } from '@/database/models/signalist-bot-settings.model';
import { botManager } from '@/lib/signalist-bot/engine/bot-manager';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const userId = session.user.id;

    // Check if bot is already running
    if (botManager.isBotRunning(userId)) {
      return NextResponse.json(
        { success: false, error: 'Bot is already running' },
        { status: 400 }
      );
    }

    // Get settings
    const settingsDoc = await SignalistBotSettings.findOne({
      userId,
      broker: body.broker,
      instrument: body.instrument,
    }).select('+mt5Password +derivToken'); // Include credentials

    if (!settingsDoc) {
      return NextResponse.json(
        { success: false, error: 'Bot settings not found. Please configure settings first.' },
        { status: 404 }
      );
    }

    if (!settingsDoc.enabled) {
      return NextResponse.json(
        { success: false, error: 'Bot is not enabled. Please enable it in settings.' },
        { status: 400 }
      );
    }

    // Validate broker credentials
    if (settingsDoc.broker === 'exness') {
      if (!settingsDoc.mt5Login || !settingsDoc.mt5Password || !settingsDoc.mt5Server) {
        return NextResponse.json(
          { success: false, error: 'MT5 credentials are missing' },
          { status: 400 }
        );
      }
    } else if (settingsDoc.broker === 'deriv') {
      if (!settingsDoc.derivToken) {
        return NextResponse.json(
          { success: false, error: 'Deriv token is missing' },
          { status: 400 }
        );
      }
    }

    // Convert to settings object
    const settings = settingsDoc.toObject() as any;

    // Start bot
    await botManager.startBot(settings);

    return NextResponse.json({
      success: true,
      message: 'Bot started successfully',
    });
  } catch (error: any) {
    console.error('[Start Bot API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start bot' },
      { status: 500 }
    );
  }
}


