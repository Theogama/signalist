/**
 * Hook for managing bot settings
 */

import { useState, useEffect, useCallback } from 'react';

export interface BotSettings {
  broker: 'exness' | 'deriv';
  instrument: string;
  enabled: boolean;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  candleTimeframe: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  smaPeriod: number;
  smaPeriod2?: number;
  tpMultiplier: number;
  slMethod: 'pips' | 'atr' | 'candle';
  slValue?: number;
  atrPeriod?: number;
  spikeDetectionEnabled: boolean;
  spikeThreshold?: number;
  strategy: 'Signalist-SMA-3C' | 'Custom';
  magicNumber?: number;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  forceStopDrawdown?: number;
  forceStopConsecutiveLosses?: number;
  minTimeInTrade?: number;
  smaCrossLookback?: number;
  fiveMinTrendConfirmation: boolean;
  // Broker credentials
  mt5Login?: number;
  mt5Password?: string;
  mt5Server?: string;
  derivToken?: string;
}

export function useBotSettings(broker?: string, instrument?: string) {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (broker) params.append('broker', broker);
      if (instrument) params.append('instrument', instrument);

      const response = await fetch(`/api/bot/settings?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.settings && data.settings.length > 0) {
        setSettings(data.settings[0]);
      } else {
        setSettings(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, [broker, instrument]);

  const saveSettings = useCallback(async (newSettings: Partial<BotSettings>) => {
    try {
      setError(null);

      const response = await fetch('/api/bot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        return { success: true, settings: data.settings };
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
      return { success: false, error: err.message };
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    saveSettings,
  };
}









