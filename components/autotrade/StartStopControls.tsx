'use client';

/**
 * Start/Stop Controls Component
 * Controls for starting and stopping the trading bot
 */

import { useState, useEffect } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2, AlertCircle, Activity, Lock } from 'lucide-react';
import { toast } from 'sonner';
import MarketAvailabilityAlert from './MarketAvailabilityAlert';

export default function StartStopControls() {
  const {
    connectedBroker,
    selectedInstrument,
    selectedBot,
    botParams,
    botStatus,
    botStartTime,
    startBot,
    stopBot,
    wsConnected,
  } = useAutoTradingStore();

  const isRunning = botStatus === 'running';
  const isStopping = botStatus === 'stopping';
  const [marketOpen, setMarketOpen] = useState(true);
  
  // Check market status
  useEffect(() => {
    if (!connectedBroker) {
      setMarketOpen(true);
      return;
    }

    const checkMarket = async () => {
      try {
        if (connectedBroker === 'deriv') {
          const response = await fetch('/api/deriv/market-status');
          if (response.ok) {
            const data = await response.json();
            setMarketOpen(data.isOpen !== false);
          }
        } else if (connectedBroker === 'exness') {
          // Exness: time-based check (no API)
          const now = new Date();
          const day = now.getDay();
          const hour = now.getHours();
          const minute = now.getMinutes();
          const currentTime = hour * 60 + minute;
          const isWeekend = day === 0 || day === 6;
          const isMarketHours = !isWeekend && (
            (currentTime >= 0 && currentTime < 22 * 60) || 
            (day === 5 && currentTime < 22 * 60)
          );
          setMarketOpen(isMarketHours);
        }
      } catch (error) {
        console.error('Error checking market status:', error);
        setMarketOpen(true); // Default to open on error
      }
    };

    checkMarket();
    const interval = setInterval(checkMarket, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connectedBroker]);

  const canStart = connectedBroker && selectedInstrument && selectedBot && botParams && !isRunning && marketOpen && connectedBroker !== 'exness';

  const handleStart = async () => {
    if (!connectedBroker || !selectedInstrument || !selectedBot || !botParams) {
      toast.error('Please connect broker, select instrument, and configure bot');
      return;
    }

    if (connectedBroker === 'exness') {
      toast.error('Auto-trading is not available for Exness. Please use Exness MT5 platform for manual trading.');
      return;
    }

    if (!marketOpen) {
      toast.error('Markets are currently closed. Please wait for markets to open.');
      return;
    }

    try {
      await startBot();
      toast.success('Bot started successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start bot');
    }
  };

  const handleStop = async () => {
    try {
      await stopBot();
      toast.success('Bot stopped successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop bot');
    }
  };

  // PRIORITY: Real-time uptime calculation (updates every second)
  const [uptime, setUptime] = useState('0s');
  
  useEffect(() => {
    if (!isRunning || !botStartTime) {
      setUptime('0s');
      return;
    }
    
    const updateUptime = () => {
      const startTime = botStartTime instanceof Date 
        ? botStartTime 
        : new Date(botStartTime);
      
      if (isNaN(startTime.getTime())) {
        setUptime('0s');
        return;
      }
      
      const seconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        setUptime(`${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setUptime(`${minutes}m ${seconds % 60}s`);
      } else {
        setUptime(`${seconds}s`);
      }
    };
    
    updateUptime();
    // Update every second for real-time feel
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [isRunning, botStartTime]);
  
  const getUptime = () => uptime;

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Status</span>
          <span className={`font-semibold ${
            isRunning ? 'text-green-400' :
            isStopping ? 'text-yellow-400' :
            'text-gray-400'
          }`}>
            {botStatus.toUpperCase()}
          </span>
        </div>
        {isRunning && botStartTime && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Uptime</span>
              <span className="text-sm text-gray-100">{getUptime()}</span>
            </div>
            {connectedBroker && wsConnected && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-500">Update Speed</span>
                <span className="text-xs text-yellow-400 flex items-center gap-1">
                  <Activity className="h-3 w-3 animate-pulse" />
                  ⚡ Fast ({connectedBroker.toUpperCase()})
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Validation Messages */}
      {!connectedBroker && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-yellow-400">Connect a broker to start</span>
        </div>
      )}

      {connectedBroker && !selectedInstrument && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-yellow-400">Select an instrument</span>
        </div>
      )}

      {connectedBroker && selectedInstrument && !selectedBot && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-yellow-400">Select a bot</span>
        </div>
      )}

      {connectedBroker === 'exness' && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <Lock className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">
            Auto-trading not available for Exness. Use MT5 platform for manual trading.
          </span>
        </div>
      )}

      {connectedBroker && !marketOpen && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">Markets are currently closed. Bot cannot start.</span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <Button
            onClick={handleStart}
            disabled={!canStart || isStopping || connectedBroker === 'exness' || !marketOpen}
            className="flex-1"
            size="lg"
          >
            {isStopping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Bot
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleStop}
            disabled={isStopping}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            {isStopping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Bot
              </>
            )}
          </Button>
        )}
      </div>

      {/* Quick Info */}
      {selectedBot && selectedInstrument && (
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Bot:</span>
            <span className="text-gray-100 font-semibold">{selectedBot.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Instrument:</span>
            <span className="text-gray-100 font-semibold">{selectedInstrument.symbol}</span>
          </div>
        </div>
      )}
    </div>
  );
}




