'use client';

/**
 * Unified Auto-Trade Settings Panel
 * Single source of truth for all auto-trading configurations
 * Replaces all old bot settings
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertCircle, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { settingsSyncService } from '@/lib/services/settings-sync.service';

export interface AutoTradeSettings {
  // Risk Management
  riskPercent: number;
  lotSize?: number;
  maxTrades: number;
  
  // TP/SL
  takeProfitPercent: number;
  stopLossPercent: number;
  
  // Trading Session
  tradingSessionEnabled: boolean;
  sessionStart?: string;
  sessionEnd?: string;
  
  // Additional Settings
  martingale?: boolean;
  martingaleMultiplier?: number;
  maxDailyLoss?: number;
  maxDailyProfit?: number;
  
  // Broker-specific
  broker: 'exness' | 'deriv' | null;
}

interface AutoTradeSettingsPanelProps {
  onSettingsChange?: (settings: AutoTradeSettings) => void;
  disabled?: boolean;
}

export default function AutoTradeSettingsPanel({ 
  onSettingsChange,
  disabled = false 
}: AutoTradeSettingsPanelProps) {
  const { 
    connectedBroker, 
    botStatus,
    selectedBot,
    botParams,
    updateBotParams
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
    broker: connectedBroker,
  });

  // Sync with store when bot is selected or params change
  useEffect(() => {
    if (botParams) {
      setSettings({
        riskPercent: botParams.riskPercent || 1,
        lotSize: botParams.lotSize,
        maxTrades: botParams.maxTrades || 1,
        takeProfitPercent: botParams.takeProfitPercent || 2,
        stopLossPercent: botParams.stopLossPercent || 1,
        tradingSessionEnabled: !!(botParams.sessionStart || botParams.sessionEnd),
        sessionStart: botParams.sessionStart || '09:00',
        sessionEnd: botParams.sessionEnd || '17:00',
        martingale: botParams.martingale || false,
        martingaleMultiplier: botParams.martingaleMultiplier || 2,
        maxDailyLoss: botParams.maxDailyLoss,
        maxDailyProfit: botParams.maxDailyProfit,
        broker: connectedBroker,
      });
    }
  }, [botParams, connectedBroker]);

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
      // Use settings sync service to save and broadcast
      // Get userId from session (this would need to be passed or fetched)
      // For now, save directly
      const response = await fetch('/api/auto-trading/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Auto-trade settings saved successfully');
        // Settings sync service will broadcast the update
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auto-Trade Settings</CardTitle>
            <CardDescription>
              Configure all auto-trading parameters in one place
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={saveSettings}
            disabled={isDisabled}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isRunning && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-400">
              Settings are locked while auto-trade is running. Stop trading to modify settings.
            </span>
          </div>
        )}

        {/* Risk Management Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Risk Management</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riskPercent">Risk Per Trade (%)</Label>
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
              <p className="text-xs text-gray-500">Percentage of balance at risk per trade</p>
            </div>

            {settings.lotSize !== undefined && (
              <div className="space-y-2">
                <Label htmlFor="lotSize">Lot Size</Label>
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
            )}

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
        </div>

        {/* TP/SL Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Take Profit / Stop Loss</h3>
          
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
        </div>

        {/* Trading Session Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Trading Session</h3>
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
        </div>

        {/* Martingale Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800">
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
            <div className="space-y-2">
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

        {/* Daily Limits Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Daily Limits</h3>
          
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
        </div>
      </CardContent>
    </Card>
  );
}

