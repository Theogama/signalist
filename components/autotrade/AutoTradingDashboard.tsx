'use client';

/**
 * Auto-Trading Dashboard Component
 * Main dashboard showing broker status, balance, trades, and bot controls
 */

import { useEffect } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertCircle,
  Play,
  Square,
  Settings,
  X,
  CheckCircle2
} from 'lucide-react';
import BrokerConnectionModal from './BrokerConnectionModal';
import InstrumentsSelector from './InstrumentsSelector';
import BotsLibrary from './BotsLibrary';
import AutoTradeSettingsPanel from './AutoTradeSettingsPanel';
import StartStopControls from './StartStopControls';
import StrategyPreviewChart from './StrategyPreviewChart';
import LiveLogsPanel from './LiveLogsPanel';
import TradesTable from './TradesTable';
import BotBuilderUI from './BotBuilderUI';
import AutomationPanel from './AutomationPanel';
import PLTracker from './PLTracker';
import LiveTradeUpdates from './LiveTradeUpdates';
import OpenTrades from './OpenTrades';
import ClosedTrades from './ClosedTrades';
import BotDiagnosticsPanel from './BotDiagnosticsPanel';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useStateRestoration } from '@/lib/hooks/useStateRestoration';
import { useAutoTradingStore as useStore } from '@/lib/stores/autoTradingStore';
import { toast } from 'sonner';

