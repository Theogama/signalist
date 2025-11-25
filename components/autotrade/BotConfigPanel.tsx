'use client';

/**
 * Bot Configuration Panel Component
 * Allows users to configure bot parameters like risk, TP/SL, martingale, etc.
 */

import { useEffect } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle } from 'lucide-react';

export default function BotConfigPanel() {
  const {
    selectedBot,
    botParams,
    botStatus,
    updateBotParams,
  } = useAutoTradingStore();

  const isRunning = botStatus === 'running';
  const isDisabled = isRunning || !selectedBot || !botParams;

  // Initialize params from selected bot if not set
  useEffect(() => {
    if (selectedBot && !botParams) {
      updateBotParams(selectedBot.parameters);
    }
  }, [selectedBot, botParams, updateBotParams]);

  if (!selectedBot) {
    return (
      <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <span className="text-sm text-yellow-400">Select a bot from the library to configure</span>
      </div>
    );
  }

  if (!botParams) {
    return (
      <div className="text-center py-4 text-gray-400">
        Loading bot parameters...
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    updateBotParams({ [key]: value });
  };

  return (
    <div className="space-y-6">
      {isRunning && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-blue-400">Configuration is locked while bot is running</span>
        </div>
      )}

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
              value={botParams.riskPercent || 1}
              onChange={(e) => handleChange('riskPercent', parseFloat(e.target.value) || 1)}
              disabled={isDisabled}
              className="bg-gray-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="takeProfitPercent">Take Profit (%)</Label>
            <Input
              id="takeProfitPercent"
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={botParams.takeProfitPercent || 2}
              onChange={(e) => handleChange('takeProfitPercent', parseFloat(e.target.value) || 2)}
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
              value={botParams.stopLossPercent || 1}
              onChange={(e) => handleChange('stopLossPercent', parseFloat(e.target.value) || 1)}
              disabled={isDisabled}
              className="bg-gray-800"
            />
          </div>

          {botParams.lotSize !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="lotSize">Lot Size</Label>
              <Input
                id="lotSize"
                type="number"
                min="0.01"
                step="0.01"
                value={botParams.lotSize || 0.01}
                onChange={(e) => handleChange('lotSize', parseFloat(e.target.value) || 0.01)}
                disabled={isDisabled}
                className="bg-gray-800"
              />
            </div>
          )}

          {botParams.maxTrades !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="maxTrades">Max Trades</Label>
              <Input
                id="maxTrades"
                type="number"
                min="1"
                value={botParams.maxTrades || 1}
                onChange={(e) => handleChange('maxTrades', parseInt(e.target.value) || 1)}
                disabled={isDisabled}
                className="bg-gray-800"
              />
            </div>
          )}
        </div>
      </div>

      {/* Martingale Settings */}
      {(botParams.martingale !== undefined || botParams.martingaleMultiplier !== undefined) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Martingale Settings</h3>
          
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800">
            <div className="space-y-0.5">
              <Label htmlFor="martingale" className="text-sm">Enable Martingale</Label>
              <p className="text-xs text-gray-400">Automatically increase stake after losses</p>
            </div>
            <Switch
              id="martingale"
              checked={botParams.martingale || false}
              onCheckedChange={(checked) => handleChange('martingale', checked)}
              disabled={isDisabled}
            />
          </div>

          {botParams.martingale && botParams.martingaleMultiplier !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="martingaleMultiplier">Martingale Multiplier</Label>
              <Input
                id="martingaleMultiplier"
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={botParams.martingaleMultiplier || 2}
                onChange={(e) => handleChange('martingaleMultiplier', parseFloat(e.target.value) || 2)}
                disabled={isDisabled}
                className="bg-gray-800"
              />
              <p className="text-xs text-gray-400">Multiplier for stake increase after each loss</p>
            </div>
          )}
        </div>
      )}

      {/* Session Times */}
      {(botParams.sessionStart !== undefined || botParams.sessionEnd !== undefined) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Trading Session</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {botParams.sessionStart !== undefined && (
              <div className="space-y-2">
                <Label htmlFor="sessionStart">Session Start (HH:MM)</Label>
                <Input
                  id="sessionStart"
                  type="time"
                  value={botParams.sessionStart || '00:00'}
                  onChange={(e) => handleChange('sessionStart', e.target.value)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                />
              </div>
            )}

            {botParams.sessionEnd !== undefined && (
              <div className="space-y-2">
                <Label htmlFor="sessionEnd">Session End (HH:MM)</Label>
                <Input
                  id="sessionEnd"
                  type="time"
                  value={botParams.sessionEnd || '23:59'}
                  onChange={(e) => handleChange('sessionEnd', e.target.value)}
                  disabled={isDisabled}
                  className="bg-gray-800"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional Parameters */}
      {Object.keys(botParams).some(key => 
        !['riskPercent', 'takeProfitPercent', 'stopLossPercent', 'lotSize', 'maxTrades', 
          'sessionStart', 'sessionEnd', 'martingale', 'martingaleMultiplier'].includes(key)
      ) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Additional Parameters</h3>
          <div className="space-y-2">
            {Object.entries(botParams)
              .filter(([key]) => 
                !['riskPercent', 'takeProfitPercent', 'stopLossPercent', 'lotSize', 'maxTrades',
                  'sessionStart', 'sessionEnd', 'martingale', 'martingaleMultiplier'].includes(key)
              )
              .map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Label>
                  <Input
                    id={key}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    value={String(value || '')}
                    onChange={(e) => {
                      const newValue = typeof value === 'number' 
                        ? parseFloat(e.target.value) || 0 
                        : e.target.value;
                      handleChange(key, newValue);
                    }}
                    disabled={isDisabled}
                    className="bg-gray-800"
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
