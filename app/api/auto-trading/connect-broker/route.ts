/**
 * Connect Broker API
 * POST: Connect to Exness (via MT5) or Deriv broker
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

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
    const { broker, login, password, server, apiKey, apiSecret, demo } = body;

    if (!broker || (broker !== 'exness' && broker !== 'deriv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Must be "exness" or "deriv"' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Exness connection - REQUIRES MT5 credentials (no demo mode)
    if (broker === 'exness') {
      // Exness MUST have MT5 credentials
      if (!login || !password || !server) {
        return NextResponse.json(
          { success: false, error: 'Exness requires MT5 connection. Please provide login, password, and server.' },
          { status: 400 }
        );
      }

      // Validate server
      const validServers = ['Exness-MT5Real', 'Exness-MT5Trial'];
      if (!validServers.includes(server)) {
        return NextResponse.json(
          { success: false, error: 'Invalid server. Use Exness-MT5Real or Exness-MT5Trial' },
          { status: 400 }
        );
      }

      try {
        // Connect to MT5 service
        const mt5Response = await fetch(`${MT5_SERVICE_URL}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            login: parseInt(login),
            password,
            server,
          }),
        });

        const mt5Data = await mt5Response.json();

        if (!mt5Data.success) {
          return NextResponse.json(
            { success: false, error: mt5Data.error || 'MT5 connection failed' },
            { status: 400 }
          );
        }

        // Get account info from MT5
        const accountResponse = await fetch(`${MT5_SERVICE_URL}/account?connection_id=${mt5Data.connection_id}`);
        const accountInfo = await accountResponse.json();

        if (!accountInfo.success) {
          return NextResponse.json(
            { success: false, error: 'Failed to fetch account information from MT5' },
            { status: 400 }
          );
        }

        // Store MT5 connection in session manager
        sessionManager.setUserAdapter(userId, 'exness', {
          type: 'mt5',
          connectionId: mt5Data.connection_id,
          login,
          server,
        } as any);

        // Format balance data
        const balance = {
          balance: accountInfo.account.balance || 0,
          equity: accountInfo.account.equity || 0,
          margin: accountInfo.account.margin || 0,
          freeMargin: accountInfo.account.free_margin || 0,
          currency: accountInfo.account.currency || 'USD',
        };

        return NextResponse.json({
          success: true,
          message: `Successfully connected to Exness via MT5`,
          data: {
            broker: 'exness',
            demo: server === 'Exness-MT5Trial',
            balance,
            instruments: ['XAUUSD', 'US30', 'NAS100'],
            connectionId: mt5Data.connection_id,
            connection_id: mt5Data.connection_id, // Also include for compatibility
            connectedAt: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        console.error('Error connecting to Exness MT5:', error);
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to connect to MT5 service' },
          { status: 500 }
        );
      }
    }

    // Deriv connection (existing logic)
    if (broker === 'deriv') {
      const isDemo = demo !== false && (!apiKey || !apiSecret);
      const adapter = new DerivAdapter();

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
        sessionManager.setUserAdapter(userId, 'deriv', adapter);
        console.log(`[Connect Broker] Stored Deriv adapter for userId: ${userId}, isDemo: ${isDemo}, paperTrading: ${adapter.isPaperTrading()}`);
        
        // Verify adapter was stored
        const storedAdapter = sessionManager.getUserAdapter(userId, 'deriv');
        if (!storedAdapter) {
          console.error(`[Connect Broker] WARNING: Adapter was not stored correctly for userId: ${userId}`);
        } else {
          console.log(`[Connect Broker] Verified adapter stored successfully`);
        }

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

        return NextResponse.json({
          success: true,
          message: `Successfully connected to Deriv${isDemo ? ' (Demo Mode)' : ''}`,
          data: {
            broker: 'deriv',
            demo: isDemo,
            balance,
            instruments: [
              'BOOM1000', 'BOOM500', 'BOOM300', 'BOOM100',
              'CRASH1000', 'CRASH500', 'CRASH300', 'CRASH100',
            ],
            connectedAt: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        console.error('Error connecting to Deriv:', error);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to connect to Deriv: ${error.message || 'Authentication failed'}`,
          },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in connect-broker route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
