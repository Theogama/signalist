/**
 * GET /api/deriv/auto-trading/live-updates
 * Server-Sent Events stream for real-time trading updates
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getAutoTradingService } from '@/lib/services/deriv-auto-trading.service';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial status
      const tradingService = getAutoTradingService(userId);
      const status = tradingService.getStatus();
      send({ type: 'status', data: status });

      // Set up event listeners
      tradingService.on('trade_executed', (data) => {
        send({ type: 'trade_executed', data });
      });

      tradingService.on('trade_update', (data) => {
        send({ type: 'trade_update', data });
      });

      tradingService.on('trade_closed', (data) => {
        send({ type: 'trade_closed', data });
      });

      tradingService.on('balance_update', (balance) => {
        send({ type: 'balance_update', data: { balance } });
      });

      tradingService.on('error', (error) => {
        send({ type: 'error', data: { message: error.message } });
      });

      tradingService.on('drawdown_limit', (data) => {
        send({ type: 'drawdown_limit', data });
      });

      // Poll for open trades every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          await connectToDatabase();
          const openTrades = await SignalistBotTrade.find({
            userId,
            broker: 'deriv',
            status: 'OPEN',
          }).sort({ entryTimestamp: -1 });

          send({
            type: 'open_trades',
            data: {
              trades: openTrades.map(t => ({
                tradeId: t.tradeId,
                symbol: t.symbol,
                side: t.side,
                entryPrice: t.entryPrice,
                lotOrStake: t.lotOrStake,
                unrealizedPnl: t.unrealizedPnl,
                unrealizedPnlPercent: t.unrealizedPnlPercent,
                entryTimestamp: t.entryTimestamp,
              })),
            },
          });
        } catch (error: any) {
          send({ type: 'error', data: { message: error.message } });
        }
      }, 2000);

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        send({ type: 'heartbeat', timestamp: new Date().toISOString() });
      }, 30000);

      // Cleanup function
      const cleanup = () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      };

      // Handle client disconnect
      if (request.signal) {
        request.signal.addEventListener('abort', cleanup);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

