'use client';

/**
 * MT5 Auto-Trade Settings Component
 * Complete settings panel for MT5 auto-trading
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertCircle, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MT5Settings {
  enabled: boolean;
  symbol: string;
  riskPercent: number;
  lotSize: number;
  lotSizeMode: 'auto' | 'fixed';
  takeProfit: number;
  stopLoss: number;
  magicNumber: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  newsFilter: boolean;
}

const AVAILABLE_SYMBOLS = [
  'XAUUSD',
  'NAS100',
  'US30',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'NZDUSD',
  'USDCHF',
];

export default function MT5AutoTradeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MT5Settings>({
    enabled: false,
    symbol: 'XAUUSD',
    riskPercent: 1,
    lotSize: 0.01,
    lotSizeMode: 'auto',
    takeProfit: 0,
    stopLoss: 0,
    magicNumber: 2025,
    maxDailyLoss: 0,
    maxDailyTrades: 0,
    newsFilter: false,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mt5/settings/update');
      const data = await response.json();

      if (data.success && data.data) {
        setSettings({
          enabled: data.data.enabled ?? false,
          symbol: data.data.symbol || 'XAUUSD',
          riskPercent: data.data.riskPercent || 1,
          lotSize: data.data.lotSize || 0.01,
          lotSizeMode: data.data.lotSizeMode || 'auto',
          takeProfit: data.data.takeProfit || 0,
          stopLoss: data.data.stopLoss || 0,
          magicNumber: data.data.magicNumber || 2025,
          maxDailyLoss: data.data.maxDailyLoss || 0,
          maxDailyTrades: data.data.maxDailyTrades || 0,
          newsFilter: data.data.newsFilter ?? false,
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/mt5/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof MT5Settings>(key: K, value: MT5Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auto-Trade Settings</CardTitle>
            <CardDescription>
              Configure your MT5 auto-trading bot. All settings are validated before trades are executed.
            </CardDescription>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="text-base font-semibold">Enable Auto Trading</Label>
            <p className="text-sm text-gray-400">Turn auto-trading on or off</p>
          </div>
          <Switch
            id="enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
          />
        </div>

        {/* Symbol Selection */}
        <div className="space-y-2">
          <Label htmlFor="symbol">Trading Symbol</Label>
          <Select
            value={settings.symbol}
            onValueChange={(value) => updateSetting('symbol', value)}
          >
            <SelectTrigger id="symbol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_SYMBOLS.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Select the instrument to trade</p>
        </div>

        {/* Risk Management */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Risk Management</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riskPercent">Risk Per Trade (%)</Label>
              <Input
                id="riskPercent"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={settings.riskPercent}
                onChange={(e) => updateSetting('riskPercent', parseFloat(e.target.value) || 1)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Percentage of balance at risk per trade</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lotSizeMode">Lot Size Mode</Label>
              <Select
                value={settings.lotSizeMode}
                onValueChange={(value: 'auto' | 'fixed') => updateSetting('lotSizeMode', value)}
              >
                <SelectTrigger id="lotSizeMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Based on Risk %)</SelectItem>
                  <SelectItem value="fixed">Fixed Lot Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.lotSizeMode === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="lotSize">Fixed Lot Size</Label>
              <Input
                id="lotSize"
                type="number"
                min="0.01"
                step="0.01"
                value={settings.lotSize}
                onChange={(e) => updateSetting('lotSize', parseFloat(e.target.value) || 0.01)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Fixed lot size to use for all trades</p>
            </div>
          )}
        </div>

        {/* Take Profit & Stop Loss */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Take Profit & Stop Loss</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="takeProfit">Take Profit (Points)</Label>
              <Input
                id="takeProfit"
                type="number"
                min="0"
                step="1"
                value={settings.takeProfit}
                onChange={(e) => updateSetting('takeProfit', parseFloat(e.target.value) || 0)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Take profit in points (0 = disabled)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (Points)</Label>
              <Input
                id="stopLoss"
                type="number"
                min="0"
                step="1"
                value={settings.stopLoss}
                onChange={(e) => updateSetting('stopLoss', parseFloat(e.target.value) || 0)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Stop loss in points (0 = disabled)</p>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Advanced Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="magicNumber">Magic Number</Label>
              <Input
                id="magicNumber"
                type="number"
                min="1"
                value={settings.magicNumber}
                onChange={(e) => updateSetting('magicNumber', parseInt(e.target.value) || 2025)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Unique identifier for bot trades (default: 2025)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDailyTrades">Max Daily Trades</Label>
              <Input
                id="maxDailyTrades"
                type="number"
                min="0"
                value={settings.maxDailyTrades}
                onChange={(e) => updateSetting('maxDailyTrades', parseInt(e.target.value) || 0)}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-500">Maximum trades per day (0 = unlimited)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
            <Input
              id="maxDailyLoss"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.maxDailyLoss}
              onChange={(e) => updateSetting('maxDailyLoss', parseFloat(e.target.value) || 0)}
              className="bg-gray-800"
            />
            <p className="text-xs text-gray-500">Stop trading after this loss percentage (0 = disabled)</p>
          </div>

          {/* News Filter */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800">
            <div className="space-y-0.5">
              <Label htmlFor="newsFilter" className="text-sm font-semibold">News Filter</Label>
              <p className="text-xs text-gray-400">Pause trading during high-impact news events</p>
            </div>
            <Switch
              id="newsFilter"
              checked={settings.newsFilter}
              onCheckedChange={(checked) => updateSetting('newsFilter', checked)}
            />
          </div>
        </div>

        {/* Safety Notice */}
        <div className="flex items-start gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-yellow-400">Safety Reminders</p>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Always test with demo account first</li>
              <li>Set appropriate risk percentages (recommended: 1-2%)</li>
              <li>Use stop loss on all trades</li>
              <li>Monitor your account regularly</li>
              <li>Never risk more than you can afford to lose</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




