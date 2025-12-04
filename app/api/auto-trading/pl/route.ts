/**
 * Update P/L API
 * Updates and returns current P/L metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { botManager } from '@/lib/services/bot-manager.service';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
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

    await connectToDatabase();

    // Get active bots for this user
    const activeBots = botManager.getUserBots(userId);
    
    // Get balance and positions from paper trader (prioritize active bot's paper trader)
    let balance: any = null;
    let currentRunningPL = 0;
    let openPositionsCount = 0;

    // Check if using paper trader (from active bots)
    for (const bot of activeBots) {
      if (bot.paperTrader && bot.broker === broker) {
        const ptBalance = bot.paperTrader.getBalance();
        balance = ptBalance;
        const ptPositions = bot.paperTrader.getOpenPositions();
        openPositionsCount = ptPositions.length;
        
        // Calculate running P/L from paper trader positions (uses real-time equity calculation)
        // PaperTrader already calculates unrealized P/L in getBalance()
        currentRunningPL = ptBalance.equity - ptBalance.balance;
        break; // Use first matching bot's paper trader
      }
    }

    // Fallback to adapter if no paper trader
    if (!balance && adapter) {
      try {
        balance = await adapter.getBalance();
        const openPositions = await adapter.getOpenPositions();
        openPositionsCount = openPositions.length;
        currentRunningPL = openPositions.reduce((sum, pos) => {
          return sum + (pos.unrealizedPnl || 0);
        }, 0);
      } catch (error) {
        console.error('Error getting balance from adapter:', error);
        // Use default balance
        balance = {
          balance: 10000,
          equity: 10000,
          margin: 0,
          freeMargin: 10000,
        };
      }
    }

    // Get closed trades from SignalistBotTrade (optimized query)
    const closedStatuses = ['CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'];
    
    const [closedTradesStats, openTradesCount] = await Promise.all([
      // Use aggregation for faster calculation
      SignalistBotTrade.aggregate([
        {
          $match: {
            userId,
            broker,
            status: { $in: closedStatuses },
            realizedPnl: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalTrades: { $sum: 1 },
            totalWins: {
              $sum: { $cond: [{ $gt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, 1, 0] }
            },
            totalLosses: {
              $sum: { $cond: [{ $lte: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, 1, 0] }
            },
            totalProfitLoss: { $sum: { $ifNull: ['$realizedPnl', 0] } }
          }
        }
      ]),
      // Count open trades
      SignalistBotTrade.countDocuments({
        userId,
        broker,
        status: 'OPEN'
      })
    ]);

    const stats = closedTradesStats[0] || {
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      totalProfitLoss: 0,
    };

    const totalWins = stats.totalWins || 0;
    const totalLosses = stats.totalLosses || 0;
    const totalTrades = stats.totalTrades || 0;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const totalProfitLoss = stats.totalProfitLoss || 0;
    
    // Update open positions count if we have open trades in database
    if (openTradesCount > 0) {
      openPositionsCount = openTradesCount;
    }

    const response = NextResponse.json({
      success: true,
      data: {
        currentRunningPL: parseFloat(currentRunningPL.toFixed(2)),
        balance: balance?.balance || 0,
        equity: balance?.equity || 0,
        margin: balance?.margin || 0,
        openPositions: openPositionsCount,
        totalWins,
        totalLosses,
        winRate: parseFloat(winRate.toFixed(2)),
        totalTrades,
        totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
        timestamp: new Date().toISOString(),
      },
    });

    // Add caching headers for better performance (short cache for real-time data)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: any) {
    console.error('Error updating P/L:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update P/L' },
      { status: 500 }
    );
  }
}

