/**
 * Deriv OAuth2 Authentication Initiation
 * Redirects user to Deriv's official authentication page
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';

const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';
const DERIV_OAUTH_URL = process.env.DERIV_OAUTH_URL || 'https://oauth.deriv.com/oauth2/authorize';
const REDIRECT_URI = process.env.DERIV_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auto-trading/deriv/callback`;

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('account_type') || 'real'; // 'demo' or 'real'
    const state = Buffer.from(JSON.stringify({
      userId: session.user.id,
      accountType,
      timestamp: Date.now(),
    })).toString('base64');

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('deriv_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Build OAuth authorization URL
    const authUrl = new URL(DERIV_OAUTH_URL);
    authUrl.searchParams.set('app_id', DERIV_APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'read,trade,admin');
    if (accountType === 'demo') {
      authUrl.searchParams.set('account_type', 'demo');
    }

    // Redirect to Deriv's authentication page
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Error initiating Deriv OAuth:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}

