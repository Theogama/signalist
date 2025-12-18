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

    // Deriv connection (enhanced)
    if (broker === 'deriv') {
      const isDemo = demo !== false && (!apiKey || !apiSecret);
      
      // Validate API keys format if provided (not demo mode)
      if (!isDemo) {
        if (!apiKey || apiKey.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: 'API Key is required for live trading. Use Demo Mode if you want to test without credentials.' },
            { status: 400 }
          );
        }
        if (!apiSecret || apiSecret.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: 'API Secret is required for live trading. Use Demo Mode if you want to test without credentials.' },
            { status: 400 }
          );
        }
        // Basic format validation - Deriv API keys are typically alphanumeric
        if (apiKey.length < 10 || apiSecret.length < 10) {
          return NextResponse.json(
            { success: false, error: 'Invalid API key format. Please check your credentials and try again.' },
            { status: 400 }
          );
        }
      }

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
          console.log(`[Connect Broker] Initialized Deriv adapter in demo mode for userId: ${userId}`);
        } else {
          // Live mode - authenticate with API keys
          console.log(`[Connect Broker] Initializing Deriv adapter with API keys for userId: ${userId}`);
          
          await adapter.initialize({
            apiKey: apiKey.trim(),
            apiSecret: apiSecret.trim(),
            environment: 'live',
          });
          
          // Authenticate and verify connection
          console.log(`[Connect Broker] Authenticating Deriv account...`);
          const authResult = await adapter.authenticate();
          
          if (!authResult) {
            return NextResponse.json(
              {
                success: false,
                error: 'Authentication failed. Please verify your API key and secret are correct. Ensure they have TRADE-ONLY permissions.',
              },
              { status: 401 }
            );
          }
          
          adapter.setPaperTrading(false);
          console.log(`[Connect Broker] Successfully authenticated Deriv account`);
        }

        // Verify connection by fetching account balance before storing
        console.log(`[Connect Broker] Verifying connection by fetching account balance...`);
        let balance;
        let accountInfo: any = {};
        
        try {
          balance = await adapter.getBalance();
          console.log(`[Connect Broker] Successfully fetched balance:`, balance);
          
          // Try to get additional account information
          try {
            // Attempt to fetch account details if available
            const accountData = await (adapter as any).makeRequest?.('/account') || null;
            if (accountData) {
              accountInfo = {
                accountId: accountData.loginid || accountData.account_id,
                accountType: accountData.account_type || (isDemo ? 'demo' : 'real'),
                currency: accountData.currency || balance.currency,
                country: accountData.country,
                email: accountData.email,
              };
            }
          } catch (infoError) {
            // Non-critical - account info fetch is optional
            console.log(`[Connect Broker] Could not fetch additional account info (non-critical):`, infoError);
          }
        } catch (balanceError: any) {
          console.error(`[Connect Broker] Failed to fetch balance:`, balanceError);
          
          if (!isDemo) {
            // For live accounts, balance fetch failure is critical
            return NextResponse.json(
              {
                success: false,
                error: `Connection verification failed: ${balanceError.message || 'Unable to fetch account balance'}. Please check your API credentials and permissions.`,
              },
              { status: 500 }
            );
          }
          
          // For demo mode, use fallback balance
          balance = {
            balance: 10000,
            equity: 10000,
            margin: 0,
            freeMargin: 10000,
            currency: 'USD',
          };
          console.log(`[Connect Broker] Using fallback balance for demo mode`);
        }

        // Store adapter in session manager only after successful verification
        sessionManager.setUserAdapter(userId, 'deriv', adapter);
        console.log(`[Connect Broker] Stored Deriv adapter for userId: ${userId}, isDemo: ${isDemo}, paperTrading: ${adapter.isPaperTrading()}`);
        
        // Verify adapter was stored correctly
        const storedAdapter = sessionManager.getUserAdapter(userId, 'deriv');
        if (!storedAdapter) {
          console.error(`[Connect Broker] ERROR: Adapter was not stored correctly for userId: ${userId}`);
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to store connection. Please try again.',
            },
            { status: 500 }
          );
        }
        
        console.log(`[Connect Broker] Verified adapter stored successfully`);

        return NextResponse.json({
          success: true,
          message: `Successfully connected to Deriv${isDemo ? ' (Demo Mode)' : ' (Live Account)'}`,
          data: {
            broker: 'deriv',
            demo: isDemo,
            balance,
            accountInfo: Object.keys(accountInfo).length > 0 ? accountInfo : undefined,
            instruments: [
              'BOOM1000', 'BOOM500', 'BOOM300', 'BOOM100',
              'CRASH1000', 'CRASH500', 'CRASH300', 'CRASH100',
            ],
            connectedAt: new Date().toISOString(),
            verified: true,
          },
        });
      } catch (error: any) {
        console.error('[Connect Broker] Error connecting to Deriv:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to connect to Deriv';
        let statusCode = 500;
        
        if (error.message?.includes('Authentication failed') || error.message?.includes('401')) {
          errorMessage = 'Invalid API credentials. Please check your API key and secret. Ensure they have TRADE-ONLY permissions.';
          statusCode = 401;
        } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          errorMessage = 'API credentials do not have required permissions. Please ensure your API keys have TRADE-ONLY access.';
          statusCode = 403;
        } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
          statusCode = 503;
        } else if (error.message) {
          errorMessage = `Connection failed: ${error.message}`;
        }
        
        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
            details: !isDemo ? 'If you continue to experience issues, try using Demo Mode to test the connection.' : undefined,
          },
          { status: statusCode }
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
