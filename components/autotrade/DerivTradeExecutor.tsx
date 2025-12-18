'use client';

/**
 * Deriv Trade Executor Component
 * Allows manual trade execution via Deriv API
 * Displays trade results and syncs to Signalist stats
 */

import { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { TrendingUp, TrendingDown, Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function DerivTradeExecutor() {
  const { connectedBroker, brokerApiKey } = useAutoTradingStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<any>(null);
  
  const [tradeParams, setTradeParams] = useState({
    symbol: 'BOOM500',
    side: 'BUY' as 'BUY' | 'SELL',
    amount: 10,
    duration: 5,
    duration_unit: 't' as 't' | 's',
    contract_type: 'CALL' as 'CALL' | 'PUT',
  });

  const handleExecuteTrade = async () => {
    if (!connectedBroker || connectedBroker !== 'deriv') {
      toast.error('Please connect to Deriv broker first');
      return;
    }

    if (!brokerApiKey) {
      toast.error('API key required. Please connect with your Deriv credentials.');
      return;
    }

    try {
      setIsExecuting(true);
      setTradeResult(null);

      const response = await fetch('/api/deriv/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: tradeParams.symbol,
          side: tradeParams.side,
          amount: tradeParams.amount,
          duration: tradeParams.duration,
          duration_unit: tradeParams.duration_unit,
          contract_type: tradeParams.contract_type,
          apiKey: brokerApiKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Trade execution failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setTradeResult(data.data);
        toast.success(`Trade executed successfully! Contract ID: ${data.data.contractId}`);
        
        // Refresh positions to show new trade
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.error || 'Trade execution failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute trade');
      setTradeResult({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  if (connectedBroker !== 'deriv') {
    return (
      <Card className="border-gray-700">
        <CardHeader>
          <CardTitle>Deriv Trade Executor</CardTitle>
          <CardDescription>Connect to Deriv to execute trades</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">
            Please connect to Deriv broker to use this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Deriv Trade Executor
        </CardTitle>
        <CardDescription>
          Execute trades via Deriv API - Results sync to Signalist stats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Symbol</Label>
            <Select
              value={tradeParams.symbol}
              onValueChange={(value) => setTradeParams({ ...tradeParams, symbol: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOOM500">BOOM500</SelectItem>
                <SelectItem value="BOOM1000">BOOM1000</SelectItem>
                <SelectItem value="CRASH500">CRASH500</SelectItem>
                <SelectItem value="CRASH1000">CRASH1000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Side</Label>
            <Select
              value={tradeParams.side}
              onValueChange={(value) => {
                setTradeParams({
                  ...tradeParams,
                  side: value as 'BUY' | 'SELL',
                  contract_type: value === 'BUY' ? 'CALL' : 'PUT',
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    BUY (CALL)
                  </div>
                </SelectItem>
                <SelectItem value="SELL">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    SELL (PUT)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount (Stake)</Label>
            <Input
              type="number"
              value={tradeParams.amount}
              onChange={(e) => setTradeParams({ ...tradeParams, amount: parseFloat(e.target.value) || 0 })}
              min={1}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={tradeParams.duration}
                onChange={(e) => setTradeParams({ ...tradeParams, duration: parseInt(e.target.value) || 5 })}
                min={1}
                className="flex-1"
              />
              <Select
                value={tradeParams.duration_unit}
                onValueChange={(value) => setTradeParams({ ...tradeParams, duration_unit: value as 't' | 's' })}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t">Ticks</SelectItem>
                  <SelectItem value="s">Seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={handleExecuteTrade}
          disabled={isExecuting || !brokerApiKey}
          className="w-full"
          size="lg"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing Trade...
            </>
          ) : (
            <>
              <Activity className="mr-2 h-4 w-4" />
              Execute Trade via Deriv API
            </>
          )}
        </Button>

        {tradeResult && (
          <div className={`p-4 rounded-lg border ${
            tradeResult.error
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-green-500/10 border-green-500/20'
          }`}>
            {tradeResult.error ? (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Trade Failed</div>
                  <div className="text-sm">{tradeResult.error}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <div className="font-semibold">Trade Executed Successfully</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Contract ID:</span>
                    <div className="font-mono text-gray-200">{tradeResult.contractId}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Entry Price:</span>
                    <div className="font-semibold text-gray-200">${tradeResult.entryPrice?.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Symbol:</span>
                    <div className="font-semibold text-gray-200">{tradeResult.symbol}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Side:</span>
                    <Badge variant="outline" className={
                      tradeResult.side === 'BUY' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'
                    }>
                      {tradeResult.side}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  ✓ Trade saved to database and will appear in Signalist stats
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            💡 Trades executed here are saved to the database and automatically displayed in:
            Live Stats Cards, P/L Tracker, and Trade History.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