export default function AutoTradingDashboard() {
  // Restore state on page load
  const { isRestoring } = useStateRestoration();
  
  // Initialize WebSocket connection
  useWebSocket();
  const {
    connectedBroker,
    balance,
    equity,
    margin,
    botStatus,
    openTrades,
    closedTrades,
    loadBots,
    loadInstruments,
    setBalance,
    addLog,
    disconnectBroker,
  } = useAutoTradingStore();

  useEffect(() => {
    loadBots();
  }, []); // Only run once on mount

  useEffect(() => {
    // Show restoration status
    if (isRestoring) {
      addLog({
        level: 'info',
        message: 'Restoring connection state...',
      });
    }
  }, [isRestoring, addLog]);

  useEffect(() => {
    if (connectedBroker) {
      loadInstruments(connectedBroker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedBroker]); // Only depend on connectedBroker, loadInstruments is stable

  // Poll for balance updates when broker is connected
  useEffect(() => {
    if (!connectedBroker) return;

    const fetchAccountBalance = async () => {
      try {
        const response = await fetch(`/api/auto-trading/account?broker=${connectedBroker}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setBalance(
              data.data.balance || 10000,
              data.data.equity || 10000,
              data.data.margin || 0
            );
          }
        }
      } catch (error) {
        console.error('Error fetching account balance:', error);
      }
    };

    // Fetch immediately
    fetchAccountBalance();

    // Then poll every 10 seconds (reduced from 5s for better performance)
    const interval = setInterval(fetchAccountBalance, 10000);
    return () => clearInterval(interval);
  }, [connectedBroker, setBalance]);

  // Fetch positions and trades when bot is running
  useEffect(() => {
    if (botStatus !== 'running') return;

    const { syncTrades } = useAutoTradingStore.getState();

    const fetchPositions = async () => {
      try {
        const response = await fetch('/api/auto-trading/positions');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Update balance
            if (data.data.balance) {
              setBalance(
                data.data.balance.balance,
                data.data.balance.equity,
                data.data.balance.margin
              );
            }

            // Sync trades
            const openTradesList = (data.data.openTrades || []).map((trade: any) => ({
              id: trade.id,
              symbol: trade.symbol,
              side: trade.side || 'BUY',
              entryPrice: trade.entryPrice,
              quantity: trade.quantity,
              status: 'OPEN' as const,
              openedAt: trade.openedAt ? new Date(trade.openedAt) : new Date(),
            }));

            const closedTradesList = (data.data.closedTrades || []).map((trade: any) => ({
              id: trade.id,
              symbol: trade.symbol,
              side: trade.side || 'BUY',
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice,
              quantity: trade.quantity,
              profitLoss: trade.profitLoss,
              status: (trade.status || 'CLOSED') as 'CLOSED' | 'STOPPED',
              openedAt: trade.openedAt ? new Date(trade.openedAt) : new Date(),
              closedAt: trade.closedAt ? new Date(trade.closedAt) : new Date(),
            }));

            syncTrades(openTradesList, closedTradesList);
          }
        }
      } catch (error) {
        console.error('Error fetching positions:', error);
      }
    };

    // Fetch immediately
    fetchPositions();

    // Then poll every 5 seconds (reduced from 3s for better performance)
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [botStatus, setBalance]);

  const freeMargin = equity - margin;
  const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Auto-Trading Dashboard</h1>
        <p className="text-gray-400">Automated trading with Exness and Deriv brokers</p>
      </div>

      {/* Broker Connection Status */}
      {!connectedBroker && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              No Broker Connected
            </CardTitle>
            <CardDescription className="text-gray-400">
              Quick connect to Exness or Deriv in Demo Mode - No API keys required!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrokerConnectionModal />
          </CardContent>
        </Card>
      )}

      {/* Broker Connection Status with Disconnect Toggle */}
      {connectedBroker && (
        <Card className="mb-6 border-green-500/50 bg-green-500/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-green-400 text-sm mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected to {connectedBroker.toUpperCase()}
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  You're trading with virtual funds. All instruments are automatically available. Perfect for testing strategies!
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  try {
                    await disconnectBroker();
                    toast.success(`Disconnected from ${connectedBroker.toUpperCase()}`);
                    addLog({
                      level: 'success',
                      message: `Disconnected from ${connectedBroker.toUpperCase()}`,
                    });
                  } catch (error: any) {
                    toast.error(`Failed to disconnect: ${error.message}`);
                    addLog({
                      level: 'error',
                      message: `Failed to disconnect: ${error.message}`,
                    });
                  }
                }}
                className="ml-4"
              >
                <X className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Disconnect</span>
                <span className="sm:hidden">X</span>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Summary */}
          {connectedBroker && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-400" />
                    <span className="text-2xl font-bold text-gray-100">
                      ${balance.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Equity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-2xl font-bold text-gray-100">
                      ${equity.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Free Margin</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-400" />
                    <span className="text-2xl font-bold text-gray-100">
                      ${freeMargin.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Margin Level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-400" />
                    <span className="text-2xl font-bold text-gray-100">
                      {marginLevel.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Instrument Selection */}
          {connectedBroker && (
            <Card>
              <CardHeader>
                <CardTitle>Select Instrument</CardTitle>
                <CardDescription>Choose the trading instrument</CardDescription>
              </CardHeader>
              <CardContent>
                <InstrumentsSelector />
              </CardContent>
            </Card>
          )}

          {/* Bot Library */}
          <Card>
            <CardHeader>
              <CardTitle>Bot Library</CardTitle>
              <CardDescription>Select a trading bot from the library</CardDescription>
            </CardHeader>
            <CardContent>
              <BotsLibrary />
            </CardContent>
          </Card>

          {/* Bot Builder */}
          <BotBuilderUI />

          {/* Auto-Trade Settings Panel (Unified Settings) */}
          <AutoTradeSettingsPanel disabled={botStatus === 'running'} />

          {/* Automation Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Automation</CardTitle>
              <CardDescription>Automate bot operations and recovery</CardDescription>
            </CardHeader>
            <CardContent>
              <AutomationPanel />
            </CardContent>
          </Card>

          {/* Strategy Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Strategy Preview</CardTitle>
              <CardDescription>Visual preview of trading strategy</CardDescription>
            </CardHeader>
            <CardContent>
              <StrategyPreviewChart />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Controls & Status */}
        <div className="space-y-6">
          {/* Bot Diagnostics */}
          <BotDiagnosticsPanel />

          {/* P/L Tracker */}
          <PLTracker />

          {/* Start/Stop Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Bot Controls</CardTitle>
              <CardDescription>Start or stop the trading bot</CardDescription>
            </CardHeader>
            <CardContent>
              <StartStopControls />
            </CardContent>
          </Card>

          {/* Live Trade Updates */}
          <LiveTradeUpdates />

          {/* Live Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Live Logs</CardTitle>
              <CardDescription>Real-time bot activity</CardDescription>
            </CardHeader>
            <CardContent>
              <LiveLogsPanel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trades Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpenTrades />
        <ClosedTrades />
      </div>
    </div>
  );
}

