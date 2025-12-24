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
    let isClosed = false;
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Helper function to safely enqueue data
        const safeEnqueue = (data: Uint8Array) => {
          try {
            if (!isClosed) {
              controller.enqueue(data);
            }
          } catch (error: any) {
            // Controller might be closed
            if (error.code === 'ERR_INVALID_STATE' || error.message?.includes('closed')) {
              isClosed = true;
              if (interval) {
                clearInterval(interval);
                interval = null;
              }
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
              }
            } else {
              console.error('Error enqueueing data:', error);
            }
          }
        };
        
        // Track previous closed trades to detect new ones (scoped to this stream)
        const previousClosedTradeIds = new Set<string>();
        
        // Send initial connection message
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Live updates connected' })}\n\n`)
        );

        // Subscribe to log events
        unsubscribe = logEmitter.subscribe(userId, (log) => {
          try {
            if (isClosed) return;
            
            // If log has balance data, send it as a balance update
            if (log.type === 'balance' && log.data) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'balance',
                    data: log.data,
                  })}\n\n`
                )
              );
            }
            
            // If log is a trade event with closed status, send trade_closed event
            if (log.type === 'trade' && log.data) {
              const trade = log.data;
              if (trade.status && ['CLOSED', 'TP_HIT', 'SL_HIT', 'STOPPED'].includes(trade.status)) {
                // Send immediate trade_closed event
                safeEnqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'trade_closed',
                      data: {
                        id: trade.tradeId || trade.id,
                        symbol: trade.symbol,
                        side: trade.side,
                        entryPrice: trade.entryPrice,
                        exitPrice: trade.exitPrice,
                        quantity: trade.quantity,
                        profitLoss: trade.profitLoss,
                        status: trade.status,
                        closedAt: trade.closedAt || new Date().toISOString(),
                      },
                    })}\n\n`
                  )
                );
              }
            }
            
            // Always send log events
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`)
            );
          } catch (error) {
            console.error('Error sending log event:', error);
          }
        });

        // Track last update times for different update types
        let lastTradeUpdate = 0;
        let lastBalanceUpdate = 0;
        const TRADE_UPDATE_INTERVAL = 500; // 500ms for trade updates (high priority)
        const BALANCE_UPDATE_INTERVAL = 1000; // 1s for balance updates (lower priority)

        // Set up interval to send updates with prioritized timing
        interval = setInterval(async () => {
          try {
            // Check if stream is closed before processing
            if (isClosed) {
              if (interval) {
                clearInterval(interval);
                interval = null;
              }
              return;
            }
            
            const activeBots = botManager.getUserBots(userId);
            
            if (activeBots.length === 0) {
              return;
            }

            const now = Date.now();
            const shouldUpdateTrades = now - lastTradeUpdate >= TRADE_UPDATE_INTERVAL;
            const shouldUpdateBalance = now - lastBalanceUpdate >= BALANCE_UPDATE_INTERVAL;

            // Collect updates from all active bots
            let totalBalance = 0;
            let totalEquity = 0;
            let totalMargin = 0;
            const openTrades: any[] = [];
            const closedTrades: any[] = [];

            // PRIORITY: Fetch Deriv trades from database if Deriv is connected
            if (shouldUpdateTrades) {
              try {
                const { syncDerivPositions } = await import('@/lib/services/deriv-trading.service');
                const derivPositions = await syncDerivPositions(userId, '');
                if (derivPositions.openTrades.length > 0 || derivPositions.closedTrades.length > 0) {
                  openTrades.push(...derivPositions.openTrades);
                  closedTrades.push(...derivPositions.closedTrades);
                }
              } catch (error) {
                console.error('[Live Updates] Error fetching Deriv positions:', error);
              }
            }

            for (const bot of activeBots) {
              if (bot.paperTrader) {
                const balance = bot.paperTrader.getBalance();
                totalBalance += balance.balance;
                totalEquity += balance.equity;
                totalMargin += balance.margin;

                // PRIORITY: Get open positions as trades with current P/L (updated frequently)
                if (shouldUpdateTrades) {
                  const openPositions = bot.paperTrader.getOpenPositions();
                  openTrades.push(...openPositions.map((p) => {
                    // Calculate current P/L
                    const currentPrice = p.position.currentPrice || p.position.entryPrice;
                    let currentPnl = 0;
                    if (p.position.side === 'BUY') {
                      currentPnl = (currentPrice - p.position.entryPrice) * p.position.quantity;
                    } else {
                      currentPnl = (p.position.entryPrice - currentPrice) * p.position.quantity;
                    }
                    
                    return {
                      id: p.tradeId,
                      symbol: p.position.symbol || bot.instrument,
                      side: p.position.side || 'BUY',
                      entryPrice: p.position.entryPrice,
                      quantity: p.position.quantity,
                      status: 'OPEN' as const,
                      openedAt: p.position.openedAt || new Date(),
                      profitLoss: currentPnl,
                      exitPrice: currentPrice,
                      currentPrice,
                    };
                  }));

                  // PRIORITY: Get closed trades from history (check for new ones immediately)
                  const history = bot.paperTrader.getHistory();
                  const recentClosed = history.slice(-20).map((trade) => ({
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
                  }));
                  
                  // IMMEDIATE: Detect new closed trades and send instant events
                  recentClosed.forEach((trade) => {
                    if (!previousClosedTradeIds.has(trade.id) && !isClosed) {
                      // New closed trade - send IMMEDIATE event (highest priority)
                      safeEnqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'trade_closed',
                            data: trade,
                            priority: 'high',
                            timestamp: Date.now(),
                          })}\n\n`
                        )
                      );
                      previousClosedTradeIds.add(trade.id);
                    }
                  });
                  
                  closedTrades.push(...recentClosed);
                }
              }
            }

            // PRIORITY: Send open trades update (every 500ms when trades exist)
            if (shouldUpdateTrades && openTrades.length > 0 && !isClosed) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'open_trades',
                    data: openTrades,
                    priority: 'high',
                    timestamp: Date.now(),
                  })}\n\n`
                )
              );
              lastTradeUpdate = now;
            }

            // PRIORITY: Send position updates for open trades (real-time P/L)
            if (shouldUpdateTrades && !isClosed) {
              openTrades.forEach((trade) => {
                safeEnqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'position_update',
                      data: {
                        id: trade.id,
                        tradeId: trade.id,
                        currentPnl: trade.profitLoss,
                        profitLoss: trade.profitLoss,
                        currentPrice: trade.exitPrice,
                      },
                      priority: 'high',
                      timestamp: Date.now(),
                    })}\n\n`
                  )
                );
              });
            }

            // Send balance update (less frequent - every 1s)
            if (shouldUpdateBalance && activeBots.length > 0 && !isClosed) {
              let balanceToSend;
              if (totalBalance > 0) {
                balanceToSend = {
                  balance: totalBalance,
                  equity: totalEquity,
                  margin: totalMargin,
                  freeMargin: Math.max(0, totalEquity - totalMargin),
                  marginLevel: totalMargin > 0 ? (totalEquity / totalMargin) * 100 : 0,
                };
              } else if (activeBots[0].paperTrader) {
                const freshBalance = activeBots[0].paperTrader.getBalance();
                balanceToSend = {
                  balance: freshBalance.balance,
                  equity: freshBalance.equity,
                  margin: freshBalance.margin,
                  freeMargin: freshBalance.freeMargin,
                  marginLevel: freshBalance.marginLevel,
                };
              } else {
                balanceToSend = {
                  balance: 10000,
                  equity: 10000,
                  margin: 0,
                  freeMargin: 10000,
                  marginLevel: 0,
                };
              }
              
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'balance',
                    data: balanceToSend,
                    priority: 'normal',
                    timestamp: Date.now(),
                  })}\n\n`
                )
              );
              lastBalanceUpdate = now;
            }

            // Send closed trades update (only if there are new ones)
            if (shouldUpdateTrades && closedTrades.length > 0 && !isClosed) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'closed_trades',
                    data: closedTrades,
                    priority: 'high',
                    timestamp: Date.now(),
                  })}\n\n`
                )
              );
            }
          } catch (error: any) {
            // Check if error is due to closed controller
            if (error.code === 'ERR_INVALID_STATE' || error.message?.includes('closed')) {
              isClosed = true;
              if (interval) {
                clearInterval(interval);
                interval = null;
              }
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
              }
            } else {
              console.error('Error sending live update:', error);
            }
          }
        }, 1000); // Check every 1 second (reduced frequency to prevent overload)
      },
      cancel() {
        // Cleanup on close
        isClosed = true;
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
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

