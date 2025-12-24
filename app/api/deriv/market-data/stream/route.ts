/**
 * Deriv Market Data Streaming API (Server-Sent Events)
 * 
 * Streams real-time market data to the frontend using SSE.
 * Supports tick data and OHLC data subscriptions.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { decrypt } from '@/lib/utils/encryption';
import { DerivMarketDataService } from '@/lib/services/deriv-market-data.service';

/**
 * GET /api/deriv/market-data/stream
 * Stream market data using Server-Sent Events
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BOOM500';
    const type = searchParams.get('type') || 'ticks'; // 'ticks' or 'ohlc'
    const granularity = parseInt(searchParams.get('granularity') || '60');

    await connectToDatabase();

    // Get user's Deriv token
    const tokenDoc = await DerivApiToken.findOne({
      userId,
      isValid: true,
    });

    if (!tokenDoc) {
      return new Response('No valid Deriv API token found', { status: 404 });
    }

    // Decrypt token
    const token = await decrypt(tokenDoc.token);

    // Create market data service
    const marketData = new DerivMarketDataService(token);
    await marketData.connect();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', symbol })}\n\n`)
        );

        // Set up subscription based on type
        if (type === 'ticks') {
          await marketData.subscribeToTicks(symbol, (tick) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tick', data: tick })}\n\n`)
              );
            } catch (error) {
              console.error('[Market Data Stream] Error sending tick:', error);
            }
          });
        } else if (type === 'ohlc') {
          await marketData.subscribeToOHLC(symbol, granularity, (ohlc) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'ohlc', data: ohlc })}\n\n`)
              );
            } catch (error) {
              console.error('[Market Data Stream] Error sending OHLC:', error);
            }
          });
        }

        // Handle client disconnect
        request.signal.addEventListener('abort', async () => {
          try {
            await marketData.disconnect();
            controller.close();
          } catch (error) {
            console.error('[Market Data Stream] Error on disconnect:', error);
          }
        });

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
            );
          } catch (error) {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Cleanup on stream end
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[Deriv Market Data Stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to start stream' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

