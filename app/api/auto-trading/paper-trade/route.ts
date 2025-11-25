/**
 * Paper Trading API
 * POST: Execute paper trade
 * GET: Get paper trading status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';

// In-memory storage for paper traders (backed by database)
const paperTraders = new Map<string, PaperTrader>();

function getPaperTrader(userId: string, broker: 'exness' | 'deriv' | 'demo' = 'demo', initialBalance: number = 10000): PaperTrader {
  const key = `${userId}-${broker}`;
  if (!paperTraders.has(key)) {
    const trader = new PaperTrader(userId, broker, initialBalance);
    trader.initialize().catch(err => console.error('Error initializing paper trader:', err));
    paperTraders.set(key, trader);
  }
  return paperTraders.get(key)!;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const user = session.user;
    const broker = request.nextUrl.searchParams.get('broker') || 'demo';
    const brokerType = broker as 'exness' | 'deriv' | 'demo';
    const trader = getPaperTrader(user.id, brokerType);
    await trader.initialize();

    const balance = trader.getBalance();
    const history = trader.getHistory();
    const openPositions = trader.getOpenPositions();

    return NextResponse.json({
      success: true,
      data: {
        balance,
        history,
        openPositions,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get paper trading status' },
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
    const user = session.user;
    const body = await request.json();

    const { action, signal, marketData, initialBalance, broker } = body;
    
    // Ensure trader is initialized
    const brokerType = (broker || 'demo') as 'exness' | 'deriv' | 'demo';
    const trader = getPaperTrader(user.id, brokerType, initialBalance);
    await trader.initialize();

    if (action === 'reset') {
      await trader.reset(initialBalance || 10000);
      return NextResponse.json({ success: true, message: 'Paper trading account reset' });
    }

    if (action === 'execute' && signal && marketData) {
      const order = await trader.executeTrade(signal, marketData);
      
      // Update positions with latest market data
      await trader.updatePositions(marketData);

      return NextResponse.json({ success: true, data: order });
    }

    if (action === 'update' && marketData) {
      await trader.updatePositions(marketData);
      const balance = trader.getBalance();
      const openPositions = trader.getOpenPositions();

      return NextResponse.json({
        success: true,
        data: {
          balance,
          openPositions,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Paper trading error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Paper trading failed' },
      { status: 500 }
    );
  }
}

