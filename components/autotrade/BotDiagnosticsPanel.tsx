'use client';

/**
 * Bot Diagnostics Panel
 * Shows real-time bot status, historical data, risk settings, and trading session info
 * COMPLIANCE-AWARE: Differentiates between Deriv (API) and Exness (Manual/Read-Only)
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Database,
  Shield,
  Calendar,
  Wifi,
  WifiOff,
  Upload,
  Lock
} from 'lucide-react';
import ExnessManualDataEntry from './ExnessManualDataEntry';

export default function BotDiagnosticsPanel() {
  const {
    botStatus,
    connectedBroker,
    selectedInstrument,
    selectedBot,
    botParams,
    liveLogs,
    openTrades,
    balance,
    equity,
    wsConnected,
  } = useAutoTradingStore();
  
  const { wsConnected: wsStatus } = useWebSocket();

  const [diagnostics, setDiagnostics] = useState<{
    historicalDataCount: number;
    lastAnalysisTime: Date | null;
    tradingSessionStatus: 'active' | 'inactive' | 'not_set';
    sessionTimeRemaining: string | null;
    riskLimits: {
      maxDailyTrades: number;
      maxDailyLoss: number;
      maxTrades: number;
      riskPercent: number;
    };
    blockingReasons: string[];
  }>({
    historicalDataCount: 0,
    lastAnalysisTime: null,
    tradingSessionStatus: 'not_set',
    sessionTimeRemaining: null,
    riskLimits: {
      maxDailyTrades: 0,
      maxDailyLoss: 0,
      maxTrades: 1,
      riskPercent: 1,
    },
    blockingReasons: [],
  });

  // PRIORITY: Faster diagnostics updates for Exness/Deriv
  useEffect(() => {
    // Extract diagnostics from live logs (real-time processing)
    const analysisLogs = liveLogs.filter(log => 
      log.message.includes('Analyzing') || 
      log.message.includes('Historical data') ||
      log.message.includes('candles')
    );
    
    if (analysisLogs.length > 0) {
      const lastLog = analysisLogs[analysisLogs.length - 1];
      const dataMatch = lastLog.message.match(/Historical data: (\d+) candles/) ||
                       lastLog.message.match(/(\d+) candles/);
      if (dataMatch) {
        setDiagnostics(prev => ({
          ...prev,
          historicalDataCount: parseInt(dataMatch[1], 10),
          lastAnalysisTime: lastLog.timestamp,
        }));
      }
    }

    // Check for blocking reasons in logs
    const blockingLogs = liveLogs.filter(log => 
      log.level === 'warning' && (
        log.message.includes('blocked') ||
        log.message.includes('limit reached') ||
        log.message.includes('session is off')
      )
    );

    const reasons: string[] = [];
    blockingLogs.forEach(log => {
      if (log.message.includes('session is off')) {
        reasons.push('Trading session is inactive');
      }
      if (log.message.includes('Maximum concurrent trades')) {
        reasons.push('Max concurrent trades reached');
      }
      if (log.message.includes('risk manager')) {
        reasons.push('Risk manager blocking trades');
      }
    });

    setDiagnostics(prev => ({ ...prev, blockingReasons: reasons }));

    // Check trading session status
    if (botParams?.sessionStart || botParams?.sessionEnd) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = (botParams.sessionStart || '00:00').split(':').map(Number);
      const [endHour, endMin] = (botParams.sessionEnd || '23:59').split(':').map(Number);
      
      const sessionStart = startHour * 60 + startMin;
      const sessionEnd = endHour * 60 + endMin;
      
      let isActive = false;
      let timeRemaining: string | null = null;
      
      if (sessionStart > sessionEnd) {
        // Spans midnight
        isActive = currentTime >= sessionStart || currentTime <= sessionEnd;
      } else {
        isActive = currentTime >= sessionStart && currentTime <= sessionEnd;
      }
      
      if (!isActive) {
        // Calculate time until session starts
        let minutesUntil = 0;
        if (currentTime < sessionStart) {
          minutesUntil = sessionStart - currentTime;
        } else {
          minutesUntil = (24 * 60 - currentTime) + sessionStart;
        }
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        timeRemaining = `${hours}h ${mins}m`;
      }
      
      setDiagnostics(prev => ({
        ...prev,
        tradingSessionStatus: isActive ? 'active' : 'inactive',
        sessionTimeRemaining: timeRemaining,
      }));
    } else {
      setDiagnostics(prev => ({
        ...prev,
        tradingSessionStatus: 'not_set',
      }));
    }

    // Extract risk limits from bot params
    if (botParams) {
      setDiagnostics(prev => ({
        ...prev,
        riskLimits: {
          maxDailyTrades: botParams.maxDailyTrades || 0,
          maxDailyLoss: botParams.maxDailyLoss || 0,
          maxTrades: botParams.maxTrades || 1,
          riskPercent: botParams.riskPercent || 1,
        },
      }));
    }
  }, [liveLogs, botParams]);

  // Show Exness manual data entry when Exness is connected (even if bot not running)
  if (connectedBroker === 'exness' && botStatus !== 'running') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Bot Diagnostics
              <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-500/10">
                <Lock className="h-3 w-3 mr-1" />
                Exness - Read Only
              </Badge>
            </CardTitle>
            <CardDescription>
              Exness diagnostics require manual data entry. No API access available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-400 mb-4">
              <XCircle className="h-4 w-4" />
              <span>Bot is not running. Upload data to see diagnostics.</span>
            </div>
          </CardContent>
        </Card>
        <ExnessManualDataEntry />
      </div>
    );
  }

  if (botStatus !== 'running') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Bot Diagnostics
          </CardTitle>
          <CardDescription>Bot status and health information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-gray-400">
            <XCircle className="h-4 w-4" />
            <span>Bot is not running. Start the bot to see diagnostics.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = 
    diagnostics.historicalDataCount >= 50 &&
    diagnostics.tradingSessionStatus !== 'inactive' &&
    diagnostics.blockingReasons.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Bot Diagnostics
          {isHealthy ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Healthy
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Issues
            </Badge>
          )}
        </CardTitle>
        <div className="text-sm text-gray-400">
          {connectedBroker === 'deriv' ? (
            <div className="flex items-center gap-2">
              <span>Live API diagnostics via Deriv WebSocket</span>
              {wsStatus || wsConnected ? (
                <Badge variant="outline" className="text-xs border-green-500 text-green-400 bg-green-500/10">
                  <Wifi className="h-3 w-3 mr-1" />
                  API Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400 bg-yellow-500/10">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Connecting...
                </Badge>
              )}
            </div>
          ) : connectedBroker === 'exness' ? (
            <div className="flex items-center gap-2">
              <span>Manual / Read-Only diagnostics</span>
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400 bg-yellow-500/10">
                <Lock className="h-3 w-3 mr-1" />
                No API Access
              </Badge>
            </div>
          ) : (
            <span>Real-time bot status and health checks</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot Status */}
        <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-400" />
            <span className="text-sm text-gray-300">Bot Status</span>
          </div>
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            Running
          </Badge>
        </div>

        {/* Historical Data */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Historical Data</span>
            </div>
            <span className={`text-sm font-semibold ${
              diagnostics.historicalDataCount >= 50 
                ? 'text-green-400' 
                : diagnostics.historicalDataCount >= 10
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}>
              {diagnostics.historicalDataCount} candles
            </span>
          </div>
          {diagnostics.historicalDataCount < 50 && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
              ⚠️ Need at least 50 candles for strategy analysis. Waiting for more data...
            </div>
          )}
          {diagnostics.lastAnalysisTime && (
            <div className="text-xs text-gray-500">
              Last analysis: {diagnostics.lastAnalysisTime.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Trading Session */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-300">Trading Session</span>
            </div>
            {diagnostics.tradingSessionStatus === 'active' ? (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                Active
              </Badge>
            ) : diagnostics.tradingSessionStatus === 'inactive' ? (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                Inactive
              </Badge>
            ) : (
              <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                Not Set
              </Badge>
            )}
          </div>
          {diagnostics.tradingSessionStatus === 'inactive' && diagnostics.sessionTimeRemaining && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Next session starts in: {diagnostics.sessionTimeRemaining}
            </div>
          )}
          {botParams?.sessionStart && botParams?.sessionEnd && (
            <div className="text-xs text-gray-500">
              Session: {botParams.sessionStart} - {botParams.sessionEnd}
            </div>
          )}
        </div>

        {/* Risk Settings Summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-gray-300">Risk Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Risk per Trade</div>
              <div className="text-gray-300 font-semibold">{diagnostics.riskLimits.riskPercent}%</div>
            </div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Max Concurrent</div>
              <div className="text-gray-300 font-semibold">{diagnostics.riskLimits.maxTrades}</div>
            </div>
            {diagnostics.riskLimits.maxDailyTrades > 0 && (
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Max Daily Trades</div>
                <div className="text-gray-300 font-semibold">{diagnostics.riskLimits.maxDailyTrades}</div>
              </div>
            )}
            {diagnostics.riskLimits.maxDailyLoss > 0 && (
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Max Daily Loss</div>
                <div className="text-gray-300 font-semibold">{diagnostics.riskLimits.maxDailyLoss}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Broker-Specific Status */}
        {connectedBroker === 'deriv' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Deriv API Status</span>
              <Badge variant="outline" className="text-xs border-purple-500 text-purple-400 bg-purple-500/10">
                LIVE DATA
              </Badge>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-gray-500">API Connection</span>
                <div className="flex items-center gap-2">
                  {wsStatus || wsConnected ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-400" />
                      <span className="text-green-400 font-semibold">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-yellow-400" />
                      <span className="text-yellow-400 font-semibold">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-gray-500">Balance (Live)</span>
                <span className="text-gray-300 font-semibold">${balance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-gray-500">Equity (Live)</span>
                <span className="text-gray-300 font-semibold">${equity.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {connectedBroker === 'exness' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Exness Status</span>
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400 bg-yellow-500/10">
                <Lock className="h-3 w-3 mr-1" />
                Manual / Read-Only
              </Badge>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="text-xs text-yellow-400 flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1">No API Access Available</div>
                  <div className="text-gray-400">
                    Exness does not support API trading. Use manual data entry or CSV upload for diagnostics.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Current Status</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <span className="text-gray-500">Broker</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-semibold">{connectedBroker?.toUpperCase() || 'Not Connected'}</span>
                {connectedBroker === 'deriv' && (
                  <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                    API
                  </Badge>
                )}
                {connectedBroker === 'exness' && (
                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400">
                    Manual
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <span className="text-gray-500">Instrument</span>
              <span className="text-gray-300 font-semibold">{selectedInstrument?.symbol || 'Not Selected'}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <span className="text-gray-500">Open Positions</span>
              <span className="text-gray-300 font-semibold">{openTrades.length}</span>
            </div>
          </div>
        </div>

        {/* Exness Manual Data Entry (when running) */}
        {connectedBroker === 'exness' && botStatus === 'running' && (
          <div className="mt-4">
            <ExnessManualDataEntry />
          </div>
        )}

        {/* Blocking Reasons */}
        {diagnostics.blockingReasons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-300">Blocking Issues</span>
            </div>
            <div className="space-y-1">
              {diagnostics.blockingReasons.map((reason, index) => (
                <div key={index} className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                  ⚠️ {reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {!isHealthy && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-xs font-semibold text-blue-400 mb-2">💡 Recommendations:</div>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              {diagnostics.historicalDataCount < 50 && (
                <li>Wait 2-5 minutes for historical data to accumulate ({diagnostics.historicalDataCount}/50 candles)</li>
              )}
              {diagnostics.tradingSessionStatus === 'inactive' && (
                <li>Adjust trading session times or wait for session to start</li>
              )}
              {diagnostics.blockingReasons.length > 0 && (
                <li>Check Live Logs for detailed blocking reasons</li>
              )}
              {diagnostics.riskLimits.maxDailyTrades > 0 && (
                <li>Check if daily trade limit has been reached</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




