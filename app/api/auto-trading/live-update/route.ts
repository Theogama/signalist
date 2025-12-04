/**
 * Push Live Trade Update API
 * Receives and broadcasts live trade updates (open, close, TP, SL, win, lose)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const {
      type, // 'OPEN' | 'CLOSE' | 'TP_HIT' | 'SL_HIT' | 'WIN' | 'LOSE'
      tradeId,
      symbol,
      side,
      price,
      quantity,
      profitLoss,
      reason,
    } = body;

    if (!type || !tradeId || !symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, tradeId, symbol' },
        { status: 400 }
      );
    }

    // Emit appropriate log based on update type
    switch (type) {
      case 'OPEN':
        logEmitter.success(
          `Trade opened: ${side} ${symbol} at $${price?.toFixed(2) || 'N/A'}`,
          userId,
          { tradeId, symbol, side, price, quantity }
        );
        break;
      case 'CLOSE':
        logEmitter.info(
          `Trade closed: ${symbol} at $${price?.toFixed(2) || 'N/A'}${profitLoss ? ` | P/L: $${profitLoss.toFixed(2)}` : ''}`,
          userId,
          { tradeId, symbol, side, price, profitLoss }
        );
        break;
      case 'TP_HIT':
        logEmitter.success(
          `Take Profit hit: ${symbol} | Profit: $${profitLoss?.toFixed(2) || '0.00'}`,
          userId,
          { tradeId, symbol, profitLoss, reason }
        );
        break;
      case 'SL_HIT':
        logEmitter.error(
          `Stop Loss hit: ${symbol} | Loss: $${Math.abs(profitLoss || 0).toFixed(2)}`,
          userId,
          { tradeId, symbol, profitLoss, reason }
        );
        break;
      case 'WIN':
        logEmitter.success(
          `Trade won: ${symbol} | Profit: $${profitLoss?.toFixed(2) || '0.00'}`,
          userId,
          { tradeId, symbol, profitLoss }
        );
        break;
      case 'LOSE':
        logEmitter.error(
          `Trade lost: ${symbol} | Loss: $${Math.abs(profitLoss || 0).toFixed(2)}`,
          userId,
          { tradeId, symbol, profitLoss }
        );
        break;
      default:
        logEmitter.info(
          `Trade update: ${type} - ${symbol}`,
          userId,
          { tradeId, symbol, type, price, profitLoss }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Live update broadcasted successfully',
      data: {
        type,
        tradeId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error pushing live update:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to push live update' },
      { status: 500 }
    );
  }
}


