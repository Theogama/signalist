/**
 * Signalist Bot Dashboard Component
 * Real-time bot status and control dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBotControl } from '@/lib/hooks/useBotControl';
import { useBotEvents } from '@/lib/hooks/useBotEvents';
import { useBotSettings } from '@/lib/hooks/useBotSettings';
import { toast } from 'sonner';
import { Play, Square, Pause, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

export function SignalistBotDashboard() {
  const { status, loading, startBot, stopBot } = useBotControl();
  const { events, lastEvent, isConnected } = useBotEvents();
  const [broker, setBroker] = useState<'exness' | 'deriv'>('exness');
  const [instrument, setInstrument] = useState('XAUUSD');

  const { settings } = useBotSettings(broker, instrument);

  const handleStart = async () => {
    if (!settings?.enabled) {
      toast.error('Please enable the bot in settings first');
      return;
    }

    const result = await startBot(broker, instrument);
    if (result.success) {
      toast.success('Bot started successfully');
    } else {
      toast.error(result.error || 'Failed to start bot');
    }
  };

  const handleStop = async () => {
    const result = await stopBot('Manual stop');
    if (result.success) {
      toast.success('Bot stopped successfully');
    } else {
      toast.error(result.error || 'Failed to stop bot');
    }
  };

  useEffect(() => {
    if (settings) {
      setBroker(settings.broker);
      setInstrument(settings.instrument);
    }
  }, [settings]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Signalist Bot Dashboard</h1>
          <p className="text-muted-foreground">Monitor and control your trading bot</p>
        </div>
        <div className="flex gap-2">
          {status?.isRunning ? (
            <Button onClick={handleStop} variant="destructive" disabled={loading}>
              <Square className="mr-2 h-4 w-4" />
              Stop Bot
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={loading || !settings?.enabled}>
              <Play className="mr-2 h-4 w-4" />
              Start Bot
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bot Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.isRunning ? (
                <Badge className="bg-green-500">Running</Badge>
              ) : (
                <Badge variant="secondary">Stopped</Badge>
              )}
              {status?.isPaused && <Badge variant="outline">Paused</Badge>}
            </div>
            {status?.stopReason && (
              <p className="text-sm text-muted-foreground mt-2">
                Reason: {status.stopReason}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge className="bg-green-500">Connected</Badge>
              ) : (
                <Badge variant="destructive">Disconnected</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {events.length} events received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.dailyStats.tradesCount || 0}</div>
            <p className="text-sm text-muted-foreground">
              {status?.dailyStats.wins || 0}W / {status?.dailyStats.losses || 0}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>P&L</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(status?.dailyStats.totalPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(status?.dailyStats.totalPnl || 0).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              Drawdown: {(status?.dailyStats.drawdownPercent || 0).toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Configuration */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Broker</p>
                <p className="font-medium">{settings.broker.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Instrument</p>
                <p className="font-medium">{settings.instrument}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Timeframe</p>
                <p className="font-medium">{settings.candleTimeframe}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk per Trade</p>
                <p className="font-medium">{settings.riskPerTrade}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Stats */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Account Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Starting Balance</p>
                <p className="text-lg font-semibold">${(status.dailyStats.startingBalance || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-lg font-semibold">${(status.dailyStats.currentBalance || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-lg font-semibold">
                  {status.dailyStats.tradesCount > 0
                    ? ((status.dailyStats.wins / status.dailyStats.tradesCount) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Consecutive Losses</p>
                <p className="text-lg font-semibold">{status.consecutiveLosses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Real-time bot events and signals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet</p>
            ) : (
              events
                .slice()
                .reverse()
                .slice(0, 20)
                .map((event, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.type === 'trade_opened' && (
                        <p className="text-sm mt-1">
                          Opened {event.data?.side} {event.data?.symbol} @ ${event.data?.entryPrice}
                        </p>
                      )}
                      {event.type === 'trade_closed' && (
                        <p className="text-sm mt-1">
                          Closed {event.data?.symbol} | P&L: ${event.data?.realizedPnl?.toFixed(2)}
                        </p>
                      )}
                      {event.type === 'signal_detected' && (
                        <p className="text-sm mt-1">
                          Signal: {event.data?.direction} | Reason: {event.data?.reason}
                        </p>
                      )}
                      {event.type === 'stop_triggered' && (
                        <p className="text-sm mt-1 text-yellow-600">
                          <AlertCircle className="inline h-4 w-4 mr-1" />
                          Bot stopped: {event.reason}
                        </p>
                      )}
                      {event.type === 'error' && (
                        <p className="text-sm mt-1 text-red-600">
                          Error: {event.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






