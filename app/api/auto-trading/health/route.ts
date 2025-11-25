/**
 * Health Check API
 * GET: Check broker adapter health
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';

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
    const broker = searchParams.get('broker') as 'exness' | 'deriv';

    if (!broker || !['exness', 'deriv'].includes(broker)) {
      return NextResponse.json(
        { success: false, error: 'Invalid broker. Use exness or deriv' },
        { status: 400 }
      );
    }

    // Create adapter (in paper mode for health check)
    const config = {
      apiKey: process.env[`${broker.toUpperCase()}_API_KEY`] || '',
      apiSecret: process.env[`${broker.toUpperCase()}_API_SECRET`] || '',
      environment: 'demo' as const,
    };

    const adapter = broker === 'exness' 
      ? new ExnessAdapter()
      : new DerivAdapter();

    await adapter.initialize(config);
    const health = await adapter.healthCheck();

    return NextResponse.json({ success: true, data: health });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Health check failed' },
      { status: 500 }
    );
  }
}

