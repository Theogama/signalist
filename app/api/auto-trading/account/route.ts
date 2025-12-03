/**
 * Demo Account API
 * GET: Get demo account balance and stats
 * POST: Reset demo account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DemoAccount } from '@/database/models/demo-account.model';
import { connectToDatabase } from '@/database/mongoose';
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';
import { botManager } from '@/lib/services/bot-manager.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const broker = request.nextUrl.searchParams.get('broker') || 'demo';
    const brokerType = broker as 'exness' | 'deriv' | 'demo';

    // Try to get balance from active PaperTrader (if bot is running)
    const userBots = botManager.getUserBots(session.user.id);
    let balanceData = null;

    // Check if there's an active bot with PaperTrader for this broker
    // Prioritize bot that matches the requested broker
    for (const bot of userBots) {
      if (bot.paperTrader && bot.isRunning) {
        // Get balance from PaperTrader (this recalculates equity with latest prices)
        // PaperTrader recalculates equity on getBalance() call
        balanceData = bot.paperTrader.getBalance();
        // If broker matches, use this one; otherwise continue to find matching broker
        if (bot.broker === brokerType || brokerType === 'demo') {
          break;
        }
      }
    }
    
    // If no running bot found, try to find any bot with PaperTrader (even if not running)
    if (!balanceData) {
      for (const bot of userBots) {
        if (bot.paperTrader) {
          balanceData = bot.paperTrader.getBalance();
          if (bot.broker === brokerType || brokerType === 'demo') {
            break;
          }
        }
      }
    }

    // If no active PaperTrader, try to get from database or create new PaperTrader instance
    if (!balanceData) {
      const account = await DemoAccount.findOne({ 
        userId: session.user.id, 
        broker: brokerType 
      });

      if (account) {
        // Create PaperTrader instance to get properly calculated balance
        const trader = new PaperTrader(session.user.id, brokerType, account.initialBalance);
        await trader.initialize();
        balanceData = trader.getBalance();
      } else {
        // Create default account if doesn't exist
        const newAccount = await DemoAccount.create({
          userId: session.user.id,
          broker: brokerType,
          balance: 10000,
          equity: 10000,
          margin: 0,
          freeMargin: 10000,
          initialBalance: 10000,
          currency: 'USD',
        });

        balanceData = {
          balance: newAccount.balance,
          equity: newAccount.equity,
          margin: newAccount.margin,
          freeMargin: newAccount.freeMargin,
          currency: newAccount.currency,
        };
      }
    }

    // Get account stats from database
    const account = await DemoAccount.findOne({ 
      userId: session.user.id, 
      broker: brokerType 
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: balanceData.balance,
        equity: balanceData.equity,
        margin: balanceData.margin,
        freeMargin: balanceData.freeMargin,
        currency: balanceData.currency || 'USD',
        marginLevel: balanceData.marginLevel,
        initialBalance: account?.initialBalance || 10000,
        totalProfitLoss: account?.totalProfitLoss || 0,
        totalTrades: account?.totalTrades || 0,
        winningTrades: account?.winningTrades || 0,
        losingTrades: account?.losingTrades || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching demo account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, initialBalance, broker } = body;

    await connectToDatabase();

    const brokerType = (broker || 'demo') as 'exness' | 'deriv' | 'demo';
    const balance = initialBalance || 10000;

    if (action === 'reset') {
      const account = await DemoAccount.findOneAndUpdate(
        { userId: session.user.id, broker: brokerType },
        {
          balance,
          equity: balance,
          margin: 0,
          freeMargin: balance,
          initialBalance: balance,
          totalProfitLoss: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Demo account reset successfully',
        data: {
          balance: account.balance,
          equity: account.equity,
          margin: account.margin,
          freeMargin: account.freeMargin,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error resetting demo account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset account' },
      { status: 500 }
    );
  }
}

