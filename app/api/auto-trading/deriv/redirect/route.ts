/**
 * Deriv Redirect Handler
 * Handles Deriv's redirect with account and token information in query parameters
 * Deriv redirects to root URL with: ?acct1=...&token1=...&cur1=...&acct2=...&token2=...&cur2=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { DerivAccountSyncService } from '@/lib/services/deriv-account-sync.service';

const FRONTEND_REDIRECT = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.redirect(`${FRONTEND_REDIRECT}/sign-in?error=unauthorized`);
    }

    const { searchParams } = new URL(request.url);
    const userId = session.user.id;

    // Extract account and token information from query parameters
    // Deriv sends: acct1, token1, cur1, acct2, token2, cur2, etc.
    const accounts: Array<{
      loginid: string;
      token: string;
      currency: string;
      accountType: 'demo' | 'real';
    }> = [];

    let index = 1;
    while (true) {
      const acct = searchParams.get(`acct${index}`);
      const token = searchParams.get(`token${index}`);
      const cur = searchParams.get(`cur${index}`);

      if (!acct || !token) {
        break; // No more accounts
      }

      // Determine account type based on login ID
      // VR* or CR* = demo, others = real
      const accountType = acct.startsWith('VR') || acct.startsWith('CR') ? 'demo' : 'real';

      accounts.push({
        loginid: acct,
        token: token,
        currency: cur || 'USD',
        accountType,
      });

      index++;
    }

    if (accounts.length === 0) {
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=no_accounts&message=No accounts found in redirect`
      );
    }

    // Use the first account's token for authentication
    // In Deriv's system, tokens are account-specific
    const primaryAccount = accounts[0];
    const accessToken = primaryAccount.token;

    // Fetch full account information using the token
    let accountData;
    try {
      accountData = await DerivAccountSyncService.fetchAccounts(accessToken);
    } catch (error: any) {
      console.error('Error fetching Deriv accounts:', error);
      // Continue with basic account info from query params
      accountData = {
        accounts: accounts.map(acc => ({
          loginid: acc.loginid,
          account_type: acc.accountType,
          currency: acc.currency,
          balance: 0,
        })),
        demoAccounts: accounts.filter(acc => acc.accountType === 'demo'),
        realAccounts: accounts.filter(acc => acc.accountType === 'real'),
        activeAccount: primaryAccount,
        accountType: primaryAccount.accountType,
      };
    }

    // Initialize and store adapter
    const adapter = new DerivAdapter();
    await adapter.initialize({
      apiKey: accessToken,
      apiSecret: '', // Deriv uses token-based auth, no secret needed
      environment: primaryAccount.accountType === 'demo' ? 'demo' : 'live',
    });
    
    // Set authentication token
    (adapter as any).accessToken = accessToken;
    (adapter as any).tokenExpiry = Date.now() + (3600 * 1000); // 1 hour default
    (adapter as any).authenticated = true;
    
    adapter.setPaperTrading(primaryAccount.accountType === 'demo');

    // Store adapter in session manager
    sessionManager.setUserAdapter(userId, 'deriv', adapter);

    // Store tokens securely in database
    await storeDerivTokens(userId, {
      accessToken,
      refreshToken: null, // Deriv redirect doesn't provide refresh token
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour default
      accountType: primaryAccount.accountType,
      accountData,
      accounts, // Store all accounts from redirect
    });

    // Redirect to frontend with success
    return NextResponse.redirect(
      `${FRONTEND_REDIRECT}/autotrade?deriv_connected=true&account_type=${primaryAccount.accountType}&accounts=${accounts.length}`
    );
  } catch (error: any) {
    console.error('Error in Deriv redirect handler:', error);
    return NextResponse.redirect(
      `${FRONTEND_REDIRECT}/autotrade?error=redirect_error&message=${encodeURIComponent(error.message)}`
    );
  }
}

/**
 * Store Deriv tokens securely in database
 */
async function storeDerivTokens(userId: string, tokens: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  accountType: string;
  accountData: any;
  accounts?: any[];
}) {
  try {
    // Import database models
    const { connectToDatabase } = await import('@/database/mongoose');
    const mongoose = await connectToDatabase();
    
    // Use existing broker credentials model or create new one
    const BrokerCredentials = mongoose.models.BrokerCredentials || mongoose.model('BrokerCredentials', 
      new mongoose.Schema({
        userId: { type: String, required: true, index: true },
        broker: { type: String, required: true },
        accountType: { type: String, required: true },
        accessToken: { type: String, required: true },
        refreshToken: { type: String },
        expiresAt: { type: Date, required: true },
        accountData: { type: mongoose.Schema.Types.Mixed },
        accounts: { type: mongoose.Schema.Types.Mixed }, // Store all accounts
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      }, { collection: 'broker_credentials' })
    );

    // Store or update tokens
    await BrokerCredentials.findOneAndUpdate(
      { userId, broker: 'deriv', accountType: tokens.accountType },
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountData: tokens.accountData,
        accounts: tokens.accounts,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`[Deriv Redirect] Stored tokens for userId: ${userId}, accountType: ${tokens.accountType}, accounts: ${tokens.accounts?.length || 0}`);
  } catch (error: any) {
    console.error('Error storing Deriv tokens:', error);
    // Don't throw - token storage failure shouldn't break the flow
  }
}

