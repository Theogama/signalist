'use client';

/**
 * Deriv Market Status Alert Component
 * Monitors Deriv market status and shows toast notifications when market opens/closes
 * Similar to Deriv platform's market status alerts
 */

import { useEffect, useState, useRef } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Clock,
  Bell,
  BellOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MarketStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'suspended' | 'unknown';
  symbol?: string;
  reason?: string;
  nextOpen?: string;
  lastChecked?: Date;
}

export default function DerivMarketStatusAlert() {
  const { connectedBroker, selectedInstrument } = useAutoTradingStore();
  const [currentStatus, setCurrentStatus] = useState<MarketStatus | null>(null);
  const [previousStatus, setPreviousStatus] = useState<MarketStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkCountRef = useRef(0);

  // Only show when Deriv is connected
  if (connectedBroker !== 'deriv') {
    return null;
  }

  const checkMarketStatus = async () => {
    try {
      // Get symbol from selected instrument or use default
      const symbol = selectedInstrument?.symbol || 'BOOM500';
      
      const response = await fetch(`/api/deriv/market-status?symbol=${symbol}`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data.success) {
        return;
      }

      const newStatus: MarketStatus = {
        isOpen: data.isOpen || false,
        status: data.status || (data.isOpen ? 'open' : 'closed'),
        symbol: symbol,
        reason: data.reason,
        nextOpen: data.nextOpen,
        lastChecked: new Date(),
      };

      // Check if status changed (compare with current status)
      if (currentStatus && alertEnabled) {
        if (currentStatus.isOpen !== newStatus.isOpen) {
          // Market status changed - show alert
          if (newStatus.isOpen) {
            toast.success('🟢 Market is now OPEN', {
              description: `${symbol} market is now open for trading`,
              duration: 5000,
            });
          } else {
            toast.warning('🔴 Market is now CLOSED', {
              description: newStatus.reason || `${symbol} market is now closed`,
              duration: 5000,
            });
          }
        } else if (currentStatus.status !== newStatus.status) {
          // Status type changed (e.g., suspended)
          if (newStatus.status === 'suspended') {
            toast.error('⏸️ Market Suspended', {
              description: `${symbol} market is temporarily suspended`,
              duration: 5000,
            });
          }
        }
      }

      // Update previous status before setting new current status
      setPreviousStatus(currentStatus);
      setCurrentStatus(newStatus);
      checkCountRef.current++;
    } catch (error) {
      console.error('Error checking market status:', error);
    }
  };

  const startMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initial check
    checkMarketStatus();

    // Check every 30 seconds for real-time alerts
    intervalRef.current = setInterval(checkMarketStatus, 30000);
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  };

  useEffect(() => {
    if (connectedBroker === 'deriv') {
      startMonitoring();
    } else {
      stopMonitoring();
      setCurrentStatus(null);
      setPreviousStatus(null);
    }

    return () => {
      stopMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker, selectedInstrument?.symbol]);

  // Toggle alert notifications
  const toggleAlerts = () => {
    setAlertEnabled(!alertEnabled);
    if (!alertEnabled) {
      toast.info('Market status alerts enabled', {
        description: 'You will be notified when market opens or closes',
      });
    } else {
      toast.info('Market status alerts disabled', {
        description: 'You will not receive market status notifications',
      });
    }
  };

  if (!currentStatus) {
    return null;
  }

  const statusColors = {
    open: 'bg-green-500/20 border-green-500/50 text-green-400',
    closed: 'bg-red-500/20 border-red-500/50 text-red-400',
    suspended: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    unknown: 'bg-gray-500/20 border-gray-500/50 text-gray-400',
  };

  const statusIcons = {
    open: <CheckCircle2 className="h-4 w-4" />,
    closed: <XCircle className="h-4 w-4" />,
    suspended: <Clock className="h-4 w-4" />,
    unknown: <Clock className="h-4 w-4" />,
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/50">
      <Badge 
        variant="outline" 
        className={`${statusColors[currentStatus.status]} border flex items-center gap-1.5`}
      >
        {statusIcons[currentStatus.status]}
        <span className="text-xs font-semibold">
          {currentStatus.status.toUpperCase()}
        </span>
      </Badge>

      {currentStatus.symbol && (
        <span className="text-xs text-gray-400">{currentStatus.symbol}</span>
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleAlerts}
        className="h-7 px-2"
        title={alertEnabled ? 'Disable alerts' : 'Enable alerts'}
      >
        {alertEnabled ? (
          <Bell className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <BellOff className="h-3.5 w-3.5 text-gray-500" />
        )}
      </Button>

      {isMonitoring && (
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Monitoring" />
      )}
    </div>
  );
}

