/**
 * Deriv Market Data History API
 * 
 * Returns historical OHLC data for charting
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { decrypt } from '@/lib/utils/encryption';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

/**
 * GET /api/deriv/market-data/history
 * Get historical OHLC data for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BOOM500';
    const timeframe = searchParams.get('timeframe') || '1m';
    const count = parseInt(searchParams.get('count') || '100');

    // Map timeframe to granularity (in seconds)
    const timeframeMap: Record<string, number> = {
      '1t': 1,
      '5t': 5,
      '15t': 15,
      '30t': 30,
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };

    const granularity = timeframeMap[timeframe] || 60;

    await connectToDatabase();

    // Get user's Deriv token
    const tokenDoc = await DerivApiToken.findOne({
      userId,
      isValid: true,
    }).select('+token');

    if (!tokenDoc || !tokenDoc.token) {
      return NextResponse.json(
        { success: false, error: 'No valid Deriv API token found' },
        { status: 404 }
      );
    }

    // Decrypt token
    const token = await decrypt(tokenDoc.token);

    // Connect to Deriv and get historical data
    const wsClient = new DerivServerWebSocketClient(token);
    await wsClient.connect();

    try {
      // Request historical data
      const reqId = (wsClient as any).requestId++;
      const history = await new Promise<any[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('History request timeout'));
        }, 10000);

        (wsClient as any).sendMessage({
          ticks_history: symbol,
          adjust_start_time: 1,
          end: 'latest',
          count,
          granularity,
          style: 'candles',
          req_id: reqId,
        });

        const handler = (data: any) => {
          if (data.req_id === reqId) {
            clearTimeout(timeout);
            if (data.error) {
              reject(new Error(data.error.message));
              return;
            }

            const candles = data.candles || data.history?.candles || [];
            resolve(candles);
          }
        };

        (wsClient as any).pendingRequests.set(reqId, {
          resolve: handler,
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        });
      });

      await wsClient.disconnect();

      // Format data for chart
      const chartData = history.map((candle: any) => ({
        time: candle.epoch * 1000,
        open: parseFloat(candle.open || 0),
        high: parseFloat(candle.high || 0),
        low: parseFloat(candle.low || 0),
        close: parseFloat(candle.close || 0),
        volume: parseFloat(candle.volume || 0),
      }));

      return NextResponse.json({
        success: true,
        data: chartData,
        symbol,
        timeframe,
        count: chartData.length,
      });
    } catch (error: any) {
      await wsClient.disconnect();
      throw error;
    }
  } catch (error: any) {
    console.error('[Deriv Market Data History] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}


