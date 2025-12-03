/**
 * Positions API
 * GET: Get open positions and account status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
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

    const userId = session.user.id;
    const activeBots = botManager.getUserBots(userId);

    const openTrades: any[] = [];
    const closedTrades: any[] = [];
    let totalBalance = 0;
    let totalEquity = 0;
    let totalMargin = 0;

    // If no active bots, return default values
    if (activeBots.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          openTrades: [],
          closedTrades: [],
          balance: {
            balance: 10000,
            equity: 10000,
            margin: 0,
            freeMargin: 10000,
          },
        },
      });
    }

    for (const bot of activeBots) {
      if (bot.paperTrader) {
        // Get fresh balance (recalculates equity with current market prices)
        const balance = bot.paperTrader.getBalance();
        totalBalance += balance.balance;
        totalEquity += balance.equity;
        totalMargin += balance.margin;

        // Get open positions as trades
        const openPositions = bot.paperTrader.getOpenPositions();
        openTrades.push(...openPositions.map((p) => ({
          id: p.tradeId,
          symbol: p.position.symbol || bot.instrument,
          side: p.position.side || 'BUY',
          entryPrice: p.position.entryPrice,
          quantity: p.position.quantity,
          status: 'OPEN' as const,
          openedAt: p.position.openedAt || new Date(),
        })));

        // Get closed trades from history
        const history = bot.paperTrader.getHistory();
        closedTrades.push(...history.slice(-20).map((trade) => ({
          id: trade.tradeId,
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          quantity: trade.quantity,
          profitLoss: trade.profitLoss,
          status: trade.status === 'TAKE_PROFIT' ? 'CLOSED' as const : 
                  trade.status === 'STOPPED' ? 'STOPPED' as const : 'CLOSED' as const,
          openedAt: trade.openedAt,
          closedAt: trade.closedAt,
        })));
      }
    }

    // Use first bot's balance if multiple bots (or aggregate if needed)
    // For now, if we have at least one bot, use its balance
    const finalBalance = totalBalance > 0 ? totalBalance : 10000;
    const finalEquity = totalEquity > 0 ? totalEquity : 10000;
    const finalMargin = totalMargin;
    const finalFreeMargin = Math.max(0, finalEquity - finalMargin);

    return NextResponse.json({
      success: true,
      data: {
        openTrades,
        closedTrades,
        balance: {
          balance: finalBalance,
          equity: finalEquity,
          margin: finalMargin,
          freeMargin: finalFreeMargin,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}

