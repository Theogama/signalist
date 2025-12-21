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
    const { searchParams } = new URL(request.url);
    const broker = searchParams.get('broker') as 'exness' | 'deriv' | null;
    
    const activeBots = botManager.getUserBots(userId);

    const openTrades: any[] = [];
    const closedTrades: any[] = [];
    let totalBalance = 0;
    let totalEquity = 0;
    let totalMargin = 0;

    // Only fetch Deriv trades if explicitly requested or if no other broker data exists
    // This reduces unnecessary database queries
    const shouldFetchDeriv = broker === 'deriv' || (!broker && activeBots.length === 0);
    
    if (shouldFetchDeriv) {
      try {
        const { syncDerivPositions } = await import('@/lib/services/deriv-trading.service');
        const derivPositions = await syncDerivPositions(userId, ''); // API key not needed for DB fetch
        
        // Add Deriv trades
        if (derivPositions.openTrades.length > 0) {
          openTrades.push(...derivPositions.openTrades);
        }
        if (derivPositions.closedTrades.length > 0) {
          closedTrades.push(...derivPositions.closedTrades);
        }
      } catch (error) {
        console.error('[Positions API] Error fetching Deriv positions:', error);
        // Continue even if Deriv fetch fails
      }
    }

    // If no active bots and no Deriv trades, return default values
    if (activeBots.length === 0 && openTrades.length === 0 && closedTrades.length === 0) {
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

    // If we have Deriv trades but no active bots, try to get balance from DemoAccount
    if (shouldFetchDeriv && (openTrades.length > 0 || closedTrades.length > 0) && totalBalance === 0) {
      try {
        // Ensure database is connected before querying
        const { DemoAccount } = await import('@/database/models/demo-account.model');
        const { connectToDatabase } = await import('@/database/mongoose');
        
        // Connect to database (idempotent, safe to call multiple times)
        await connectToDatabase();
        
        const account = await DemoAccount.findOne({ userId, broker: 'deriv' });
        if (account) {
          totalBalance = account.balance || 0;
          totalEquity = account.equity || 0;
          totalMargin = account.margin || 0;
        }
      } catch (error) {
        console.error('[Positions API] Error fetching Deriv account:', error);
        // Continue with default values if error occurs
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

