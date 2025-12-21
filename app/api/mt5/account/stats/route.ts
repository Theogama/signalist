/**
 * MT5 Account Stats API Route
 * Returns comprehensive account statistics including P/L, win/loss, drawdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const connection_id = request.nextUrl.searchParams.get('connection_id');

    if (!connection_id) {
      return NextResponse.json(
        { success: false, error: 'Missing connection_id' },
        { status: 400 }
      );
    }

    // Fetch account info and trades in parallel
    const [accountResponse, openTradesResponse, closedTradesResponse] = await Promise.all([
      fetch(`${MT5_SERVICE_URL}/account?connection_id=${connection_id}`),
      fetch(`${MT5_SERVICE_URL}/trades/open?connection_id=${connection_id}`),
      fetch(`${MT5_SERVICE_URL}/trades/closed?connection_id=${connection_id}`),
    ]);

    const accountData = await accountResponse.json();
    const openTradesData = await openTradesResponse.json();
    const closedTradesData = await closedTradesResponse.json();

    if (!accountData.success) {
      return NextResponse.json(accountData, { status: 400 });
    }

    // Calculate statistics
    const openTrades = openTradesData.success ? openTradesData.positions || [] : [];
    const closedTrades = closedTradesData.success ? closedTradesData.deals || [] : [];

    // Calculate win/loss
    const winningTrades = closedTrades.filter((t: any) => t.profit > 0);
    const losingTrades = closedTrades.filter((t: any) => t.profit < 0);
    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    // Calculate total P/L
    const totalProfit = closedTrades.reduce((sum: number, t: any) => sum + (t.profit || 0), 0);
    const unrealizedProfit = openTrades.reduce((sum: number, t: any) => sum + (t.profit || 0), 0);
    const totalPL = totalProfit + unrealizedProfit;

    // Calculate drawdown
    let peak = accountData.account.balance;
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    // Simple drawdown calculation based on equity
    const equity = accountData.account.equity;
    if (equity < peak) {
      currentDrawdown = ((peak - equity) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }

    return NextResponse.json({
      success: true,
      data: {
        account: accountData.account,
        stats: {
          balance: accountData.account.balance,
          equity: accountData.account.equity,
          margin: accountData.account.margin,
          freeMargin: accountData.account.free_margin,
          marginLevel: accountData.account.margin_level,
          currency: accountData.account.currency,
          leverage: accountData.account.leverage,
        },
        trades: {
          open: openTrades.length,
          closed: closedTrades.length,
          total: totalTrades,
        },
        performance: {
          totalPL,
          realizedPL: totalProfit,
          unrealizedPL: unrealizedProfit,
          winRate: winRate.toFixed(2),
          wins: winningTrades.length,
          losses: losingTrades.length,
          maxDrawdown: maxDrawdown.toFixed(2),
          currentDrawdown: currentDrawdown.toFixed(2),
        },
        openTrades,
        closedTrades: closedTrades.slice(0, 100), // Limit to last 100
      },
    });
  } catch (error: any) {
    console.error('MT5 account stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








