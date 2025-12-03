/**
 * MT5 Notifications API Route
 * Server-Sent Events for real-time trade notifications
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        const send = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        send({ type: 'connected', message: 'Connected to MT5 notifications' });

        // Poll for updates every second
        const interval = setInterval(async () => {
          try {
            const connectionId = request.nextUrl.searchParams.get('connection_id');
            if (!connectionId) return;

            // Check for new trades
            const tradesResponse = await fetch(
              `${process.env.MT5_SERVICE_URL || 'http://localhost:5000'}/trades/open?connection_id=${connectionId}`
            );
            const tradesData = await tradesResponse.json();

            if (tradesData.success) {
              send({
                type: 'trades_update',
                data: tradesData.positions || [],
              });
            }
          } catch (error) {
            console.error('Error in notification stream:', error);
          }
        }, 1000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('SSE error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

