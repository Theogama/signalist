/**
 * Trading Statistics API
 * GET: Get persistent trading statistics from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DemoAccount } from '@/database/models/demo-account.model';

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

    const userId = session.user.id;
    const broker = request.nextUrl.searchParams.get('broker') as 'exness' | 'deriv' | null;

    // Build query
    const tradeQuery: any = { userId };
    if (broker) {
      tradeQuery.broker = broker;
    }

    // Get all trades from database
    const allTrades = await SignalistBotTrade.find(tradeQuery)
      .sort({ entryTimestamp: -1 })
      .lean();

    // Calculate statistics
    const closedTrades = allTrades.filter(t => 
      ['CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'].includes(t.status)
    );
    const openTrades = allTrades.filter(t => t.status === 'OPEN');

    // Calculate P/L metrics
    const totalProfitLoss = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
    const winRate = closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : 0;

    // Calculate average profit/loss
    const avgProfit = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.realizedPnl || 0), 0) / losingTrades.length
      : 0;

    // Calculate profit factor
    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? Infinity : 0);

    // Get account data
    const accountQuery: any = { userId };
    if (broker) {
      accountQuery.broker = broker;
    } else {
      accountQuery.broker = { $in: ['exness', 'deriv', 'demo'] };
    }

    const accounts = await DemoAccount.find(accountQuery).lean();
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0);
    const totalInitialBalance = accounts.reduce((sum, acc) => sum + acc.initialBalance, 0);

    // Calculate return on investment
    const totalROI = totalInitialBalance > 0 
      ? ((totalBalance - totalInitialBalance) / totalInitialBalance) * 100 
      : 0;

    // Get recent trades (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTrades = closedTrades.filter(t => 
      t.exitTimestamp && new Date(t.exitTimestamp) >= thirtyDaysAgo
    );
    const recentPL = recentTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

    // Get daily statistics
    const dailyStats: Record<string, { trades: number; profitLoss: number }> = {};
    closedTrades.forEach(trade => {
      if (trade.exitTimestamp) {
        const date = new Date(trade.exitTimestamp).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { trades: 0, profitLoss: 0 };
        }
        dailyStats[date].trades += 1;
        dailyStats[date].profitLoss += trade.realizedPnl || 0;
      }
    });

    // Get best and worst trades
    const bestTrade = closedTrades.length > 0
      ? closedTrades.reduce((best, t) => 
          (t.realizedPnl || 0) > (best.realizedPnl || 0) ? t : best
        )
      : null;
    const worstTrade = closedTrades.length > 0
      ? closedTrades.reduce((worst, t) => 
          (t.realizedPnl || 0) < (worst.realizedPnl || 0) ? t : worst
        )
      : null;

    // Calculate longest winning/losing streaks
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    closedTrades.forEach(trade => {
      if ((trade.realizedPnl || 0) > 0) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
      } else if ((trade.realizedPnl || 0) < 0) {
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        // Overall statistics
        totalTrades: closedTrades.length,
        openTrades: openTrades.length,
        totalProfitLoss,
        totalROI,
        
        // Win/Loss metrics
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        
        // Average metrics
        avgProfit: parseFloat(avgProfit.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        
        // Streaks
        maxWinStreak,
        maxLossStreak,
        
        // Account metrics
        totalBalance: parseFloat(totalBalance.toFixed(2)),
        totalEquity: parseFloat(totalEquity.toFixed(2)),
        totalInitialBalance: parseFloat(totalInitialBalance.toFixed(2)),
        
        // Recent performance (30 days)
        recentTrades: recentTrades.length,
        recentProfitLoss: parseFloat(recentPL.toFixed(2)),
        
        // Best/Worst trades
        bestTrade: bestTrade ? {
          symbol: bestTrade.symbol,
          side: bestTrade.side,
          profitLoss: bestTrade.realizedPnl,
          date: bestTrade.exitTimestamp,
        } : null,
        worstTrade: worstTrade ? {
          symbol: worstTrade.symbol,
          side: worstTrade.side,
          profitLoss: worstTrade.realizedPnl,
          date: worstTrade.exitTimestamp,
        } : null,
        
        // Daily statistics
        dailyStats: Object.entries(dailyStats)
          .map(([date, stats]) => ({
            date,
            trades: stats.trades,
            profitLoss: parseFloat(stats.profitLoss.toFixed(2)),
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30), // Last 30 days
      },
    });
  } catch (error: any) {
    console.error('Error fetching trading statistics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

