/**
 * Secure Deriv API Token Management Routes
 * Uses DerivTokenValidatorService for comprehensive validation
 * 
 * SECURITY: Tokens are NEVER returned to frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DerivTokenValidatorService } from '@/lib/services/deriv-token-validator.service';

/**
 * POST /api/deriv/token/secure
 * Store and validate Deriv API token with permission checking
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
    const { token, requiredPermissions } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate and store token with permission checking
    const result = await DerivTokenValidatorService.validateAndStoreToken(
      userId,
      token,
      requiredPermissions
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Token validation failed',
          validation: {
            isValid: result.validation.isValid,
            errors: result.validation.errors,
            warnings: result.validation.warnings,
            permissions: result.validation.permissions,
          },
        },
        { status: 400 }
      );
    }

    // Return token info WITHOUT the token value (security)
    return NextResponse.json({
      success: true,
      data: result.tokenInfo,
      validation: {
        isValid: result.validation.isValid,
        accountType: result.validation.accountType,
        permissions: result.validation.permissions,
        warnings: result.validation.warnings,
      },
    });
  } catch (error: any) {
    console.error('[Deriv Token Secure API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process token',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deriv/token/secure
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

    const result = await DerivTokenValidatorService.getTokenInfo(userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to get token info',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.tokenInfo,
    });
  } catch (error: any) {
    console.error('[Deriv Token Secure API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get token info',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deriv/token/secure
 * Revoke token (mark as invalid or delete)
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
    const { searchParams } = new URL(request.url);
    const deletePermanently = searchParams.get('permanent') === 'true';

    const result = await DerivTokenValidatorService.revokeToken(
      userId,
      deletePermanently
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to revoke token',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: deletePermanently
        ? 'Token permanently deleted'
        : 'Token revoked',
    });
  } catch (error: any) {
    console.error('[Deriv Token Secure API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to revoke token',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/deriv/token/secure/validate
 * Re-validate existing token
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

    const result = await DerivTokenValidatorService.revalidateStoredToken(userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to revalidate token',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      validation: {
        isValid: result.validation?.isValid,
        accountType: result.validation?.accountType,
        permissions: result.validation?.permissions,
        errors: result.validation?.errors,
        warnings: result.validation?.warnings,
      },
    });
  } catch (error: any) {
    console.error('[Deriv Token Secure API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to revalidate token',
      },
      { status: 500 }
    );
  }
}

