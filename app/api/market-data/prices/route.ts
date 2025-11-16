import { NextRequest, NextResponse } from 'next/server';
import { getStockDetails } from '@/lib/actions/finnhub.actions';

/**
 * POST /api/market-data/prices
 * Get current prices for multiple symbols
 */
export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json();

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Invalid symbols array' },
        { status: 400 }
      );
    }

    // Fetch prices for all symbols in parallel
    const pricePromises = symbols.map(async (symbol: string) => {
      try {
        const stockData = await getStockDetails(symbol);
        
        if (!stockData.currentPrice) {
          return null;
        }

        return {
          symbol: stockData.symbol,
          price: stockData.currentPrice,
          change: stockData.changePercent ? (stockData.currentPrice * stockData.changePercent) / 100 : 0,
          changePercent: stockData.changePercent || 0,
          volume: 0,
          high: 0,
          low: 0,
          open: 0,
          previousClose: 0,
          timestamp: Date.now(),
          source: 'finnhub' as const,
        };
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return null;
      }
    });

    const prices = (await Promise.all(pricePromises)).filter(
      (price): price is NonNullable<typeof price> => price !== null
    );

    return NextResponse.json(prices);
  } catch (error: any) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

