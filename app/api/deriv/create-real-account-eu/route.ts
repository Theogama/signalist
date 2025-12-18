/**
 * POST /api/deriv/create-real-account-eu
 * Create a real trading account for EU users using Deriv API (new_account_maltainvest)
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
      new_account_maltainvest,
      client_password,
      residence,
      currency,
      date_of_birth,
      first_name,
      last_name,
      phone,
      address_line_1,
      address_city,
      address_postcode,
      tax_residence,
      employment_status,
      annual_income,
      trading_experience,
      risk_tolerance,
      accept_risk,
      accept_terms,
    } = body;

    // Validate required fields for EU accounts
    const requiredFields = [
      'email',
      'verification_code',
      'client_password',
      'residence',
      'currency',
      'date_of_birth',
      'first_name',
      'last_name',
      'phone',
      'address_line_1',
      'address_city',
      'address_postcode',
      'tax_residence',
      'employment_status',
      'annual_income',
      'trading_experience',
      'risk_tolerance',
    ];

    const missingFields = requiredFields.filter((field) => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: { message: `Missing required fields: ${missingFields.join(', ')}` } },
        { status: 400 }
      );
    }

    if (accept_risk !== 1 || accept_terms !== 1) {
      return NextResponse.json(
        { error: { message: 'Risk acceptance and terms acceptance are required' } },
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
    // TODO: Implement actual Deriv WebSocket connection
    
    // Simulate API response
    const response = {
      new_account_maltainvest: {
        client_id: `CR${Math.floor(Math.random() * 100000000)}`,
        oauth_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ email, type: 'real', region: 'eu' }))}`,
        email,
        currency: currency || 'EUR',
        landing_company: 'maltainvest',
        account_type: 'real',
        account_status: 'pending_verification',
        verification_required: true,
      },
      echo_req: {
        new_account_maltainvest,
        email,
        verification_code,
        client_password: '***',
        residence,
        currency,
      },
      msg_type: 'new_account_maltainvest',
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Deriv API] EU real account creation error:', error);
    return NextResponse.json(
      { error: { message: error.message || 'EU real account creation failed' } },
      { status: 500 }
    );
  }
}

