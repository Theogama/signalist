import { NextRequest, NextResponse } from 'next/server';
import { getStockDetails } from '@/lib/actions/finnhub.actions';

/**
 * GET /api/market-data/price/[symbol]
 * Get current price for a symbol
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();

    // Fetch live price from Finnhub
    const stockData = await getStockDetails(symbol);

    if (!stockData.currentPrice) {
      return NextResponse.json(
        { error: 'Price not available' },
        { status: 404 }
      );
    }

    // Extract quote data for complete market information
    const quote = stockData.quote;
    const change = stockData.changePercent ? (stockData.currentPrice * stockData.changePercent) / 100 : 0;
    
    // Finnhub quote structure: { c: current, h: high, l: low, o: open, pc: previous close, v: volume }
    return NextResponse.json({
      symbol: stockData.symbol,
      price: stockData.currentPrice,
      change: change,
      changePercent: stockData.changePercent || 0,
      volume: quote?.v || 0,
      high: quote?.h || stockData.currentPrice,
      low: quote?.l || stockData.currentPrice,
      open: quote?.o || stockData.currentPrice,
      previousClose: quote?.pc || stockData.currentPrice,
      timestamp: Date.now(),
      source: 'finnhub' as const,
    });
  } catch (error: any) {
    console.error('Error fetching price:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch price' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

