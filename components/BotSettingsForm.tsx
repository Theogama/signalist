'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { updateBotSettings } from '@/lib/actions/bot.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type BotSettingsFormData = {
  enabled: boolean;
  maxTradeSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  trailingStop: boolean;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  paperMode: boolean;
};

type BotSettingsFormProps = {
  initialSettings: {
    enabled?: boolean;
    maxTradeSizePct?: number;
    stopLossPct?: number;
    takeProfitPct?: number;
    trailingStop?: boolean;
    exchange?: string;
    paperMode?: boolean;
  } | null;
};

export default function BotSettingsForm({ initialSettings }: BotSettingsFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BotSettingsFormData>({
    defaultValues: {
      enabled: initialSettings?.enabled ?? false,
      maxTradeSizePct: initialSettings?.maxTradeSizePct ?? 5,
      stopLossPct: initialSettings?.stopLossPct ?? 2,
      takeProfitPct: initialSettings?.takeProfitPct ?? 5,
      trailingStop: initialSettings?.trailingStop ?? false,
      exchange: initialSettings?.exchange ?? 'binance',
      apiKey: '',
      apiSecret: '',
      paperMode: initialSettings?.paperMode ?? true, // Default to true for safety
    },
  });

  useEffect(() => {
    if (initialSettings) {
      reset({
        enabled: initialSettings.enabled ?? false,
        maxTradeSizePct: initialSettings.maxTradeSizePct ?? 5,
        stopLossPct: initialSettings.stopLossPct ?? 2,
        takeProfitPct: initialSettings.takeProfitPct ?? 5,
        trailingStop: initialSettings.trailingStop ?? false,
        exchange: initialSettings.exchange ?? 'binance',
        apiKey: '',
        apiSecret: '',
        paperMode: initialSettings.paperMode ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSettings]); // reset is stable from react-hook-form

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      // Convert string numbers to actual numbers
      const result = await updateBotSettings({
        enabled: Boolean(data.enabled),
        maxTradeSizePct: Number(data.maxTradeSizePct),
        stopLossPct: Number(data.stopLossPct),
        takeProfitPct: Number(data.takeProfitPct),
        trailingStop: Boolean(data.trailingStop),
        exchange: String(data.exchange),
        apiKey: data.apiKey?.trim() || undefined,
        apiSecret: data.apiSecret?.trim() || undefined,
        paperMode: Boolean(data.paperMode),
      });

      if (result.success) {
        toast.success('Bot settings saved successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save bot settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save bot settings');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* Enable Auto-Execute Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex-1">
          <Label htmlFor="enabled" className="text-base font-semibold text-gray-100">
            Enable Auto-Execute
          </Label>
          <p className="text-sm text-gray-400 mt-1">
            Automatically execute trades when signals are received
          </p>
        </div>
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {/* Paper Trading Mode */}
      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex-1">
          <Label htmlFor="paperMode" className="text-base font-semibold text-gray-100">
            Paper Trading Mode
          </Label>
          <p className="text-sm text-gray-400 mt-1">
            Simulate trades without using real money (recommended for testing)
          </p>
        </div>
        <Controller
          control={control}
          name="paperMode"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {/* Exchange Selection */}
      <div className="space-y-2">
        <Label htmlFor="exchange" className="text-sm font-medium text-gray-300">
          Exchange
        </Label>
        <Controller
          control={control}
          name="exchange"
          rules={{ required: 'Exchange is required' }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white w-full">
                <SelectValue placeholder="Select exchange" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 text-white">
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="coinbase">Coinbase Pro</SelectItem>
                <SelectItem value="kraken">Kraken</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* API Keys Section */}
      <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold text-gray-100">Exchange API Credentials</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="text-yellow-400 hover:text-yellow-300"
          >
            {showApiKeys ? 'Hide' : 'Show'} Keys
          </Button>
        </div>
        <p className="text-sm text-gray-400">
          Your API keys are encrypted and stored securely. They are required for live trading.
        </p>

        {showApiKeys && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-medium text-gray-300">
                API Key
              </Label>
              <Input
                type="password"
                id="apiKey"
                placeholder="Enter your API key"
                className="bg-gray-800 border-gray-700 text-white"
                {...register('apiKey')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret" className="text-sm font-medium text-gray-300">
                API Secret
              </Label>
              <Input
                type="password"
                id="apiSecret"
                placeholder="Enter your API secret"
                className="bg-gray-800 border-gray-700 text-white"
                {...register('apiSecret')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trading Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-100">Trading Parameters</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxTradeSizePct" className="text-sm font-medium text-gray-300">
              Max Trade Size (%)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              id="maxTradeSizePct"
              placeholder="5"
              className="bg-gray-900 border-gray-700 text-white"
              {...register('maxTradeSizePct', {
                required: 'Max trade size is required',
                min: { value: 0.1, message: 'Must be at least 0.1%' },
                max: { value: 100, message: 'Must be at most 100%' },
                valueAsNumber: true,
              })}
            />
            {errors.maxTradeSizePct && (
              <p className="text-xs text-red-500">{errors.maxTradeSizePct.message}</p>
            )}
            <p className="text-xs text-gray-500">Percentage of account balance per trade</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stopLossPct" className="text-sm font-medium text-gray-300">
              Stop Loss (%)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              id="stopLossPct"
              placeholder="2"
              className="bg-gray-900 border-gray-700 text-white"
              {...register('stopLossPct', {
                required: 'Stop loss is required',
                min: { value: 0.1, message: 'Must be at least 0.1%' },
                max: { value: 50, message: 'Must be at most 50%' },
                valueAsNumber: true,
              })}
            />
            {errors.stopLossPct && (
              <p className="text-xs text-red-500">{errors.stopLossPct.message}</p>
            )}
            <p className="text-xs text-gray-500">Percentage loss to trigger exit</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="takeProfitPct" className="text-sm font-medium text-gray-300">
              Take Profit (%)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              id="takeProfitPct"
              placeholder="5"
              className="bg-gray-900 border-gray-700 text-white"
              {...register('takeProfitPct', {
                required: 'Take profit is required',
                min: { value: 0.1, message: 'Must be at least 0.1%' },
                max: { value: 100, message: 'Must be at most 100%' },
                valueAsNumber: true,
              })}
            />
            {errors.takeProfitPct && (
              <p className="text-xs text-red-500">{errors.takeProfitPct.message}</p>
            )}
            <p className="text-xs text-gray-500">Percentage gain to trigger exit</p>
          </div>
        </div>

        {/* Trailing Stop */}
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <div className="flex-1">
            <Label htmlFor="trailingStop" className="text-base font-semibold text-gray-100">
              Trailing Stop
            </Label>
            <p className="text-sm text-gray-400 mt-1">
              Automatically adjust stop loss as price moves in your favor
            </p>
          </div>
          <Controller
            control={control}
            name="trailingStop"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-6"
        >
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}

