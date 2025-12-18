'use client';

/**
 * Enhanced Auto-Trade Settings Panel
 * Comprehensive configuration for all auto-trading parameters in one place
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Save, RefreshCw, Settings, TrendingUp, Shield, Clock, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';
import { settingsSyncService } from '@/lib/services/settings-sync.service';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface AutoTradeSettings {
  // Risk Management
  riskPercent: number;
  lotSize?: number;
  lotSizeMode?: 'auto' | 'fixed';
  maxTrades: number;
  minLotSize?: number;
  maxLotSize?: number;
  
  // TP/SL
  takeProfitPercent: number;
  stopLossPercent: number;
  slValue?: number; // For pips method
  useATRForSL?: boolean;
  atrMultiplier?: number;
  minStopLossPercent?: number;
  maxStopLossPercent?: number;
  
  // Advanced Risk Management
  enableBreakeven?: boolean;
  breakevenTriggerRR?: number;
  breakevenTriggerPips?: number;
  enableTrailingStop?: boolean;
  trailingStopDistance?: number;
  trailingStopPercent?: number;
  trailingStopATRMultiplier?: number;
  
  // Trading Session
  tradingSessionEnabled: boolean;
  sessionStart?: string;
  sessionEnd?: string;
  
  // Additional Settings
  martingale?: boolean;
  martingaleMultiplier?: number;
  maxDailyLoss?: number;
  maxDailyProfit?: number;
  maxDailyTrades?: number;
  maxTradesPerSession?: number;
  dailyProfitTarget?: number;
  
  // Strategy Settings
  candleTimeframe?: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  smaPeriod?: number;
  smaPeriod2?: number;
  tpMultiplier?: number;
  slMethod?: 'pips' | 'atr' | 'candle' | 'percent';
  atrPeriod?: number;
  spikeDetectionEnabled?: boolean;
  spikeThreshold?: number;
  fiveMinTrendConfirmation?: boolean;
  
  // Force Stop Settings
  forceStopDrawdown?: number;
  forceStopConsecutiveLosses?: number;
  minTimeInTrade?: number;
  
  // Broker-specific
  broker: 'exness' | 'deriv' | null;
  instrument?: string;
}

interface AutoTradeSettingsPanelProps {
  onSettingsChange?: (settings: AutoTradeSettings) => void;
  disabled?: boolean;
}

const PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Low risk, steady gains',
    settings: {
      riskPercent: 0.5,
      takeProfitPercent: 1.5,
      stopLossPercent: 0.5,
      maxTrades: 1,
      maxDailyLoss: 5,
      maxDailyProfit: 10,
    },
  },
  moderate: {
    name: 'Moderate',
    description: 'Balanced risk/reward',
    settings: {
      riskPercent: 1,
      takeProfitPercent: 2,
      stopLossPercent: 1,
      maxTrades: 2,
      maxDailyLoss: 10,
      maxDailyProfit: 20,
    },
  },
  aggressive: {
    name: 'Aggressive',
    description: 'High risk, high reward',
    settings: {
      riskPercent: 2,
      takeProfitPercent: 3,
      stopLossPercent: 1.5,
      maxTrades: 3,
      maxDailyLoss: 15,
      maxDailyProfit: 30,
    },
  },
};

export default function AutoTradeSettingsPanel({ 
  onSettingsChange,
  disabled = false 
}: AutoTradeSettingsPanelProps) {
  const { 
    connectedBroker, 
    botStatus,
    selectedBot,
    botParams,
    updateBotParams,
    selectedInstrument
  } = useAutoTradingStore();
  
  const isRunning = botStatus === 'running';
  const isDisabled = disabled || isRunning;
  
  // Initialize settings from store or defaults
  const [settings, setSettings] = useState<AutoTradeSettings>({
    riskPercent: 1,
    takeProfitPercent: 2,
    stopLossPercent: 1,
    maxTrades: 1,
    tradingSessionEnabled: false,
    sessionStart: '09:00',
    sessionEnd: '17:00',
    martingale: false,
    martingaleMultiplier: 2,
    lotSizeMode: 'auto',
    broker: connectedBroker,
    instrument: selectedInstrument?.symbol,
    candleTimeframe: '5m',
    smaPeriod: 50,
    tpMultiplier: 3,
    slMethod: 'atr',
    atrPeriod: 14,
    fiveMinTrendConfirmation: true,
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/auto-trading/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setSettings((prev) => ({
              ...prev,
              ...data.data,
              broker: connectedBroker || data.data.broker,
              instrument: selectedInstrument?.symbol || data.data.instrument,
            }));
            if (updateBotParams && data.data) {
              updateBotParams(data.data);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []); // Only run on mount

  // Sync with store when bot is selected or params change
  useEffect(() => {
    if (botParams) {
      setSettings((prev) => ({
        ...prev,
        tradingSessionEnabled: !!(botParams.sessionStart || botParams.sessionEnd),
        sessionStart: botParams.sessionStart || prev.sessionStart || '09:00',
        sessionEnd: botParams.sessionEnd || prev.sessionEnd || '17:00',
        broker: connectedBroker || prev.broker,
        instrument: selectedInstrument?.symbol || prev.instrument,
        ...botParams,
      }));
    }
  }, [botParams, connectedBroker, selectedInstrument]);

  // Notify parent of changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
  }, [settings, onSettingsChange]);

  const handleSettingChange = (key: keyof AutoTradeSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Also update store immediately for real-time sync
    if (updateBotParams) {
      updateBotParams({ [key]: value });
    }
  };

  const applyPreset = (preset: typeof PRESETS.conservative) => {
    const newSettings = { ...settings, ...preset.settings };
    setSettings(newSettings);
    if (updateBotParams) {
      updateBotParams(preset.settings);
    }
    toast.success(`Applied ${preset.name} preset`);
  };

  // Subscribe to settings updates from other components
  useEffect(() => {
    const unsubscribe = settingsSyncService.subscribe((updatedSettings) => {
      setSettings((prev) => ({
        ...prev,
        ...updatedSettings,
      }));
      
      // Also update store
      if (updateBotParams) {
        updateBotParams(updatedSettings);
      }
    });

    return unsubscribe;
  }, [updateBotParams]);

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/auto-trading/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Auto-trade settings saved successfully');
        settingsSyncService.broadcastSettingsUpdate(settings);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    }
  };

  const resetToDefaults = () => {
    const defaults: AutoTradeSettings = {
      riskPercent: 1,
      takeProfitPercent: 2,
      stopLossPercent: 1,
      maxTrades: 1,
      tradingSessionEnabled: false,
      sessionStart: '09:00',
      sessionEnd: '17:00',
      martingale: false,
      martingaleMultiplier: 2,
      lotSizeMode: 'auto',
      broker: connectedBroker,
      instrument: selectedInstrument?.symbol,
      candleTimeframe: '5m',
      smaPeriod: 50,
      tpMultiplier: 3,
      slMethod: 'atr',
      atrPeriod: 14,
      fiveMinTrendConfirmation: true,
    };
    setSettings(defaults);
    if (updateBotParams) {
      updateBotParams(defaults);
    }
    toast.info('Settings reset to defaults');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Auto-Trade Settings
            </CardTitle>
            <CardDescription>
              Configure all auto-trading parameters in one place
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={resetToDefaults}
              disabled={isDisabled}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={saveSettings}
              disabled={isDisabled}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isRunning && (
          <Alert className="mb-6 border-blue-500/20 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-400">
              Settings are locked while auto-trade is running. Stop trading to modify settings.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Presets */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-yellow-400" />
            <Label className="text-sm font-semibold">Quick Presets</Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                variant="outline"
                className="justify-start h-auto py-3 flex-col items-start"
                onClick={() => applyPreset(preset)}
                disabled={isDisabled}
              >
                <div className="font-semibold">{preset.name}</div>
                <div className="text-xs text-gray-400 mt-1">{preset.description}</div>
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="risk" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="risk" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Risk</span>
            </TabsTrigger>
            <TabsTrigger value="tp-sl" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">TP/SL</span>
            </TabsTrigger>
            <TabsTrigger value="session" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Session</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
            <TabsTrigger value="strategy" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Strategy</span>
            </TabsTrigger>
          </TabsList>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Management
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="riskPercent" className="flex items-center gap-2">
                    Risk Per Trade (%)
                    <Info className="h-3 w-3 text-gray-500" />
                  </Label>
                  <p className="text-xs text-gray-500">Percentage of balance at risk per trade</p>
                  <Input
                    id="riskPercent"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings.riskPercent}
                    onChange={(e) => handleSettingChange('riskPercent', parseFloat(e.target.value) || 1)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                  <p className="text-xs text-gray-500">Recommended: 0.5-2%</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTrades">Max Concurrent Trades</Label>
                  <Input
                    id="maxTrades"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxTrades}
                    onChange={(e) => handleSettingChange('maxTrades', parseInt(e.target.value) || 1)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                  <p className="text-xs text-gray-500">Maximum open positions at once</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lotSizeMode">Lot Size Mode</Label>
                <Select
                  value={settings.lotSizeMode || 'auto'}
                  onValueChange={(value: 'auto' | 'fixed') => handleSettingChange('lotSizeMode', value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="lotSizeMode" className="bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Based on Risk %)</SelectItem>
                    <SelectItem value="fixed">Fixed Lot Size</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.lotSizeMode === 'fixed' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lotSize">Fixed Lot Size</Label>
                    <Input
                      id="lotSize"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={settings.lotSize || 0.01}
                      onChange={(e) => handleSettingChange('lotSize', parseFloat(e.target.value) || 0.01)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minLotSize">Min Lot Size</Label>
                    <Input
                      id="minLotSize"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={settings.minLotSize || 0.01}
                      onChange={(e) => handleSettingChange('minLotSize', parseFloat(e.target.value) || 0.01)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxLotSize">Max Lot Size</Label>
                    <Input
                      id="maxLotSize"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={settings.maxLotSize || 10}
                      onChange={(e) => handleSettingChange('maxLotSize', parseFloat(e.target.value) || 10)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
                  <Input
                    id="maxDailyLoss"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.maxDailyLoss || ''}
                    onChange={(e) => handleSettingChange('maxDailyLoss', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-gray-500">Stop trading after this loss percentage</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDailyProfit">Max Daily Profit (%)</Label>
                  <Input
                    id="maxDailyProfit"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.maxDailyProfit || ''}
                    onChange={(e) => handleSettingChange('maxDailyProfit', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-gray-500">Stop trading after this profit percentage</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxDailyTrades">Max Daily Trades</Label>
                  <Input
                    id="maxDailyTrades"
                    type="number"
                    min="0"
                    value={settings.maxDailyTrades || ''}
                    onChange={(e) => handleSettingChange('maxDailyTrades', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="0 = Unlimited"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forceStopConsecutiveLosses">Force Stop After Consecutive Losses</Label>
                  <Input
                    id="forceStopConsecutiveLosses"
                    type="number"
                    min="1"
                    value={settings.forceStopConsecutiveLosses || ''}
                    onChange={(e) => handleSettingChange('forceStopConsecutiveLosses', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TP/SL Tab */}
          <TabsContent value="tp-sl" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Take Profit / Stop Loss
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="takeProfitPercent">Take Profit (%)</Label>
                  <Input
                    id="takeProfitPercent"
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={settings.takeProfitPercent}
                    onChange={(e) => handleSettingChange('takeProfitPercent', parseFloat(e.target.value) || 2)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stopLossPercent">Stop Loss (%)</Label>
                  <Input
                    id="stopLossPercent"
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={settings.stopLossPercent}
                    onChange={(e) => handleSettingChange('stopLossPercent', parseFloat(e.target.value) || 1)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slMethod">Stop Loss Method</Label>
                <Select
                  value={settings.slMethod || 'percent'}
                  onValueChange={(value: 'pips' | 'atr' | 'candle' | 'percent') => handleSettingChange('slMethod', value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="slMethod" className="bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="atr">ATR-Based</SelectItem>
                    <SelectItem value="pips">Pips</SelectItem>
                    <SelectItem value="candle">Candle-Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.slMethod === 'atr' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="atrPeriod">ATR Period</Label>
                    <Input
                      id="atrPeriod"
                      type="number"
                      min="2"
                      max="50"
                      value={settings.atrPeriod || 14}
                      onChange={(e) => handleSettingChange('atrPeriod', parseInt(e.target.value) || 14)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="atrMultiplier">ATR Multiplier</Label>
                    <Input
                      id="atrMultiplier"
                      type="number"
                      min="0.5"
                      max="10"
                      step="0.1"
                      value={settings.atrMultiplier || 2}
                      onChange={(e) => handleSettingChange('atrMultiplier', parseFloat(e.target.value) || 2)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                </div>
              )}

              {settings.slMethod === 'pips' && (
                <div className="space-y-2">
                  <Label htmlFor="slValue">Stop Loss (Pips)</Label>
                  <Input
                    id="slValue"
                    type="number"
                    min="1"
                    value={settings.slValue || ''}
                    onChange={(e) => handleSettingChange('slValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minStopLossPercent">Min Stop Loss (%)</Label>
                  <Input
                    id="minStopLossPercent"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings.minStopLossPercent || ''}
                    onChange={(e) => handleSettingChange('minStopLossPercent', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStopLossPercent">Max Stop Loss (%)</Label>
                  <Input
                    id="maxStopLossPercent"
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={settings.maxStopLossPercent || ''}
                    onChange={(e) => handleSettingChange('maxStopLossPercent', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpMultiplier">TP Multiplier (TP = SL × Multiplier)</Label>
                <Input
                  id="tpMultiplier"
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={settings.tpMultiplier || 3}
                  onChange={(e) => handleSettingChange('tpMultiplier', parseFloat(e.target.value) || 3)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                />
                <p className="text-xs text-gray-500">Take Profit = Stop Loss × Multiplier (e.g., 3 = 3:1 Risk/Reward)</p>
              </div>
            </div>
          </TabsContent>

          {/* Trading Session Tab */}
          <TabsContent value="session" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Trading Session
                </h3>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={settings.tradingSessionEnabled}
                    onCheckedChange={(checked) => handleSettingChange('tradingSessionEnabled', checked)}
                    disabled={isDisabled}
                  />
                  <Label>Enable Trading Session</Label>
                </div>
              </div>
              
              {settings.tradingSessionEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionStart">Session Start (HH:MM)</Label>
                    <Input
                      id="sessionStart"
                      type="time"
                      value={settings.sessionStart || '09:00'}
                      onChange={(e) => handleSettingChange('sessionStart', e.target.value)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionEnd">Session End (HH:MM)</Label>
                    <Input
                      id="sessionEnd"
                      type="time"
                      value={settings.sessionEnd || '17:00'}
                      onChange={(e) => handleSettingChange('sessionEnd', e.target.value)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxTradesPerSession">Max Trades Per Session</Label>
                <Input
                  id="maxTradesPerSession"
                  type="number"
                  min="0"
                  value={settings.maxTradesPerSession || ''}
                  onChange={(e) => handleSettingChange('maxTradesPerSession', e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                  placeholder="0 = Unlimited"
                />
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Advanced Features
              </h3>

              {/* Breakeven */}
              <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableBreakeven" className="text-sm font-semibold">Enable Breakeven</Label>
                    <p className="text-xs text-gray-400">Move stop loss to entry price when profit target reached</p>
                  </div>
                  <Switch
                    id="enableBreakeven"
                    checked={settings.enableBreakeven || false}
                    onCheckedChange={(checked) => handleSettingChange('enableBreakeven', checked)}
                    disabled={isDisabled}
                  />
                </div>
                {settings.enableBreakeven && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="breakevenTriggerRR">Breakeven Trigger (Risk/Reward)</Label>
                      <Input
                        id="breakevenTriggerRR"
                        type="number"
                        min="0.5"
                        max="5"
                        step="0.1"
                        value={settings.breakevenTriggerRR || 1}
                        onChange={(e) => handleSettingChange('breakevenTriggerRR', parseFloat(e.target.value) || 1)}
                        disabled={isDisabled}
                        className="bg-gray-800"
                      />
                      <p className="text-xs text-gray-500">Move to breakeven when profit reaches this RR (e.g., 1 = 1:1)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="breakevenTriggerPips">Breakeven Trigger (Pips)</Label>
                      <Input
                        id="breakevenTriggerPips"
                        type="number"
                        min="1"
                        value={settings.breakevenTriggerPips || ''}
                        onChange={(e) => handleSettingChange('breakevenTriggerPips', e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isDisabled}
                        className="bg-gray-800"
                        placeholder="Alternative to RR"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Trailing Stop */}
              <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableTrailingStop" className="text-sm font-semibold">Enable Trailing Stop</Label>
                    <p className="text-xs text-gray-400">Automatically adjust stop loss as price moves in your favor</p>
                  </div>
                  <Switch
                    id="enableTrailingStop"
                    checked={settings.enableTrailingStop || false}
                    onCheckedChange={(checked) => handleSettingChange('enableTrailingStop', checked)}
                    disabled={isDisabled}
                  />
                </div>
                {settings.enableTrailingStop && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="trailingStopPercent">Trailing Distance (%)</Label>
                      <Input
                        id="trailingStopPercent"
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={settings.trailingStopPercent || ''}
                        onChange={(e) => handleSettingChange('trailingStopPercent', e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isDisabled}
                        className="bg-gray-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trailingStopATRMultiplier">Trailing Distance (ATR Multiplier)</Label>
                      <Input
                        id="trailingStopATRMultiplier"
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.1"
                        value={settings.trailingStopATRMultiplier || ''}
                        onChange={(e) => handleSettingChange('trailingStopATRMultiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isDisabled}
                        className="bg-gray-800"
                        placeholder="Alternative to %"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Martingale */}
              <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="martingale" className="text-sm font-semibold">Enable Martingale</Label>
                    <p className="text-xs text-gray-400">Automatically increase stake after losses</p>
                  </div>
                  <Switch
                    id="martingale"
                    checked={settings.martingale || false}
                    onCheckedChange={(checked) => handleSettingChange('martingale', checked)}
                    disabled={isDisabled}
                  />
                </div>
                {settings.martingale && (
                  <div className="space-y-2 mt-3">
                    <Label htmlFor="martingaleMultiplier">Martingale Multiplier</Label>
                    <Input
                      id="martingaleMultiplier"
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={settings.martingaleMultiplier || 2}
                      onChange={(e) => handleSettingChange('martingaleMultiplier', parseFloat(e.target.value) || 2)}
                      disabled={isDisabled}
                      className="bg-gray-800"
                    />
                    <p className="text-xs text-gray-500">Multiplier for stake increase after each loss</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dailyProfitTarget">Daily Profit Target (%)</Label>
                <Input
                  id="dailyProfitTarget"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.dailyProfitTarget || ''}
                  onChange={(e) => handleSettingChange('dailyProfitTarget', e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                  placeholder="Optional"
                />
                <p className="text-xs text-gray-500">Target profit percentage to reach daily</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forceStopDrawdown">Force Stop Drawdown (%)</Label>
                <Input
                  id="forceStopDrawdown"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.forceStopDrawdown || ''}
                  onChange={(e) => handleSettingChange('forceStopDrawdown', e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                  placeholder="Optional"
                />
                <p className="text-xs text-gray-500">Stop trading if account drawdown exceeds this percentage</p>
              </div>
            </div>
          </TabsContent>

          {/* Strategy Tab */}
          <TabsContent value="strategy" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Strategy Parameters
              </h3>

              <div className="space-y-2">
                <Label htmlFor="candleTimeframe">Candle Timeframe</Label>
                <Select
                  value={settings.candleTimeframe || '5m'}
                  onValueChange={(value: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d') => handleSettingChange('candleTimeframe', value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="candleTimeframe" className="bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 Minute</SelectItem>
                    <SelectItem value="3m">3 Minutes</SelectItem>
                    <SelectItem value="5m">5 Minutes</SelectItem>
                    <SelectItem value="15m">15 Minutes</SelectItem>
                    <SelectItem value="30m">30 Minutes</SelectItem>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="4h">4 Hours</SelectItem>
                    <SelectItem value="1d">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smaPeriod">SMA Period</Label>
                  <Input
                    id="smaPeriod"
                    type="number"
                    min="2"
                    max="200"
                    value={settings.smaPeriod || 50}
                    onChange={(e) => handleSettingChange('smaPeriod', parseInt(e.target.value) || 50)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smaPeriod2">SMA Period 2 (Optional)</Label>
                  <Input
                    id="smaPeriod2"
                    type="number"
                    min="2"
                    max="200"
                    value={settings.smaPeriod2 || ''}
                    onChange={(e) => handleSettingChange('smaPeriod2', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                <div className="space-y-0.5">
                  <Label htmlFor="fiveMinTrendConfirmation" className="text-sm font-semibold">5-Minute Trend Confirmation</Label>
                  <p className="text-xs text-gray-400">Require 5-minute trend confirmation before entry</p>
                </div>
                <Switch
                  id="fiveMinTrendConfirmation"
                  checked={settings.fiveMinTrendConfirmation ?? true}
                  onCheckedChange={(checked) => handleSettingChange('fiveMinTrendConfirmation', checked)}
                  disabled={isDisabled}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                <div className="space-y-0.5">
                  <Label htmlFor="spikeDetectionEnabled" className="text-sm font-semibold">Spike Detection</Label>
                  <p className="text-xs text-gray-400">Enable spike detection for Boom/Crash instruments</p>
                </div>
                <Switch
                  id="spikeDetectionEnabled"
                  checked={settings.spikeDetectionEnabled || false}
                  onCheckedChange={(checked) => handleSettingChange('spikeDetectionEnabled', checked)}
                  disabled={isDisabled}
                />
              </div>

              {settings.spikeDetectionEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="spikeThreshold">Spike Threshold (%)</Label>
                  <Input
                    id="spikeThreshold"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings.spikeThreshold || 0.5}
                    onChange={(e) => handleSettingChange('spikeThreshold', parseFloat(e.target.value) || 0.5)}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="minTimeInTrade">Min Time in Trade (Candles)</Label>
                <Input
                  id="minTimeInTrade"
                  type="number"
                  min="1"
                  value={settings.minTimeInTrade || 1}
                  onChange={(e) => handleSettingChange('minTimeInTrade', parseInt(e.target.value) || 1)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                />
                <p className="text-xs text-gray-500">Minimum candles before reverse signal exit</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
