/**
 * POST /api/deriv/trade
 * Place a trade using Deriv API (WebSocket)
 * 
 * This endpoint uses the Deriv WebSocket API to place real trades
 * and saves them to the database for display in Signalist stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { randomUUID } from 'crypto';
import { placeDerivBuyContract } from '@/lib/deriv/websocket-client';

interface DerivTradeRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number; // Stake amount
  duration?: number; // Duration in ticks or seconds
  duration_unit?: 't' | 's'; // 't' for ticks, 's' for seconds
  contract_type?: 'CALL' | 'PUT' | 'RISE' | 'FALL';
  stopLoss?: number;
  takeProfit?: number;
  apiKey?: string; // OAuth token or API key
}

/**
 * Place trade via Deriv WebSocket API
 */
async function placeDerivTrade(
  apiKey: string,
  request: DerivTradeRequest
): Promise<{ success: boolean; contract_id?: string; purchase_price?: number; error?: string }> {
  try {
    // Use the WebSocket client to place the trade
    const response = await placeDerivBuyContract(apiKey, {
      price: request.amount,
      parameters: {
        contract_type: request.contract_type || (request.side === 'BUY' ? 'CALL' : 'PUT'),
        symbol: request.symbol,
        amount: request.amount,
        duration: request.duration || 5,
        duration_unit: request.duration_unit || 't',
        basis: 'stake',
      },
    });

    if (response.error) {
      return {
        success: false,
        error: response.error.message || 'Trade failed',
      };
    }

    if (!response.buy) {
      return {
        success: false,
        error: 'Invalid response from Deriv API',
      };
    }

    return {
      success: true,
      contract_id: response.buy.contract_id,
      purchase_price: response.buy.purchase_price,
    };
  } catch (error: any) {
    console.error('[Deriv Trade] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to place trade',
    };
  }
}

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
      symbol,
      side,
      amount,
      duration = 5,
      duration_unit = 't',
      contract_type,
      stopLoss,
      takeProfit,
      apiKey,
    } = body as DerivTradeRequest;

    // Validate required fields
    if (!symbol || !side || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, side, amount' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key or OAuth token required' },
        { status: 400 }
      );
    }

    // Determine contract type for Deriv
    const derivContractType = contract_type || (side === 'BUY' ? 'CALL' : 'PUT');
    
    // Map symbol to Deriv format (e.g., BOOM500, CRASH500)
    const derivSymbol = symbol.toUpperCase().startsWith('BOOM') || symbol.toUpperCase().startsWith('CRASH')
      ? symbol.toUpperCase()
      : `BOOM500`; // Default to BOOM500 if not specified

    // Place trade via Deriv API
    const tradeResult = await placeDerivTrade(apiKey, {
      symbol: derivSymbol,
      side,
      amount,
      duration,
      duration_unit,
      contract_type: derivContractType,
      stopLoss,
      takeProfit,
    });

    if (!tradeResult.success || !tradeResult.contract_id) {
      return NextResponse.json(
        { success: false, error: tradeResult.error || 'Trade placement failed' },
        { status: 500 }
      );
    }

    // Save trade to database
    await connectToDatabase();
    const tradeId = randomUUID();
    
    const trade = new SignalistBotTrade({
      tradeId,
      userId,
      broker: 'deriv',
      symbol: derivSymbol,
      side,
      entryPrice: tradeResult.purchase_price || 0,
      lotOrStake: amount,
      stopLoss: stopLoss || 0,
      takeProfit: takeProfit || 0,
      status: 'OPEN',
      entryTimestamp: new Date(),
      brokerTradeId: tradeResult.contract_id,
      entryReason: 'Deriv API Trade',
    });

    await trade.save();

    return NextResponse.json({
      success: true,
      data: {
        tradeId,
        contractId: tradeResult.contract_id,
        symbol: derivSymbol,
        side,
        entryPrice: tradeResult.purchase_price,
        amount,
        status: 'OPEN',
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    console.error('[Deriv Trade API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to place trade' },
      { status: 500 }
    );
  }
}

