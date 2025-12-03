'use client';

/**
 * MT5 Trading Dashboard
 * Complete dashboard for MT5 auto-trading with Exness
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings, Play, Square, Activity } from 'lucide-react';
import { toast } from 'sonner';
import MT5QuickConnect from './MT5QuickConnect';
import MT5AutoTradeSettings from './MT5AutoTradeSettings';
import MT5PLTracker from './MT5PLTracker';
import MT5OpenTrades from './MT5OpenTrades';
import MT5ClosedTrades from './MT5ClosedTrades';
import MT5Notifications from './MT5Notifications';
import Link from 'next/link';

export default function MT5TradingDashboard() {
  const [connection, setConnection] = useState<any>(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load connection and settings on mount
  useEffect(() => {
    const stored = localStorage.getItem('mt5_connection');
    if (stored) {
      try {
        setConnection(JSON.parse(stored));
      } catch (err) {
        console.error('Error loading connection:', err);
      }
    }

    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/mt5/settings/update');
      const data = await response.json();
      if (data.success && data.data) {
        setBotEnabled(data.data.enabled || false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggleBot = async () => {
    try {
      setLoading(true);
      const newState = !botEnabled;

      const response = await fetch('/api/mt5/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: newState,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBotEnabled(newState);
        toast.success(newState ? 'Auto-trading enabled' : 'Auto-trading disabled');
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle bot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MT5Notifications />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">MT5 Auto-Trading</h1>
            <p className="text-gray-400">Automated trading with Exness via MetaTrader 5</p>
          </div>
          <div className="flex gap-2">
            <MT5QuickConnect />
            <Link href="/autotrade/mt5-settings">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!connection && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              Not Connected
            </CardTitle>
            <CardDescription className="text-gray-400">
              Connect to your Exness MT5 account to start auto-trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MT5QuickConnect />
          </CardContent>
        </Card>
      )}

      {/* Bot Status */}
      {connection && (
        <Card className="mb-6 border-blue-500/50 bg-blue-500/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-blue-400 text-sm">
                  <Activity className="h-4 w-4" />
                  {botEnabled ? 'Auto-Trading Active' : 'Auto-Trading Disabled'}
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  {connection.server} • Login: {connection.login}
                </CardDescription>
              </div>
              <Button
                onClick={handleToggleBot}
                disabled={loading}
                variant={botEnabled ? 'destructive' : 'default'}
              >
                {loading ? (
                  'Loading...'
                ) : botEnabled ? (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    Stop Bot
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Bot
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Settings */}
          {connection && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Settings</CardTitle>
                <CardDescription>Essential auto-trade configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <MT5AutoTradeSettings />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - P/L Tracker */}
        <div className="space-y-6">
          <MT5PLTracker />
        </div>
      </div>

      {/* Trades Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MT5OpenTrades />
        <MT5ClosedTrades />
      </div>

      {/* Signalist Branding */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Powered by <span className="text-yellow-500 font-semibold">SIGNALIST Bot</span>
        </p>
      </div>
    </div>
    </>
  );
}

