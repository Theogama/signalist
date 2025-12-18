/**
 * POST /api/deriv/verify-email
 * Verify email address using Deriv API
 * 
 * NOTE: This is a development/demo implementation.
 * In production, this would connect to the actual Deriv WebSocket API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVerificationCode, storeVerificationCode } from '@/lib/deriv/verification-store';

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = '113058';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verify_email, type } = body;

    if (!verify_email || !type) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: verify_email and type' } },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(verify_email)) {
      return NextResponse.json(
        { error: { message: 'Invalid email address format' } },
        { status: 400 }
      );
    }

    // Generate and store verification code
    const verificationCode = generateVerificationCode();
    storeVerificationCode(verify_email, verificationCode, 10); // 10 minutes expiry

    // In production, you would:
    // 1. Connect to Deriv WebSocket API
    // 2. Send verify_email request
    // 3. Deriv sends actual email with code
    // 4. Return the response
    
    // For development/demo: Log the code (in production, this would be sent via email)
    console.log(`[Deriv API] Verification code for ${verify_email}: ${verificationCode}`);

    const response = {
      verify_email: {
        new_token: `token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        sent_to: maskEmail(verify_email),
        // Include code in response for development (remove in production)
        verification_code: process.env.NODE_ENV === 'development' ? verificationCode : undefined,
      },
      echo_req: {
        verify_email,
        type,
      },
      msg_type: 'verify_email',
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Deriv API] Email verification error:', error);
    return NextResponse.json(
      { error: { message: error.message || 'Email verification failed' } },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve verification code (for development/testing)
export async function GET(request: NextRequest) {
  const { getVerificationCode } = await import('@/lib/deriv/verification-store');
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { error: { message: 'Email parameter required' } },
      { status: 400 }
    );
  }

  const stored = getVerificationCode(email);
  if (!stored) {
    return NextResponse.json(
      { error: { message: 'No verification code found for this email' } },
      { status: 404 }
    );
  }

  // Only return code in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({
      code: stored.code,
      expiresAt: stored.expiresAt,
      email: stored.email,
    });
  }

  return NextResponse.json({
    message: 'Verification code sent to email',
    expiresAt: stored.expiresAt,
  });
}

