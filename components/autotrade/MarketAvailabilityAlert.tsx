'use client';

/**
 * Market Availability Alert Component
 * Shows market status for Deriv (API-based) and Exness (time-based/informational)
 * COMPLIANCE-AWARE: Differentiates between broker capabilities
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Info,
  ExternalLink,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketStatus {
  isOpen: boolean;
  reason?: string;
  nextOpen?: string;
  source: 'api' | 'time-based' | 'unknown';
}

export default function MarketAvailabilityAlert() {
  const { connectedBroker } = useAutoTradingStore();
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!connectedBroker) {
      setMarketStatus(null);
      return;
    }

    const checkMarketStatus = async () => {
      setIsLoading(true);
      try {
        if (connectedBroker === 'deriv') {
          // Check Deriv market status via API
          const response = await fetch('/api/deriv/market-status');
          if (response.ok) {
            const data = await response.json();
            setMarketStatus({
              isOpen: data.isOpen || false,
              reason: data.reason,
              nextOpen: data.nextOpen,
              source: 'api',
            });
          } else {
            // Fallback: assume open if API check fails
            setMarketStatus({
              isOpen: true,
              source: 'api',
            });
          }
        } else if (connectedBroker === 'exness') {
          // Exness: Time-based estimation (no API available)
          const now = new Date();
          const day = now.getDay(); // 0 = Sunday, 6 = Saturday
          const hour = now.getHours();
          const minute = now.getMinutes();
          const currentTime = hour * 60 + minute;

          // Forex market hours (simplified):
          // Sunday 22:00 GMT - Friday 22:00 GMT (approximately)
          // For demo purposes, we'll use a simple weekday check
          const isWeekend = day === 0 || day === 6;
          const isMarketHours = !isWeekend && (
            (currentTime >= 0 && currentTime < 22 * 60) || // Before 22:00
            (day === 5 && currentTime < 22 * 60) // Friday before 22:00
          );

          setMarketStatus({
            isOpen: isMarketHours,
            reason: isWeekend 
              ? 'Markets closed on weekends' 
              : !isMarketHours 
                ? 'Markets closed (standard trading hours: Sunday 22:00 GMT - Friday 22:00 GMT)'
                : undefined,
            source: 'time-based',
          });
        }
      } catch (error) {
        console.error('Error checking market status:', error);
        // Default to open for Deriv, time-based for Exness
        setMarketStatus({
          isOpen: connectedBroker === 'deriv',
          source: connectedBroker === 'deriv' ? 'api' : 'time-based',
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkMarketStatus();
    // Refresh every 5 minutes
    const interval = setInterval(checkMarketStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connectedBroker]);

  if (!connectedBroker || !marketStatus) {
    return null;
  }

  const isDeriv = connectedBroker === 'deriv';
  const isExness = connectedBroker === 'exness';

  return (
    <Card className={`mb-4 ${
      marketStatus.isOpen 
        ? 'border-green-500/50 bg-green-500/10' 
        : 'border-red-500/50 bg-red-500/10'
    }`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          {marketStatus.isOpen ? (
            <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
          )}
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold ${
                marketStatus.isOpen ? 'text-green-400' : 'text-red-400'
              }`}>
                {marketStatus.isOpen ? '🟢 Market Open' : '🔴 Market Closed'}
              </span>
              
              {isDeriv && (
                <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                  API Status
                </Badge>
              )}
              
              {isExness && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400">
                  <Lock className="h-3 w-3 mr-1" />
                  Time-Based Estimate
                </Badge>
              )}
            </div>

            {!marketStatus.isOpen && marketStatus.reason && (
              <p className="text-sm text-gray-300">
                {marketStatus.reason}
              </p>
            )}

            {marketStatus.nextOpen && (
              <p className="text-xs text-gray-400">
                Next open: {marketStatus.nextOpen}
              </p>
            )}

            {isExness && (
              <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-yellow-400">
                      <span className="font-semibold">Note:</span> Exness does not provide live market status via API. 
                      This is a time-based estimate based on standard forex trading sessions. 
                      For accurate market status, check the Exness MT5 platform.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isExness && !marketStatus.isOpen && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.exness.com/', '_blank')}
                  className="text-xs border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Check Exness MT5 Platform
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

