'use client';

/**
 * Start/Stop Controls Component
 * Controls for starting and stopping the trading bot
 */

import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  } = useAutoTradingStore();

  const isRunning = botStatus === 'running';
  const isStopping = botStatus === 'stopping';
  const canStart = connectedBroker && selectedInstrument && selectedBot && botParams && !isRunning;

  const handleStart = async () => {
    if (!canStart) {
      toast.error('Please connect broker, select instrument, and configure bot');
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

  const getUptime = () => {
    if (!botStartTime) return '0s';
    const seconds = Math.floor((Date.now() - botStartTime.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

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
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Uptime</span>
            <span className="text-sm text-gray-100">{getUptime()}</span>
          </div>
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

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <Button
            onClick={handleStart}
            disabled={!canStart || isStopping}
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




