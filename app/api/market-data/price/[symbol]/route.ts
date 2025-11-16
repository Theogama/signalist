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

    return NextResponse.json({
      symbol: stockData.symbol,
      price: stockData.currentPrice,
      change: stockData.changePercent ? (stockData.currentPrice * stockData.changePercent) / 100 : 0,
      changePercent: stockData.changePercent || 0,
      volume: 0, // TODO: Get from quote data
      high: 0, // TODO: Get from quote data
      low: 0, // TODO: Get from quote data
      open: 0, // TODO: Get from quote data
      previousClose: 0, // TODO: Get from quote data
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

