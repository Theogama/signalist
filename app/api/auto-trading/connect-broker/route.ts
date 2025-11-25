/**
 * Connect Broker API
 * POST: Connect to Exness or Deriv broker
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';

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
    const { broker, apiKey, apiSecret, demo } = body;

    if (!broker || (broker !== 'exness' && broker !== 'deriv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Must be "exness" or "deriv"' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const isDemo = demo !== false && (!apiKey || !apiSecret);

    // Create adapter instance
    let adapter;
    if (broker === 'exness') {
      adapter = new ExnessAdapter();
    } else {
      adapter = new DerivAdapter();
    }

    // Initialize adapter
    try {
      if (isDemo) {
        // Demo mode - no authentication required
        await adapter.initialize({
          apiKey: '',
          apiSecret: '',
          environment: 'demo',
        });
        adapter.setPaperTrading(true);
      } else {
        // Live mode - authenticate with API keys
        await adapter.initialize({
          apiKey: apiKey || '',
          apiSecret: apiSecret || '',
          environment: 'live',
        });
        await adapter.authenticate();
        adapter.setPaperTrading(false);
      }

      // Store adapter in session manager
      sessionManager.setUserAdapter(userId, broker, adapter);

      // Get account balance
      let balance;
      try {
        const accountBalance = await adapter.getBalance();
        balance = accountBalance;
      } catch (error) {
        // Fallback to demo balance if real balance fetch fails
        balance = {
          balance: 10000,
          equity: 10000,
          margin: 0,
          freeMargin: 10000,
          currency: 'USD',
        };
      }

      // Get available instruments
      let instruments: string[] = [];
      try {
        if (broker === 'exness') {
          instruments = ['XAUUSD', 'US30', 'NAS100'];
        } else {
          instruments = [
            'BOOM1000', 'BOOM500', 'BOOM300', 'BOOM100',
            'CRASH1000', 'CRASH500', 'CRASH300', 'CRASH100',
          ];
        }
      } catch (error) {
        console.error('Error fetching instruments:', error);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully connected to ${broker.toUpperCase()}${isDemo ? ' (Demo Mode)' : ''}`,
        data: {
          broker,
          demo: isDemo,
          balance,
          instruments,
          connectedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error(`Error connecting to ${broker}:`, error);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to connect to ${broker}: ${error.message || 'Authentication failed'}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in connect-broker route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
