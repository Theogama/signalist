/**
 * Disconnect Broker API
 * Disconnects from the currently connected broker (Exness MT5 or Deriv)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { broker, connectionId } = body;

    if (!broker) {
      return NextResponse.json(
        { success: false, error: 'Missing broker type' },
        { status: 400 }
      );
    }

    // Disconnect MT5 connection for Exness
    if (broker === 'exness' && connectionId) {
      try {
        const mt5Response = await fetch(`${MT5_SERVICE_URL}/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connection_id: connectionId }),
        });

        if (!mt5Response.ok) {
          console.error('MT5 disconnect error:', await mt5Response.text());
          // Continue anyway - connection might already be closed
        }
      } catch (error) {
        console.error('MT5 disconnect error:', error);
        // Continue anyway - connection might already be closed
      }
    }

    // For Deriv, we just clear the session/connection
    // The API keys are stored client-side, so we just need to clear server-side state
    // Deriv connections are stateless, so no explicit disconnect needed

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${broker.toUpperCase()}`,
    });
  } catch (error: any) {
    console.error('Error disconnecting broker:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to disconnect broker' },
      { status: 500 }
    );
  }
}





