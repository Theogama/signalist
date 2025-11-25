/**
 * Live Updates API
 * Server-Sent Events (SSE) endpoint for real-time trading updates
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    // Create SSE stream
    let interval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Live updates connected' })}\n\n`)
        );

        // Subscribe to log events
        unsubscribe = logEmitter.subscribe(userId, (log) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending log event:', error);
          }
        });

        // Set up interval to send updates
        interval = setInterval(async () => {
          try {
            const activeBots = botManager.getUserBots(userId);
            
            if (activeBots.length === 0) {
              return;
            }

            // Collect updates from all active bots
            let totalBalance = 0;
            let totalEquity = 0;
            let totalMargin = 0;
            const openTrades: any[] = [];
            const closedTrades: any[] = [];

            for (const bot of activeBots) {
              if (bot.paperTrader) {
                const balance = bot.paperTrader.getBalance();
                totalBalance += balance.balance;
                totalEquity += balance.equity;
                totalMargin += balance.margin;

                // Get open positions as trades
                const openPositions = bot.paperTrader.getOpenPositions();
                openTrades.push(...openPositions.map((p) => ({
                  id: p.tradeId,
                  symbol: p.position.symbol || bot.instrument,
                  side: p.position.side || 'BUY',
                  entryPrice: p.position.entryPrice,
                  quantity: p.position.quantity,
                  status: 'OPEN' as const,
                  openedAt: p.position.openedAt || new Date(),
                  profitLoss: undefined,
                  exitPrice: undefined,
                })));

                // Get closed trades from history
                const history = bot.paperTrader.getHistory();
                closedTrades.push(...history.slice(-10).map((trade) => ({
                  id: trade.tradeId,
                  symbol: trade.symbol,
                  side: trade.side,
                  entryPrice: trade.entryPrice,
                  exitPrice: trade.exitPrice,
                  quantity: trade.quantity,
                  profitLoss: trade.profitLoss,
                  status: trade.status === 'TAKE_PROFIT' ? 'CLOSED' as const : 
                          trade.status === 'STOPPED' ? 'STOPPED' as const : 'CLOSED' as const,
                  openedAt: trade.openedAt,
                  closedAt: trade.closedAt,
                })));
              }
            }

            // Send balance update (get fresh balance from PaperTrader)
            if (activeBots.length > 0 && activeBots[0].paperTrader) {
              const freshBalance = activeBots[0].paperTrader.getBalance();
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'balance',
                    data: {
                      balance: freshBalance.balance,
                      equity: freshBalance.equity,
                      margin: freshBalance.margin,
                      freeMargin: freshBalance.freeMargin,
                      marginLevel: freshBalance.marginLevel,
                    },
                  })}\n\n`
                )
              );
            } else {
              // Fallback if no active trader
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'balance',
                    data: {
                      balance: totalBalance || 10000,
                      equity: totalEquity || 10000,
                      margin: totalMargin,
                      freeMargin: (totalEquity || 10000) - totalMargin,
                    },
                  })}\n\n`
                )
              );
            }

            // Send open trades update
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'open_trades',
                  data: openTrades,
                })}\n\n`
              )
            );

            // Send closed trades update (only if there are new ones)
            if (closedTrades.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'closed_trades',
                    data: closedTrades,
                  })}\n\n`
                )
              );
            }
          } catch (error) {
            console.error('Error sending live update:', error);
          }
        }, 2000); // Update every 2 seconds
      },
      cancel() {
        // Cleanup on close
        if (unsubscribe) {
          unsubscribe();
        }
        if (interval) {
          clearInterval(interval);
          interval = null;
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
  } catch (error: any) {
    console.error('Error in live updates stream:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

