/**
 * Update P/L API
 * Updates and returns current P/L metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { botManager } from '@/lib/services/bot-manager.service';
import { BotTrade } from '@/database/models/bot-trade.model';
import { connectToDatabase } from '@/database/mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const broker = searchParams.get('broker') as 'exness' | 'deriv' | null;

    if (!broker) {
      return NextResponse.json(
        { success: false, error: 'Missing broker parameter' },
        { status: 400 }
      );
    }

    // Get adapter and calculate P/L
    const adapter = sessionManager.getUserAdapter(userId, broker);
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Broker not connected' },
        { status: 400 }
      );
    }

    // Get balance and positions from adapter or paper trader
    let balance;
    let openPositions = [];
    let currentRunningPL = 0;

    // Check if using paper trader (from active bots)
    const activeBots = botManager.getUserBots(userId);
    let paperTraderBalance: any = null;

    for (const bot of activeBots) {
      if (bot.paperTrader) {
        const ptBalance = bot.paperTrader.getBalance();
        paperTraderBalance = ptBalance;
        const ptPositions = bot.paperTrader.getOpenPositions();
        
        // Calculate running P/L from paper trader positions
        for (const pos of ptPositions) {
          // Get current market price for unrealized P/L calculation
          // For now, use entry price as current (will be updated with real market data)
          const entryPrice = pos.position.entryPrice;
          const currentPrice = entryPrice; // TODO: Get real market price
          
          // Calculate unrealized P/L
          const quantity = pos.position.quantity;
          const side = pos.position.side;
          let unrealizedPnl = 0;
          
          if (side === 'BUY') {
            unrealizedPnl = (currentPrice - entryPrice) * quantity;
          } else {
            unrealizedPnl = (entryPrice - currentPrice) * quantity;
          }
          
          currentRunningPL += unrealizedPnl;
        }
        break; // Use first active bot's paper trader
      }
    }

    if (!paperTraderBalance && adapter) {
      balance = await adapter.getBalance();
      openPositions = await adapter.getOpenPositions();
      currentRunningPL = openPositions.reduce((sum, pos) => {
        return sum + (pos.unrealizedPnl || 0);
      }, 0);
    } else if (paperTraderBalance) {
      balance = paperTraderBalance;
    }

    // Get historical trades from database
    await connectToDatabase();
    const brokerName = broker || 'demo';
    
    const closedTrades = await BotTrade.find({
      userId,
      $or: [
        { exchange: brokerName },
        { exchange: broker },
      ],
      status: { $in: ['CLOSED', 'FILLED'] },
      exitPrice: { $exists: true, $ne: null },
      closedAt: { $exists: true, $ne: null },
    })
      .sort({ closedAt: -1 })
      .lean();

    // Calculate metrics from closed trades
    const totalWins = closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
    const totalLosses = closedTrades.filter(t => (t.profitLoss || 0) <= 0).length;
    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const totalProfitLoss = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    // Also get open positions count from paper trader if available
    let openPositionsCount = openPositions.length;
    if (activeBots.length > 0 && activeBots[0].paperTrader) {
      openPositionsCount = activeBots[0].paperTrader.getOpenPositions().length;
    }

    return NextResponse.json({
      success: true,
      data: {
        currentRunningPL,
        balance: balance?.balance || 0,
        equity: balance?.equity || 0,
        margin: balance?.margin || 0,
        openPositions: openPositionsCount,
        totalWins,
        totalLosses,
        winRate,
        totalTrades,
        totalProfitLoss,
      },
    });
  } catch (error: any) {
    console.error('Error updating P/L:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update P/L' },
      { status: 500 }
    );
  }
}

