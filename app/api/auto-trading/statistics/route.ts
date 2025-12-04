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
    const matchQuery: any = { userId };
    if (broker) {
      matchQuery.broker = broker;
    }

    // Use MongoDB aggregation for efficient calculations
    const closedStatuses = ['CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'];
    
    // Aggregation pipeline for closed trades statistics
    const closedTradesStats = await SignalistBotTrade.aggregate([
      { $match: { ...matchQuery, status: { $in: closedStatuses } } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          totalProfitLoss: { $sum: { $ifNull: ['$realizedPnl', 0] } },
          winningTrades: {
            $sum: { $cond: [{ $gt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, 1, 0] }
          },
          losingTrades: {
            $sum: { $cond: [{ $lt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, 1, 0] }
          },
          totalProfit: {
            $sum: { $cond: [{ $gt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, { $ifNull: ['$realizedPnl', 0] }, 0] }
          },
          totalLoss: {
            $sum: { $cond: [{ $lt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, { $abs: { $ifNull: ['$realizedPnl', 0] } }, 0] }
          },
          avgProfit: {
            $avg: { $cond: [{ $gt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, { $ifNull: ['$realizedPnl', 0] }, null] }
          },
          avgLoss: {
            $avg: { $cond: [{ $lt: [{ $ifNull: ['$realizedPnl', 0] }, 0] }, { $abs: { $ifNull: ['$realizedPnl', 0] } }, null] }
          },
          bestTrade: { $max: '$realizedPnl' },
          worstTrade: { $min: '$realizedPnl' },
        }
      }
    ]);

    // Get open trades count
    const openTradesCount = await SignalistBotTrade.countDocuments({ ...matchQuery, status: 'OPEN' });

    // Get best and worst trades with details
    const [bestTrade, worstTrade] = await Promise.all([
      SignalistBotTrade.findOne({ ...matchQuery, status: { $in: closedStatuses } })
        .sort({ realizedPnl: -1 })
        .lean(),
      SignalistBotTrade.findOne({ ...matchQuery, status: { $in: closedStatuses } })
        .sort({ realizedPnl: 1 })
        .lean(),
    ]);

    // Calculate metrics from aggregation results
    const stats = closedTradesStats[0] || {
      totalTrades: 0,
      totalProfitLoss: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      avgProfit: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
    };

    const totalProfitLoss = stats.totalProfitLoss || 0;
    const winningTrades = stats.winningTrades || 0;
    const losingTrades = stats.losingTrades || 0;
    const winRate = stats.totalTrades > 0 ? (winningTrades / stats.totalTrades) * 100 : 0;
    const avgProfit = stats.avgProfit || 0;
    const avgLoss = stats.avgLoss || 0;
    const totalProfit = stats.totalProfit || 0;
    const totalLoss = stats.totalLoss || 0;
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

    // Get recent trades (last 30 days) using aggregation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentStats = await SignalistBotTrade.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: closedStatuses },
          exitTimestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          recentTrades: { $sum: 1 },
          recentPL: { $sum: { $ifNull: ['$realizedPnl', 0] } }
        }
      }
    ]);

    const recentTradesCount = recentStats[0]?.recentTrades || 0;
    const recentPL = recentStats[0]?.recentPL || 0;

    // Get daily statistics using aggregation
    const dailyStatsAgg = await SignalistBotTrade.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: closedStatuses },
          exitTimestamp: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$exitTimestamp' } },
          trades: { $sum: 1 },
          profitLoss: { $sum: { $ifNull: ['$realizedPnl', 0] } }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    const dailyStats = dailyStatsAgg.map(item => ({
      date: item._id,
      trades: item.trades,
      profitLoss: parseFloat(item.profitLoss.toFixed(2)),
    }));

    // Calculate streaks - need to fetch trades sorted by exit time
    const tradesForStreaks = await SignalistBotTrade.find({
      ...matchQuery,
      status: { $in: closedStatuses },
      exitTimestamp: { $exists: true }
    })
      .sort({ exitTimestamp: 1 })
      .select('realizedPnl')
      .lean()
      .limit(1000); // Limit for performance

    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    tradesForStreaks.forEach((trade: any) => {
      const pnl = trade.realizedPnl || 0;
      if (pnl > 0) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
      } else if (pnl < 0) {
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
      }
    });

    const response = NextResponse.json({
      success: true,
      data: {
        // Overall statistics
        totalTrades: stats.totalTrades || 0,
        openTrades: openTradesCount,
        totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
        totalROI,
        
        // Win/Loss metrics
        winningTrades,
        losingTrades,
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : 0,
        
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
        recentTrades: recentTradesCount,
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
        dailyStats,
      },
    });

    // Add caching headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10');
    
    return response;
  } catch (error: any) {
    console.error('Error fetching trading statistics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}


