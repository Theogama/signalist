'use client';

/**
 * Deriv Trade Execution Component
 * Allows users to manually place trades on Deriv
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

interface TradeForm {
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  duration: number;
  duration_unit: 't' | 's';
  contract_type?: 'CALL' | 'PUT' | 'RISE' | 'FALL';
  stopLoss?: number;
  takeProfit?: number;
}

const DERIV_SYMBOLS = [
  'BOOM500',
  'BOOM1000',
  'CRASH500',
  'CRASH1000',
  'RISE',
  'FALL',
];

export default function DerivTradeExecution() {
  const { connectedBroker } = useAutoTradingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<TradeForm>({
    symbol: 'BOOM500',
    side: 'BUY',
    amount: 10,
    duration: 5,
    duration_unit: 't',
    contract_type: undefined,
    stopLoss: undefined,
    takeProfit: undefined,
  });

  // Check if Deriv is connected
  if (connectedBroker !== 'deriv') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.symbol || !form.amount || form.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      // Determine contract type based on side if not specified
      const contractType = form.contract_type || (form.side === 'BUY' ? 'CALL' : 'PUT');

      const response = await fetch('/api/deriv/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: form.symbol,
          side: form.side,
          amount: form.amount,
          duration: form.duration,
          duration_unit: form.duration_unit,
          contract_type: contractType,
          stopLoss: form.stopLoss,
          takeProfit: form.takeProfit,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to place trade' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(`Trade placed successfully! Contract ID: ${data.data.contractId}`);
        // Reset form
        setForm({
          symbol: 'BOOM500',
          side: 'BUY',
          amount: 10,
          duration: 5,
          duration_unit: 't',
          contract_type: undefined,
          stopLoss: undefined,
          takeProfit: undefined,
        });
      } else {
        toast.error(data.error || 'Failed to place trade');
      }
    } catch (error: any) {
      console.error('Error placing trade:', error);
      toast.error(error.message || 'Failed to place trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setForm({ ...form, amount: numValue });
    } else if (value === '') {
      setForm({ ...form, amount: 0 });
    }
  };

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Manual Trade Execution
        </CardTitle>
        <CardDescription>Place manual trades on Deriv</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol Selection */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Select
              value={form.symbol}
              onValueChange={(value) => setForm({ ...form, symbol: value })}
            >
              <SelectTrigger id="symbol" className="bg-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DERIV_SYMBOLS.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Side Selection */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.side === 'BUY' ? 'default' : 'outline'}
                onClick={() => setForm({ ...form, side: 'BUY', contract_type: 'CALL' })}
                className={form.side === 'BUY' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                BUY (CALL)
              </Button>
              <Button
                type="button"
                variant={form.side === 'SELL' ? 'default' : 'outline'}
                onClick={() => setForm({ ...form, side: 'SELL', contract_type: 'PUT' })}
                className={form.side === 'SELL' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <TrendingDown className="h-4 w-4 mr-2" />
                SELL (PUT)
              </Button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Stake Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={form.amount || ''}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="bg-gray-900 pl-10"
                placeholder="10.00"
                required
              />
            </div>
          </div>

          {/* Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={form.duration}
                onChange={(e) =>
                  setForm({ ...form, duration: parseInt(e.target.value) || 1 })
                }
                className="bg-gray-900"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_unit">Unit</Label>
              <Select
                value={form.duration_unit}
                onValueChange={(value: 't' | 's') =>
                  setForm({ ...form, duration_unit: value })
                }
              >
                <SelectTrigger id="duration_unit" className="bg-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t">Ticks</SelectItem>
                  <SelectItem value="s">Seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional: Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (Optional)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                value={form.stopLoss || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stopLoss: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="bg-gray-900"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="takeProfit">Take Profit (Optional)</Label>
              <Input
                id="takeProfit"
                type="number"
                step="0.01"
                value={form.takeProfit || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    takeProfit: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="bg-gray-900"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Trade Summary */}
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Trade Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol:</span>
                <span className="text-gray-100 font-semibold">{form.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Direction:</span>
                <Badge
                  variant={form.side === 'BUY' ? 'default' : 'destructive'}
                  className={form.side === 'BUY' ? 'bg-green-600' : 'bg-red-600'}
                >
                  {form.side}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Stake:</span>
                <span className="text-gray-100 font-semibold">${form.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration:</span>
                <span className="text-gray-100 font-semibold">
                  {form.duration} {form.duration_unit === 't' ? 'tick(s)' : 'second(s)'}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || !form.symbol || !form.amount || form.amount <= 0}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Placing Trade...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Place Trade
              </>
            )}
          </Button>

          {/* Warning */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
              <p className="text-xs text-yellow-400">
                <strong>Warning:</strong> Manual trades are executed immediately with real money.
                Ensure you understand the risks before placing a trade.
              </p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

