/**
 * POST /api/deriv/create-demo-account
 * Create a demo trading account using Deriv API (new_account_virtual)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCode, deleteVerificationCode } from '@/lib/deriv/verification-store';

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = '113058';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      verification_code,
      new_account_virtual,
      client_password,
      residence,
      currency,
      account_opening_reason,
    } = body;

    if (!email || !verification_code || !client_password || !residence) {
      return NextResponse.json(
        { error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Validate verification code
    const verification = verifyCode(email, verification_code);
    if (!verification.valid) {
      if (verification.expired) {
        return NextResponse.json(
          { error: { message: 'Verification code has expired. Please request a new one.' } },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { error: { message: 'Invalid verification code. Please check and try again.' } },
        { status: 400 }
      );
    }

    // Code is valid - remove it so it can't be reused
    deleteVerificationCode(email);

    // In a real implementation, this would connect to Deriv WebSocket API
    // For now, we'll simulate the API call
    // TODO: Implement actual Deriv WebSocket connection
    
    // Simulate API response
    const response = {
      new_account_virtual: {
        client_id: `CR${Math.floor(Math.random() * 100000000)}`,
        oauth_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ email, type: 'virtual' }))}`,
        email,
        currency: currency || 'USD',
        balance: 10000.00,
        account_type: 'virtual',
        landing_company: 'virtual',
      },
      echo_req: {
        new_account_virtual,
        email,
        verification_code,
        client_password: '***',
        residence,
        currency: currency || 'USD',
      },
      msg_type: 'new_account_virtual',
    };

    // In production, you would:
    // 1. Connect to Deriv WebSocket
    // 2. Send new_account_virtual request with all parameters
    // 3. Wait for response
    // 4. Return the actual response

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Deriv API] Demo account creation error:', error);
    return NextResponse.json(
      { error: { message: error.message || 'Demo account creation failed' } },
      { status: 500 }
    );
  }
}

