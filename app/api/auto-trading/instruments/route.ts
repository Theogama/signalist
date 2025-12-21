/**
 * Instruments API
 * GET: List available instruments for a broker
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

const EXNESS_INSTRUMENTS = [
  { symbol: 'XAUUSD', name: 'Gold (XAU/USD)', broker: 'exness' as const, category: 'Metals' },
  { symbol: 'US30', name: 'Dow Jones 30', broker: 'exness' as const, category: 'Indices' },
  { symbol: 'NAS100', name: 'Nasdaq 100', broker: 'exness' as const, category: 'Indices' },
];

const DERIV_INSTRUMENTS = [
  { symbol: 'BOOM1000', name: 'Boom 1000', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM500', name: 'Boom 500', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM300', name: 'Boom 300', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM100', name: 'Boom 100', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'CRASH1000', name: 'Crash 1000', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH500', name: 'Crash 500', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH300', name: 'Crash 300', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH100', name: 'Crash 100', broker: 'deriv' as const, category: 'Crash' },
];

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
    const broker = searchParams.get('broker') as 'exness' | 'deriv' | null;

    if (!broker) {
      return NextResponse.json(
        { success: false, error: 'Broker parameter required' },
        { status: 400 }
      );
    }

    if (broker !== 'exness' && broker !== 'deriv') {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Use exness or deriv' },
        { status: 400 }
      );
    }

    const instruments = broker === 'exness' ? EXNESS_INSTRUMENTS : DERIV_INSTRUMENTS;

    return NextResponse.json({
      success: true,
      data: instruments,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load instruments' },
      { status: 500 }
    );
  }
}











