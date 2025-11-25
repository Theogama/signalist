'use client';

/**
 * Instruments Selector Component
 * Displays and allows selection of trading instruments
 */

import { useEffect } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useDerivWebSocket } from '@/lib/hooks/useDerivWebSocket';

// Define all supported instruments
const EXNESS_INSTRUMENTS = [
  { symbol: 'XAUUSD', name: 'Gold (XAU/USD)', broker: 'exness' as const, category: 'Metals' },
  { symbol: 'US30', name: 'Dow Jones 30', broker: 'exness' as const, category: 'Indices' },
  { symbol: 'NAS100', name: 'Nasdaq 100', broker: 'exness' as const, category: 'Indices' },
];

const DERIV_INSTRUMENTS = [
  { symbol: 'BOOM1000', name: 'Boom 1000', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM500', name: 'Boom 500', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM300', name: 'Boom 300', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'BOOM100', name: 'Boom 100', broker: 'deriv' as const, category: 'Boom' },
  { symbol: 'CRASH1000', name: 'Crash 1000', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH500', name: 'Crash 500', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH300', name: 'Crash 300', broker: 'deriv' as const, category: 'Crash' },
  { symbol: 'CRASH100', name: 'Crash 100', broker: 'deriv' as const, category: 'Crash' },
];

export default function InstrumentsSelector() {
  const {
    connectedBroker,
    selectedInstrument,
    availableInstruments,
    setSelectedInstrument,
    loadInstruments,
  } = useAutoTradingStore();

  // Subscribe to live prices for selected Deriv instrument
  const selectedSymbol = connectedBroker === 'deriv' && selectedInstrument?.symbol 
    ? selectedInstrument.symbol 
    : undefined;
  const { price, isConnected } = useDerivWebSocket(selectedSymbol);

  useEffect(() => {
    if (connectedBroker && availableInstruments.length === 0) {
      // Load instruments if not already loaded
      loadInstruments(connectedBroker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker]); // Only depend on connectedBroker

  // Separate effect for auto-selecting instrument
  useEffect(() => {
    if (connectedBroker && !selectedInstrument && availableInstruments.length > 0) {
      setSelectedInstrument(availableInstruments[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableInstruments.length, connectedBroker]); // Only depend on length, not the array itself

  const instruments = availableInstruments.length > 0 
    ? availableInstruments 
    : (connectedBroker === 'exness' ? EXNESS_INSTRUMENTS : DERIV_INSTRUMENTS);

  const groupedInstruments = instruments.reduce((acc, instrument) => {
    const category = instrument.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(instrument);
    return acc;
  }, {} as Record<string, typeof instruments>);

  if (!connectedBroker) {
    return (
      <div className="text-center py-8 text-gray-400">
        Connect a broker to view available instruments
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedInstruments).map(([category, categoryInstruments]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">{category}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {categoryInstruments.map((instrument) => (
              <Button
                key={instrument.symbol}
                variant={selectedInstrument?.symbol === instrument.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedInstrument(instrument)}
                className="justify-start"
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{instrument.symbol}</span>
                  <span className="text-xs text-gray-400">{instrument.name}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ))}

      {selectedInstrument && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm text-gray-400">Selected:</span>
              <span className="ml-2 font-semibold text-gray-100">
                {selectedInstrument.symbol} - {selectedInstrument.name}
              </span>
            </div>
            <Badge variant="outline">{connectedBroker.toUpperCase()}</Badge>
          </div>
          {connectedBroker === 'deriv' && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-500" />
                )}
                <span className="text-xs text-gray-400">
                  {isConnected ? 'Live' : 'Connecting...'}
                </span>
              </div>
              {price > 0 && (
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-100">
                    {price.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



