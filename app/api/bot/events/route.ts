/**
 * Bot Events API
 * Server-Sent Events (SSE) endpoint for real-time bot events
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/signalist-bot/engine/bot-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Bot events connected', timestamp: new Date().toISOString() })}\n\n`)
        );

        // Set up event listeners for bot events
        const handleTradeOpened = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'trade_opened', data: event.data, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending trade_opened event:', error);
          }
        };

        const handleTradeClosed = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'trade_closed', data: event.data, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending trade_closed event:', error);
          }
        };

        const handleSignalDetected = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'signal_detected', data: event.data, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending signal_detected event:', error);
          }
        };

        const handleStopTriggered = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'stop_triggered', reason: event.reason, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending stop_triggered event:', error);
          }
        };

        const handleError = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: event.error, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending error event:', error);
          }
        };

        const handleStatusUpdate = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'status_update', status: event.status, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending status_update event:', error);
          }
        };

        const handleCandleProcessed = (event: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'candle_processed', candle: event.candle, timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending candle_processed event:', error);
          }
        };

        // Subscribe to bot manager events
        botManager.on('trade_opened', handleTradeOpened);
        botManager.on('trade_closed', handleTradeClosed);
        botManager.on('signal_detected', handleSignalDetected);
        botManager.on('stop_triggered', handleStopTriggered);
        botManager.on('error', handleError);
        botManager.on('status_update', handleStatusUpdate);
        botManager.on('candle_processed', handleCandleProcessed);

        // Send periodic status updates
        const statusInterval = setInterval(async () => {
          try {
            const status = botManager.getBotStatus(userId);
            if (status) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'status_update', status, timestamp: new Date().toISOString() })}\n\n`)
              );
            }
          } catch (error) {
            console.error('Error sending periodic status update:', error);
          }
        }, 5000); // Every 5 seconds

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(statusInterval);
          botManager.off('trade_opened', handleTradeOpened);
          botManager.off('trade_closed', handleTradeClosed);
          botManager.off('signal_detected', handleSignalDetected);
          botManager.off('stop_triggered', handleStopTriggered);
          botManager.off('error', handleError);
          botManager.off('status_update', handleStatusUpdate);
          botManager.off('candle_processed', handleCandleProcessed);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for nginx
      },
    });
  } catch (error: any) {
    console.error('[Bot Events API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to establish event stream' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}




