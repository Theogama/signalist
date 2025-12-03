import { NextRequest, NextResponse } from 'next/server';
import { getStockDetails } from '@/lib/actions/finnhub.actions';

/**
 * Check if symbol is a Deriv instrument (BOOM/CRASH)
 */
function isDerivInstrument(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  return upperSymbol.startsWith('BOOM') || upperSymbol.startsWith('CRASH');
}

/**
 * Check if symbol is an Exness instrument
 */
function isExnessInstrument(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  return ['XAUUSD', 'US30', 'NAS100'].includes(upperSymbol);
}

/**
 * GET /api/market-data/price/[symbol]
 * Get current price for a symbol
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: symbolParam } = await params;
    const symbol = symbolParam.toUpperCase();

    // Handle Deriv instruments (BOOM/CRASH) - not available via Finnhub
    if (isDerivInstrument(symbol)) {
      // Return mock data for Deriv instruments
      // In production, this should use Deriv WebSocket or API
      const isBoom = symbol.startsWith('BOOM');
      const basePrice = 10000;
      const variation = (Math.random() - 0.5) * 0.01; // ±0.5% variation
      const price = basePrice * (1 + variation);
      
      return NextResponse.json({
        symbol: symbol,
        price: price,
        change: variation * basePrice,
        changePercent: variation * 100,
        volume: 0,
        high: basePrice * 1.02,
        low: basePrice * 0.98,
        open: basePrice,
        previousClose: basePrice,
        timestamp: Date.now(),
        source: 'deriv' as const,
        note: 'Mock data - use Deriv WebSocket for live prices',
      });
    }

    // Handle Exness instruments - not available via Finnhub
    if (isExnessInstrument(symbol)) {
      // Return mock data for Exness instruments
      // In production, this should use MT5 service or Exness API
      const basePrices: Record<string, number> = {
        'XAUUSD': 2000,
        'US30': 35000,
        'NAS100': 15000,
      };
      const basePrice = basePrices[symbol] || 1000;
      const variation = (Math.random() - 0.5) * 0.01;
      const price = basePrice * (1 + variation);
      
      return NextResponse.json({
        symbol: symbol,
        price: price,
        change: variation * basePrice,
        changePercent: variation * 100,
        volume: 0,
        high: basePrice * 1.02,
        low: basePrice * 0.98,
        open: basePrice,
        previousClose: basePrice,
        timestamp: Date.now(),
        source: 'exness' as const,
        note: 'Mock data - use MT5 service for live prices',
      });
    }

    // For stock symbols, fetch from Finnhub
    try {
      const stockData = await getStockDetails(symbol);

      if (!stockData.currentPrice) {
        return NextResponse.json(
          { error: 'Price not available for this symbol' },
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
    } catch (finnhubError: any) {
      // If Finnhub fails, return 404
      return NextResponse.json(
        { error: `Price not available for ${symbol}. This symbol may not be supported.` },
        { status: 404 }
      );
    }
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

