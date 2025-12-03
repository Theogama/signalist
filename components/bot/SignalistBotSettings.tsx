/**
 * Signalist Bot Settings Component
 * Unified settings page for Signalist trading bot
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBotSettings } from '@/lib/hooks/useBotSettings';
import { toast } from 'sonner';

const EXNESS_INSTRUMENTS = ['XAUUSD', 'US30', 'NAS100'];
const DERIV_INSTRUMENTS = ['BOOM1000', 'BOOM500', 'BOOM100', 'CRASH1000', 'CRASH500', 'CRASH100'];

export function SignalistBotSettings() {
  const [broker, setBroker] = useState<'exness' | 'deriv'>('exness');
  const [instrument, setInstrument] = useState('XAUUSD');
  const [formData, setFormData] = useState({
    enabled: false,
    riskPerTrade: 10,
    maxDailyLoss: 0,
    maxDailyTrades: 0,
    candleTimeframe: '5m' as const,
    smaPeriod: 50,
    smaPeriod2: undefined as number | undefined,
    tpMultiplier: 3,
    slMethod: 'atr' as const,
    slValue: undefined as number | undefined,
    atrPeriod: 14,
    spikeDetectionEnabled: false,
    spikeThreshold: 0.5,
    loggingLevel: 'info' as const,
    forceStopDrawdown: undefined as number | undefined,
    forceStopConsecutiveLosses: undefined as number | undefined,
    minTimeInTrade: 1,
    smaCrossLookback: 8,
    fiveMinTrendConfirmation: true,
    // Broker credentials
    mt5Login: undefined as number | undefined,
    mt5Password: '',
    mt5Server: '',
    derivToken: '',
    magicNumber: 2025,
  });

  const { settings, loading, error, saveSettings } = useBotSettings(broker, instrument);

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled,
        riskPerTrade: settings.riskPerTrade,
        maxDailyLoss: settings.maxDailyLoss || 0,
        maxDailyTrades: settings.maxDailyTrades || 0,
        candleTimeframe: settings.candleTimeframe,
        smaPeriod: settings.smaPeriod,
        smaPeriod2: settings.smaPeriod2,
        tpMultiplier: settings.tpMultiplier,
        slMethod: settings.slMethod,
        slValue: settings.slValue,
        atrPeriod: settings.atrPeriod || 14,
        spikeDetectionEnabled: settings.spikeDetectionEnabled,
        spikeThreshold: settings.spikeThreshold || 0.5,
        loggingLevel: settings.loggingLevel,
        forceStopDrawdown: settings.forceStopDrawdown,
        forceStopConsecutiveLosses: settings.forceStopConsecutiveLosses,
        minTimeInTrade: settings.minTimeInTrade || 1,
        smaCrossLookback: settings.smaCrossLookback || 8,
        fiveMinTrendConfirmation: settings.fiveMinTrendConfirmation !== false,
        mt5Login: settings.mt5Login,
        mt5Password: '',
        mt5Server: settings.mt5Server || '',
        derivToken: '',
        magicNumber: settings.magicNumber || 2025,
      });
      setInstrument(settings.instrument);
    }
  }, [settings]);

  const handleSave = async () => {
    const result = await saveSettings({
      broker,
      instrument,
      ...formData,
    });

    if (result.success) {
      toast.success('Settings saved successfully');
    } else {
      toast.error(result.error || 'Failed to save settings');
    }
  };

  const availableInstruments = broker === 'exness' ? EXNESS_INSTRUMENTS : DERIV_INSTRUMENTS;

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Signalist Bot Settings</CardTitle>
          <CardDescription>
            Configure your unified trading bot for {broker === 'exness' ? 'Exness (MT5)' : 'Deriv'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Broker Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Broker</Label>
              <Select value={broker} onValueChange={(value) => setBroker(value as 'exness' | 'deriv')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exness">Exness (MT5)</SelectItem>
                  <SelectItem value="deriv">Deriv</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Instrument</Label>
              <Select value={instrument} onValueChange={setInstrument}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableInstruments.map((inst) => (
                    <SelectItem key={inst} value={inst}>
                      {inst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enable Bot */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Auto-Trade</Label>
              <p className="text-sm text-muted-foreground">Enable automatic trading</p>
            </div>
            <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} />
          </div>

          {/* Risk Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Risk Management</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Risk per Trade (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.riskPerTrade}
                  onChange={(e) => setFormData({ ...formData, riskPerTrade: Number(e.target.value) })}
                />
                {formData.riskPerTrade > 20 && (
                  <p className="text-sm text-yellow-600 mt-1">Warning: Risk above 20% is high</p>
                )}
              </div>

              <div>
                <Label>Max Daily Loss (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.maxDailyLoss}
                  onChange={(e) => setFormData({ ...formData, maxDailyLoss: Number(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">0 = disabled</p>
              </div>

              <div>
                <Label>Max Daily Trades</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.maxDailyTrades}
                  onChange={(e) => setFormData({ ...formData, maxDailyTrades: Number(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">0 = unlimited</p>
              </div>
            </div>
          </div>

          {/* Trading Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Trading Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Candle Timeframe</Label>
                <Select
                  value={formData.candleTimeframe}
                  onValueChange={(value) => setFormData({ ...formData, candleTimeframe: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 Minute</SelectItem>
                    <SelectItem value="3m">3 Minutes</SelectItem>
                    <SelectItem value="5m">5 Minutes</SelectItem>
                    <SelectItem value="15m">15 Minutes</SelectItem>
                    <SelectItem value="30m">30 Minutes</SelectItem>
                    <SelectItem value="1h">1 Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>TP/SL Multiplier</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.1"
                  value={formData.tpMultiplier}
                  onChange={(e) => setFormData({ ...formData, tpMultiplier: Number(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">TP = {formData.tpMultiplier}x SL</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>SMA Period</Label>
                <Input
                  type="number"
                  min="2"
                  value={formData.smaPeriod}
                  onChange={(e) => setFormData({ ...formData, smaPeriod: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>SMA Period 2 (Optional)</Label>
                <Input
                  type="number"
                  min="2"
                  value={formData.smaPeriod2 || ''}
                  onChange={(e) => setFormData({ ...formData, smaPeriod2: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g., 200"
                />
              </div>

              <div>
                <Label>SMA Cross Lookback</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.smaCrossLookback}
                  onChange={(e) => setFormData({ ...formData, smaCrossLookback: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Stop Loss Method</Label>
              <Select
                value={formData.slMethod}
                onValueChange={(value) => setFormData({ ...formData, slMethod: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atr">ATR-based</SelectItem>
                  <SelectItem value="pips">Pips</SelectItem>
                  <SelectItem value="candle">Candle-based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.slMethod === 'atr' && (
              <div>
                <Label>ATR Period</Label>
                <Input
                  type="number"
                  min="2"
                  value={formData.atrPeriod}
                  onChange={(e) => setFormData({ ...formData, atrPeriod: Number(e.target.value) })}
                />
              </div>
            )}

            {formData.slMethod === 'pips' && (
              <div>
                <Label>Stop Loss (Pips)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.slValue || ''}
                  onChange={(e) => setFormData({ ...formData, slValue: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            )}
          </div>

          {/* Spike Detection (for Deriv) */}
          {broker === 'deriv' && (instrument.includes('BOOM') || instrument.includes('CRASH')) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Spike Detection</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Spike Detection</Label>
                  <p className="text-sm text-muted-foreground">Required for Boom/Crash instruments</p>
                </div>
                <Switch
                  checked={formData.spikeDetectionEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, spikeDetectionEnabled: checked })}
                />
              </div>
              {formData.spikeDetectionEnabled && (
                <div>
                  <Label>Spike Threshold (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.spikeThreshold}
                    onChange={(e) => setFormData({ ...formData, spikeThreshold: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Broker Credentials */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Broker Credentials</h3>
            
            {broker === 'exness' ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>MT5 Login</Label>
                  <Input
                    type="number"
                    value={formData.mt5Login || ''}
                    onChange={(e) => setFormData({ ...formData, mt5Login: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <Label>MT5 Password</Label>
                  <Input
                    type="password"
                    value={formData.mt5Password}
                    onChange={(e) => setFormData({ ...formData, mt5Password: e.target.value })}
                    placeholder="Leave empty to keep existing"
                  />
                </div>
                <div>
                  <Label>MT5 Server</Label>
                  <Input
                    value={formData.mt5Server}
                    onChange={(e) => setFormData({ ...formData, mt5Server: e.target.value })}
                    placeholder="e.g., Exness-MT5Real"
                  />
                </div>
                <div>
                  <Label>Magic Number</Label>
                  <Input
                    type="number"
                    value={formData.magicNumber}
                    onChange={(e) => setFormData({ ...formData, magicNumber: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label>Deriv Token</Label>
                <Input
                  type="password"
                  value={formData.derivToken}
                  onChange={(e) => setFormData({ ...formData, derivToken: e.target.value })}
                  placeholder="Leave empty to keep existing"
                />
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Advanced Settings</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>5-Minute Trend Confirmation</Label>
                <p className="text-sm text-muted-foreground">Require 5m trend alignment</p>
              </div>
              <Switch
                checked={formData.fiveMinTrendConfirmation}
                onCheckedChange={(checked) => setFormData({ ...formData, fiveMinTrendConfirmation: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Force Stop Drawdown (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.forceStopDrawdown || ''}
                  onChange={(e) => setFormData({ ...formData, forceStopDrawdown: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="0 = disabled"
                />
              </div>

              <div>
                <Label>Force Stop Consecutive Losses</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.forceStopConsecutiveLosses || ''}
                  onChange={(e) => setFormData({ ...formData, forceStopConsecutiveLosses: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="0 = disabled"
                />
              </div>
            </div>

            <div>
              <Label>Logging Level</Label>
              <Select
                value={formData.loggingLevel}
                onValueChange={(value) => setFormData({ ...formData, loggingLevel: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={loading}>
              Save Settings
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

