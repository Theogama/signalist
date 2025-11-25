/**
 * Symbol Mapper
 * Maps internal symbols to broker-specific symbols for Exness and Deriv
 */

export type BrokerType = 'exness' | 'deriv';

/**
 * Exness symbol mapping
 */
export const EXNESS_SYMBOL_MAP: Record<string, string> = {
  // Gold
  'XAUUSD': 'XAUUSD',
  'GOLD': 'XAUUSD',
  'GOLD/USD': 'XAUUSD',
  
  // Indices
  'US30': 'US30',
  'DOW': 'US30',
  'DOW30': 'US30',
  'NAS100': 'NAS100',
  'NASDAQ': 'NAS100',
  'NASDAQ100': 'NAS100',
  'SPX500': 'SPX500',
  'SP500': 'SPX500',
  
  // Forex
  'EURUSD': 'EURUSD',
  'GBPUSD': 'GBPUSD',
  'USDJPY': 'USDJPY',
  'AUDUSD': 'AUDUSD',
  'USDCAD': 'USDCAD',
};

/**
 * Deriv symbol mapping (Boom/Crash indices)
 */
export const DERIV_SYMBOL_MAP: Record<string, string> = {
  // Boom indices
  'BOOM_1000': 'BOOM1000',
  'BOOM1000': 'BOOM1000',
  'BOOM_500': 'BOOM500',
  'BOOM500': 'BOOM500',
  'BOOM_300': 'BOOM300',
  'BOOM300': 'BOOM300',
  'BOOM_100': 'BOOM100',
  'BOOM100': 'BOOM100',
  
  // Crash indices
  'CRASH_1000': 'CRASH1000',
  'CRASH1000': 'CRASH1000',
  'CRASH_500': 'CRASH500',
  'CRASH500': 'CRASH500',
  'CRASH_300': 'CRASH300',
  'CRASH300': 'CRASH300',
  'CRASH_100': 'CRASH100',
  'CRASH100': 'CRASH100',
  
  // Generic mappings
  'BOOM': 'BOOM1000', // Default to 1000
  'CRASH': 'CRASH1000', // Default to 1000
};

/**
 * Reverse mapping: broker symbol to internal symbol
 */
export const EXNESS_REVERSE_MAP: Record<string, string> = {
  'XAUUSD': 'XAUUSD',
  'US30': 'US30',
  'NAS100': 'NAS100',
  'SPX500': 'SPX500',
  'EURUSD': 'EURUSD',
  'GBPUSD': 'GBPUSD',
  'USDJPY': 'USDJPY',
  'AUDUSD': 'AUDUSD',
  'USDCAD': 'USDCAD',
};

export const DERIV_REVERSE_MAP: Record<string, string> = {
  'BOOM1000': 'BOOM_1000',
  'BOOM500': 'BOOM_500',
  'BOOM300': 'BOOM_300',
  'BOOM100': 'BOOM_100',
  'CRASH1000': 'CRASH_1000',
  'CRASH500': 'CRASH_500',
  'CRASH300': 'CRASH_300',
  'CRASH100': 'CRASH_100',
};

/**
 * Map internal symbol to broker-specific symbol
 */
export function mapSymbolToBroker(internalSymbol: string, broker: BrokerType): string {
  const upperSymbol = internalSymbol.toUpperCase();
  
  if (broker === 'exness') {
    return EXNESS_SYMBOL_MAP[upperSymbol] || upperSymbol;
  } else if (broker === 'deriv') {
    return DERIV_SYMBOL_MAP[upperSymbol] || upperSymbol;
  }
  
  return upperSymbol;
}

/**
 * Map broker symbol back to internal symbol
 */
export function mapBrokerSymbolToInternal(brokerSymbol: string, broker: BrokerType): string {
  const upperSymbol = brokerSymbol.toUpperCase();
  
  if (broker === 'exness') {
    return EXNESS_REVERSE_MAP[upperSymbol] || upperSymbol;
  } else if (broker === 'deriv') {
    return DERIV_REVERSE_MAP[upperSymbol] || upperSymbol;
  }
  
  return upperSymbol;
}

/**
 * Normalize price between brokers
 * Some brokers may have different price formats (e.g., gold in different units)
 */
export function normalizePrice(price: number, symbol: string, broker: BrokerType): number {
  // For now, prices are already normalized
  // In the future, this could handle unit conversions if needed
  return price;
}

/**
 * Check if symbol is supported by broker
 */
export function isSymbolSupported(symbol: string, broker: BrokerType): boolean {
  const upperSymbol = symbol.toUpperCase();
  
  if (broker === 'exness') {
    return upperSymbol in EXNESS_SYMBOL_MAP || 
           Object.values(EXNESS_SYMBOL_MAP).includes(upperSymbol);
  } else if (broker === 'deriv') {
    return upperSymbol in DERIV_SYMBOL_MAP || 
           Object.values(DERIV_SYMBOL_MAP).includes(upperSymbol);
  }
  
  return false;
}

/**
 * Get all supported symbols for a broker
 */
export function getSupportedSymbols(broker: BrokerType): string[] {
  if (broker === 'exness') {
    return Object.values(EXNESS_SYMBOL_MAP);
  } else if (broker === 'deriv') {
    return Object.values(DERIV_SYMBOL_MAP);
  }
  
  return [];
}

