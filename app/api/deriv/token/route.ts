/**
 * Deriv API Token Management Routes
 * POST: Store/Update API token
 * GET: Get token info (without token value)
 * DELETE: Remove API token
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

/**
 * POST /api/deriv/token
 * Store or update Deriv API token
 */
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
    const body = await request.json();
    const { token, accountType } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    if (accountType && !['demo', 'real'].includes(accountType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account type. Must be "demo" or "real"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Validate token by connecting to Deriv
    let accountInfo;
    let isValid = false;
    try {
      const wsClient = new DerivServerWebSocketClient(token);
      await wsClient.connect();
      accountInfo = await wsClient.getAccountInfo();
      isValid = true;
      await wsClient.disconnect();
    } catch (error: any) {
      console.error('[Deriv Token] Validation error:', error);
      return NextResponse.json(
        { success: false, error: `Token validation failed: ${error.message}` },
        { status: 400 }
      );
    }

    // Encrypt token
    const encryptedToken = await encrypt(token);

    // Store or update token
    const existingToken = await DerivApiToken.findOne({ userId });
    
    if (existingToken) {
      existingToken.token = encryptedToken;
      existingToken.accountType = accountType || accountInfo.accountType;
      existingToken.accountId = accountInfo.accountId;
      existingToken.accountBalance = accountInfo.balance;
      existingToken.accountCurrency = accountInfo.currency;
      existingToken.isValid = isValid;
      existingToken.lastValidatedAt = new Date();
      await existingToken.save();
    } else {
      const newToken = new DerivApiToken({
        userId,
        token: encryptedToken,
        accountType: accountType || accountInfo.accountType,
        accountId: accountInfo.accountId,
        accountBalance: accountInfo.balance,
        accountCurrency: accountInfo.currency,
        isValid: isValid,
        lastValidatedAt: new Date(),
      });
      await newToken.save();
    }

    return NextResponse.json({
      success: true,
      data: {
        accountType: accountType || accountInfo.accountType,
        accountId: accountInfo.accountId,
        balance: accountInfo.balance,
        currency: accountInfo.currency,
        isValid: true,
      },
    });
  } catch (error: any) {
    console.error('[Deriv Token API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to store token' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deriv/token
 * Get token information (without token value)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    const tokenDoc = await DerivApiToken.findOne({ userId }).select('-token');
    
    if (!tokenDoc) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        accountType: tokenDoc.accountType,
        accountId: tokenDoc.accountId,
        accountBalance: tokenDoc.accountBalance,
        accountCurrency: tokenDoc.accountCurrency,
        isValid: tokenDoc.isValid,
        lastValidatedAt: tokenDoc.lastValidatedAt,
        scopes: tokenDoc.scopes,
        expiresAt: tokenDoc.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[Deriv Token API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get token info' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deriv/token
 * Remove API token
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    await DerivApiToken.deleteOne({ userId });

    return NextResponse.json({
      success: true,
      message: 'Token removed successfully',
    });
  } catch (error: any) {
    console.error('[Deriv Token API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove token' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/deriv/token/validate
 * Validate existing token
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    const tokenDoc = await DerivApiToken.findOne({ userId }).select('+token');
    if (!tokenDoc || !tokenDoc.token) {
      return NextResponse.json(
        { success: false, error: 'No token found' },
        { status: 404 }
      );
    }

    // Decrypt and validate token
    const token = await decrypt(tokenDoc.token);
    let accountInfo;
    let isValid = false;
    
    try {
      const wsClient = new DerivServerWebSocketClient(token);
      await wsClient.connect();
      accountInfo = await wsClient.getAccountInfo();
      isValid = true;
      await wsClient.disconnect();
    } catch (error: any) {
      console.error('[Deriv Token] Validation error:', error);
      isValid = false;
    }

    // Update token info
    tokenDoc.isValid = isValid;
    tokenDoc.lastValidatedAt = new Date();
    if (accountInfo) {
      tokenDoc.accountBalance = accountInfo.balance;
      tokenDoc.accountCurrency = accountInfo.currency;
      tokenDoc.accountId = accountInfo.accountId;
    }
    await tokenDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        accountBalance: tokenDoc.accountBalance,
        accountCurrency: tokenDoc.accountCurrency,
        lastValidatedAt: tokenDoc.lastValidatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Deriv Token API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to validate token' },
      { status: 500 }
    );
  }
}




