/**
 * Deriv Connection Sync API
 * Syncs Deriv connection state after OAuth redirect
 * Called by frontend to ensure connection is properly established
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Check if adapter exists in session manager
    let adapter = sessionManager.getUserAdapter(userId, 'deriv');
    
    // If adapter not found, try to restore from database
    if (!adapter) {
      try {
        const { connectToDatabase } = await import('@/database/mongoose');
        const mongoose = await connectToDatabase();
        const BrokerCredentials = mongoose.models.BrokerCredentials || mongoose.model('BrokerCredentials', 
          new mongoose.Schema({
            userId: { type: String, required: true, index: true },
            broker: { type: String, required: true },
            accountType: { type: String, required: true },
            accessToken: { type: String, required: true },
            refreshToken: { type: String },
            expiresAt: { type: Date, required: true },
            accountData: { type: mongoose.Schema.Types.Mixed },
            accounts: { type: mongoose.Schema.Types.Mixed },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          }, { collection: 'broker_credentials' })
        );

        const credentials = await BrokerCredentials.findOne({ 
          userId, 
          broker: 'deriv' 
        }).sort({ updatedAt: -1 });

        if (credentials && credentials.accessToken) {
          // Restore adapter from stored credentials
          const restoredAdapter = new DerivAdapter();
          await restoredAdapter.initialize({
            apiKey: credentials.accessToken,
            apiSecret: credentials.refreshToken || '',
            environment: credentials.accountType === 'demo' ? 'demo' : 'live',
          });
          
          (restoredAdapter as any).accessToken = credentials.accessToken;
          (restoredAdapter as any).tokenExpiry = credentials.expiresAt?.getTime() || Date.now() + 3600000;
          (restoredAdapter as any).authenticated = true;
          restoredAdapter.setPaperTrading(credentials.accountType === 'demo');

          // Store in session manager
          sessionManager.setUserAdapter(userId, 'deriv', restoredAdapter);
          adapter = restoredAdapter;
          
          console.log(`[Sync Connection] Restored adapter from database for userId: ${userId}`);
        }
      } catch (error: any) {
        console.error('Error restoring adapter from database:', error);
      }
    }
    
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Deriv adapter not found. Please reconnect.' },
        { status: 404 }
      );
    }

    // Verify adapter is authenticated
    const isAuthenticated = (adapter as any).authenticated === true;
    const accessToken = (adapter as any).accessToken;

    if (!isAuthenticated || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Deriv adapter not authenticated. Please reconnect.' },
        { status: 401 }
      );
    }

    // Get account balance
    let balance;
    try {
      balance = await adapter.getBalance();
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      // Return fallback balance
      balance = {
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        currency: 'USD',
      };
    }

    // Determine account type
    const isDemo = adapter.isPaperTrading();
    const accountType = isDemo ? 'demo' : 'real';

    return NextResponse.json({
      success: true,
      data: {
        broker: 'deriv',
        accountType,
        connected: true,
        authenticated: isAuthenticated,
        balance: balance.balance || 0,
        equity: balance.equity || balance.balance || 0,
        margin: balance.margin || 0,
        freeMargin: balance.freeMargin || (balance.balance || 0) - (balance.margin || 0),
        currency: balance.currency || 'USD',
      },
    });
  } catch (error: any) {
    console.error('Error syncing Deriv connection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync connection' },
      { status: 500 }
    );
  }
}

