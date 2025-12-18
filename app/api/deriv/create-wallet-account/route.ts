/**
 * POST /api/deriv/create-wallet-account
 * Create a wallet account using Deriv API (new_account_wallet)
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
      new_account_wallet,
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
      accept_risk,
      accept_terms,
    } = body;

    // Validate required fields
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

    // Determine landing company based on residence
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    const isEU = euCountries.includes(residence.toUpperCase());
    const landingCompany = isEU ? 'maltainvest' : 'svg';

    // In a real implementation, this would connect to Deriv WebSocket API
    // TODO: Implement actual Deriv WebSocket connection
    
    // Simulate API response
    const response = {
      new_account_wallet: {
        client_id: `CR${Math.floor(Math.random() * 100000000)}`,
        oauth_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ email, type: 'wallet' }))}`,
        email,
        currency: currency || 'USD',
        balance: 0.00,
        account_type: 'wallet',
        landing_company: landingCompany,
        account_status: 'pending_verification',
        verification_required: true,
      },
      echo_req: {
        new_account_wallet,
        email,
        verification_code,
        client_password: '***',
        residence,
        currency,
      },
      msg_type: 'new_account_wallet',
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Deriv API] Wallet account creation error:', error);
    return NextResponse.json(
      { error: { message: error.message || 'Wallet account creation failed' } },
      { status: 500 }
    );
  }
}

