'use client';

/**
 * Broker Connection Modal Component
 * Allows users to connect to Exness or Deriv brokers
 */

import { useState } from 'react';
import { useAutoTradingStore, BrokerType } from '@/lib/stores/autoTradingStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { AlertCircle, CheckCircle2, Loader2, Zap, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function BrokerConnectionModal() {
  const [open, setOpen] = useState(false);
  const [broker, setBroker] = useState<BrokerType>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [useDemo, setUseDemo] = useState(true);

  const {
    connectedBroker,
    isConnecting,
    connectionError,
    connectBroker,
    connectBrokerDemo,
    disconnectBroker,
  } = useAutoTradingStore();

  const handleConnectDemo = async (selectedBroker: BrokerType) => {
    if (!selectedBroker) return;

    try {
      setIsValidating(true);
      await connectBrokerDemo(selectedBroker);
      toast.success(`Connected to ${selectedBroker.toUpperCase()} in Demo Mode`);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect broker');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConnect = async () => {
    if (!broker) {
      toast.error('Please select a broker');
      return;
    }

    if (!useDemo && (!apiKey || !apiSecret)) {
      toast.error('Please fill in all fields or use Demo Mode');
      return;
    }

    try {
      setIsValidating(true);
      if (useDemo) {
        await connectBrokerDemo(broker);
        toast.success(`Successfully connected to ${broker.toUpperCase()} in Demo Mode`);
      } else {
        await connectBroker(broker, apiKey, apiSecret);
        toast.success(`Successfully connected to ${broker.toUpperCase()}`);
      }
      setOpen(false);
      setApiKey('');
      setApiSecret('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect broker');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = () => {
    disconnectBroker();
    toast.success('Broker disconnected');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {connectedBroker ? (
          <Button variant="outline" onClick={handleDisconnect}>
            Disconnect {connectedBroker.toUpperCase()}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleConnectDemo('exness')}>
              <Zap className="mr-2 h-4 w-4" />
              Quick Connect Exness
            </Button>
            <Button variant="outline" onClick={() => handleConnectDemo('deriv')}>
              <Zap className="mr-2 h-4 w-4" />
              Quick Connect Deriv
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Key className="mr-2 h-4 w-4" />
              Connect with API
            </Button>
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect Broker</DialogTitle>
          <DialogDescription>
            Connect to Exness or Deriv to enable auto-trading. Your API keys are stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Connect Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => handleConnectDemo('exness')}
              disabled={isValidating || isConnecting}
              className="flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Quick Connect Exness (Demo)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConnectDemo('deriv')}
              disabled={isValidating || isConnecting}
              className="flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Quick Connect Deriv (Demo)
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-900 px-2 text-gray-500">Or connect with API keys</span>
            </div>
          </div>

          {/* Broker Selection */}
          <div className="space-y-2">
            <Label htmlFor="broker">Broker</Label>
            <Select
              value={broker || ''}
              onValueChange={(value) => setBroker(value as BrokerType)}
              disabled={isValidating || isConnecting}
            >
              <SelectTrigger id="broker">
                <SelectValue placeholder="Select a broker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exness">Exness</SelectItem>
                <SelectItem value="deriv">Deriv</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Demo Mode Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="demoMode"
              checked={useDemo}
              onChange={(e) => setUseDemo(e.target.checked)}
              className="rounded border-gray-600"
            />
            <Label htmlFor="demoMode" className="cursor-pointer">
              Use Demo Mode (No API keys required)
            </Label>
          </div>

          {/* API Key (only show if not using demo) */}
          {!useDemo && (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isValidating || isConnecting}
                />
                <p className="text-xs text-gray-500">
                  Use API keys with TRADE-ONLY permissions
                </p>
              </div>

              {/* API Secret */}
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="Enter your API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  disabled={isValidating || isConnecting}
                />
                <p className="text-xs text-gray-500">
                  Never share your API secret with anyone
                </p>
              </div>
            </>
          )}

          {/* Error Display */}
          {connectionError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{connectionError}</span>
            </div>
          )}

          {/* Connected Status */}
          {connectedBroker && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400">
                Connected to {connectedBroker.toUpperCase()}
              </span>
            </div>
          )}

          {/* Connect Button */}
          <Button
            onClick={handleConnect}
            disabled={!broker || (!useDemo && (!apiKey || !apiSecret)) || isValidating || isConnecting}
            className="w-full"
          >
            {isValidating || isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : useDemo ? (
              `Connect ${broker?.toUpperCase() || ''} (Demo Mode)`
            ) : (
              'Connect'
            )}
          </Button>

          {/* Demo Mode Notice */}
          {useDemo && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">
                💡 Demo Mode: You're connecting with a virtual account. No real money will be used. Perfect for testing strategies!
              </p>
            </div>
          )}

          {/* Safety Notice (only for live mode) */}
          {!useDemo && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                ⚠️ Always use API keys with TRADE-ONLY permissions. Never use keys with withdrawal access.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



