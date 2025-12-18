/**
 * Deriv OAuth2 Callback Handler
 * Handles the redirect from Deriv after authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers, cookies } from 'next/headers';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { redirect } from 'next/navigation';

const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';
const DERIV_TOKEN_URL = process.env.DERIV_TOKEN_URL || 'https://oauth.deriv.com/oauth2/token';
const DERIV_API_URL = process.env.DERIV_API_URL || 'https://api.deriv.com';
const FRONTEND_REDIRECT = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.redirect(`${FRONTEND_REDIRECT}/sign-in?error=unauthorized`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Deriv OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=deriv_auth_failed&message=${encodeURIComponent(errorDescription || error)}`
      );
    }

    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('deriv_oauth_state')?.value;
    
    if (!storedState || storedState !== state) {
      console.error('Invalid OAuth state');
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=invalid_state`
      );
    }

    // Parse state to get account type
    let accountType = 'real';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      accountType = stateData.accountType || 'real';
    } catch (e) {
      console.warn('Could not parse state, defaulting to real account');
    }

    if (!code) {
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=no_code`
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(DERIV_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: DERIV_APP_ID,
        redirect_uri: `${FRONTEND_REDIRECT}/api/auto-trading/deriv/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!accessToken) {
      return NextResponse.redirect(
        `${FRONTEND_REDIRECT}/autotrade?error=no_token`
      );
    }

    // Fetch account information
    const userId = session.user.id;
    const { DerivAccountSyncService } = await import('@/lib/services/deriv-account-sync.service');
    const accountData = await DerivAccountSyncService.fetchAccounts(accessToken);

    // Initialize and store adapter
    const adapter = new DerivAdapter();
    await adapter.initialize({
      apiKey: accessToken,
      apiSecret: refreshToken || '',
      environment: accountType === 'demo' ? 'demo' : 'live',
    });
    
    // Set authentication token
    (adapter as any).accessToken = accessToken;
    (adapter as any).tokenExpiry = Date.now() + (expiresIn * 1000);
    (adapter as any).authenticated = true;
    
    adapter.setPaperTrading(accountType === 'demo');

    // Store adapter in session manager
    sessionManager.setUserAdapter(userId, 'deriv', adapter);

    // Store tokens securely (in database for persistence)
    await storeDerivTokens(userId, {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      accountType,
      accountData,
    });

    // Clear OAuth state cookie
    cookieStore.delete('deriv_oauth_state');

    // Redirect to frontend with success
    return NextResponse.redirect(
      `${FRONTEND_REDIRECT}/autotrade?deriv_connected=true&account_type=${accountType}`
    );
  } catch (error: any) {
    console.error('Error in Deriv OAuth callback:', error);
    return NextResponse.redirect(
      `${FRONTEND_REDIRECT}/autotrade?error=callback_error&message=${encodeURIComponent(error.message)}`
    );
  }
}


/**
 * Store Deriv tokens securely in database
 */
async function storeDerivTokens(userId: string, tokens: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  accountType: string;
  accountData: any;
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
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`[Deriv OAuth] Stored tokens for userId: ${userId}, accountType: ${tokens.accountType}`);
  } catch (error: any) {
    console.error('Error storing Deriv tokens:', error);
    // Don't throw - token storage failure shouldn't break the flow
  }
}

