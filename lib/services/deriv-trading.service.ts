/**
 * Deriv Trading Service
 * Handles Deriv API trading operations and database synchronization
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { randomUUID } from 'crypto';

export interface DerivTradeParams {
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  duration?: number;
  duration_unit?: 't' | 's';
  contract_type?: 'CALL' | 'PUT' | 'RISE' | 'FALL';
  stopLoss?: number;
  takeProfit?: number;
  apiKey: string;
}

export interface DerivTradeResult {
  success: boolean;
  tradeId?: string;
  contractId?: string;
  entryPrice?: number;
  error?: string;
}

/**
 * Place a trade via Deriv API and save to database
 */
export async function placeDerivTrade(params: DerivTradeParams): Promise<DerivTradeResult> {
  try {
    const {
      userId,
      symbol,
      side,
      amount,
      duration = 5,
      duration_unit = 't',
      contract_type,
      stopLoss,
      takeProfit,
      apiKey,
    } = params;

    // Map symbol to Deriv format
    const derivSymbol = symbol.toUpperCase().startsWith('BOOM') || symbol.toUpperCase().startsWith('CRASH')
      ? symbol.toUpperCase()
      : 'BOOM500'; // Default

    // Determine contract type
    const contractType = contract_type || (side === 'BUY' ? 'CALL' : 'PUT');

    // Call Deriv API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deriv/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: derivSymbol,
        side,
        amount,
        duration,
        duration_unit,
        contract_type: contractType,
        stopLoss,
        takeProfit,
        apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Trade placement failed',
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Trade placement failed',
      };
    }

    return {
      success: true,
      tradeId: data.data.tradeId,
      contractId: data.data.contractId,
      entryPrice: data.data.entryPrice,
    };
  } catch (error: any) {
    console.error('[Deriv Trading Service] Error placing trade:', error);
    return {
      success: false,
      error: error.message || 'Failed to place trade',
    };
  }
}

/**
 * Sync Deriv positions from API and update database
 */
export async function syncDerivPositions(
  userId: string,
  apiKey: string
): Promise<{ openTrades: any[]; closedTrades: any[] }> {
  try {
    await connectToDatabase();

    // Fetch trades from database
    const openTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: 'OPEN',
    })
      .sort({ entryTimestamp: -1 })
      .lean();

    const closedTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: { $in: ['CLOSED', 'TP_HIT', 'SL_HIT', 'MANUAL_CLOSE'] },
    })
      .sort({ exitTimestamp: -1 })
      .limit(50)
      .lean();

    // TODO: Optionally sync with Deriv API to update positions
    // This would involve calling Deriv's portfolio/contracts endpoint
    // and updating the database with current status

    return {
      openTrades: openTrades.map(formatTrade),
      closedTrades: closedTrades.map(formatTrade),
    };
  } catch (error: any) {
    console.error('[Deriv Trading Service] Error syncing positions:', error);
    return { openTrades: [], closedTrades: [] };
  }
}

/**
 * Update trade status (e.g., when position closes)
 */
export async function updateDerivTradeStatus(
  tradeId: string,
  updates: {
    status?: 'OPEN' | 'CLOSED' | 'TP_HIT' | 'SL_HIT';
    exitPrice?: number;
    realizedPnl?: number;
    realizedPnlPercent?: number;
    exitReason?: string;
  }
): Promise<boolean> {
  try {
    await connectToDatabase();

    await SignalistBotTrade.findOneAndUpdate(
      { tradeId },
      {
        ...updates,
        exitTimestamp: updates.status !== 'OPEN' ? new Date() : undefined,
        updatedAt: new Date(),
      }
    );

    return true;
  } catch (error: any) {
    console.error('[Deriv Trading Service] Error updating trade:', error);
    return false;
  }
}

/**
 * Format trade for frontend
 */
function formatTrade(trade: any) {
  return {
    id: trade.tradeId,
    symbol: trade.symbol,
    side: trade.side,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice || trade.entryPrice,
    quantity: trade.lotOrStake || trade.quantity || 0,
    profitLoss: trade.realizedPnl || trade.unrealizedPnl || 0,
    status: trade.status === 'OPEN' ? 'OPEN' as const :
            trade.status === 'TP_HIT' ? 'CLOSED' as const :
            trade.status === 'SL_HIT' ? 'STOPPED' as const :
            'CLOSED' as const,
    openedAt: trade.entryTimestamp || trade.openedAt,
    closedAt: trade.exitTimestamp || trade.closedAt || trade.updatedAt,
    brokerTradeId: trade.brokerTradeId,
    // Include additional Deriv-specific fields
    currentPrice: trade.exitPrice || trade.entryPrice,
    unrealizedPnl: trade.unrealizedPnl,
    realizedPnl: trade.realizedPnl,
  };
}



