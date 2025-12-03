/**
 * Quick Connect API
 * Handles MT5 connection for Exness and Deriv connection
 * Auto-links account and fetches balance, equity, open trades, historical trades
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { accountLinkingService } from '@/lib/services/account-linking.service';

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
    const { broker, connectionType, credentials } = body;

    if (!broker || (broker !== 'exness' && broker !== 'deriv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Must be "exness" or "deriv"' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    let adapter: DerivAdapter | null = null;
    let accountData: any = null;

    // Quick Connect for Exness - MUST use MT5
    if (broker === 'exness') {
      // Exness requires MT5 connection (login, password, server)
      if (connectionType !== 'mt5' || !credentials?.login || !credentials?.password || !credentials?.server) {
        return NextResponse.json(
          { success: false, error: 'Exness requires MT5 connection. Please provide login, password, and server.' },
          { status: 400 }
        );
      }

      // Validate server
      const validServers = ['Exness-MT5Real', 'Exness-MT5Trial'];
      if (!validServers.includes(credentials.server)) {
        return NextResponse.json(
          { success: false, error: 'Invalid server. Use Exness-MT5Real or Exness-MT5Trial' },
          { status: 400 }
        );
      }

      // Connect to MT5 service
      try {
        const mt5Response = await fetch(`${MT5_SERVICE_URL}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            login: parseInt(credentials.login),
            password: credentials.password,
            server: credentials.server,
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

        // Format account data for Signalist
        accountData = {
          balance: accountInfo.account.balance || 0,
          equity: accountInfo.account.equity || 0,
          margin: accountInfo.account.margin || 0,
          freeMargin: accountInfo.account.free_margin || 0,
          marginLevel: accountInfo.account.margin_level || 0,
          currency: accountInfo.account.currency || 'USD',
          leverage: accountInfo.account.leverage || 1,
          connectionId: mt5Data.connection_id,
          login: credentials.login,
          server: credentials.server,
        };

        // Store MT5 connection info in session (for later use)
        // In production, store encrypted in database
        sessionManager.setUserAdapter(userId, 'exness', {
          type: 'mt5',
          connectionId: mt5Data.connection_id,
          login: credentials.login,
          server: credentials.server,
        } as any);
      } catch (error: any) {
        console.error('Error connecting to MT5:', error);
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to connect to MT5 service' },
          { status: 500 }
        );
      }
    }

    // Quick Connect for Deriv
    if (broker === 'deriv') {
      adapter = new DerivAdapter();
      
      if (connectionType === 'quick_connect' && credentials?.token) {
        // WebSocket quick connect with token
        await adapter.initialize({
          apiKey: credentials.token,
          apiSecret: '',
          environment: 'demo',
        });
        adapter.setPaperTrading(true);
      } else {
        // Demo mode (no credentials)
        await adapter.initialize({
          apiKey: '',
          apiSecret: '',
          environment: 'demo',
        });
        adapter.setPaperTrading(true);
      }

      // Store adapter in session manager first
      sessionManager.setUserAdapter(userId, 'deriv', adapter);
      
      // Use account linking service to fetch all account data
      // Note: If adapter is in paper trading mode, the service will use PaperTrader
      try {
        accountData = await accountLinkingService.linkAccount(userId, 'deriv', adapter);
      } catch (error: any) {
        console.error('Error linking Deriv account:', error);
        // Fallback to demo account data
        accountData = await accountLinkingService.linkAccount(userId, 'deriv', null);
      }
    }

    // Ensure accountData was fetched successfully
    if (!accountData) {
      // Final fallback - get demo account data
      accountData = await accountLinkingService.linkAccount(userId, broker, null);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${broker.toUpperCase()}`,
      data: {
        broker,
        account: accountData,
        connectedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in quick-connect route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Connection failed' },
      { status: 500 }
    );
  }
}

