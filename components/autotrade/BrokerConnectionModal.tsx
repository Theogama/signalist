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
import { AlertCircle, CheckCircle2, Loader2, Zap, Key, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import DerivAccountCreator from './DerivAccountCreator';

export default function BrokerConnectionModal() {
  const [open, setOpen] = useState(false);
  const [broker, setBroker] = useState<BrokerType>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  // MT5 fields for Exness
  const [mt5Login, setMt5Login] = useState('');
  const [mt5Password, setMt5Password] = useState('');
  const [mt5Server, setMt5Server] = useState<'Exness-MT5Real' | 'Exness-MT5Trial'>('Exness-MT5Trial');
  const [isValidating, setIsValidating] = useState(false);
  const [useDemo, setUseDemo] = useState(true);

  const {
    connectedBroker,
    isConnecting,
    connectionError,
    connectBroker,
    connectBrokerDemo,
    disconnectBroker,
    setBalance,
  } = useAutoTradingStore();

  const handleQuickConnect = async (selectedBroker: BrokerType, connectionType: 'oauth2' | 'quick_connect' = 'quick_connect') => {
    if (!selectedBroker) return;

    // Check if already connected to a different broker
    if (connectedBroker && connectedBroker !== selectedBroker) {
      toast.error(`Please disconnect from ${connectedBroker.toUpperCase()} first before connecting to ${selectedBroker.toUpperCase()}`);
      return;
    }

    try {
      setIsValidating(true);
      
      // Use quick connect API endpoint
      const response = await fetch('/api/auto-trading/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: selectedBroker,
          connectionType: selectedBroker === 'exness' ? 'oauth2' : 'quick_connect',
          credentials: connectionType === 'oauth2' ? {} : {}, // OAuth2 flow would have code here
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Quick connect failed');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Update store with account data
        const { account } = data.data;
        await connectBrokerDemo(selectedBroker);
        
        // Update balance if provided
        if (account?.balance !== undefined) {
          setBalance(
            account.balance || 10000,
            account.equity || 10000,
            account.margin || 0
          );
        }
        
        toast.success(`Connected to ${selectedBroker.toUpperCase()} via Quick Connect`);
        setOpen(false);
      } else {
        throw new Error('Quick connect failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to quick connect broker');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConnectDemo = async (selectedBroker: BrokerType) => {
    // Check if already connected to a different broker
    if (connectedBroker && connectedBroker !== selectedBroker) {
      toast.error(`Please disconnect from ${connectedBroker.toUpperCase()} first before connecting to ${selectedBroker?.toUpperCase()}`);
      return;
    }
    
    // Exness does not support demo mode without credentials
    if (selectedBroker === 'exness') {
      toast.error('Exness requires MT5 credentials. Please enter your login, password, and server.');
      setBroker('exness');
      setUseDemo(false);
      return;
    }
    
    // Use quick connect for demo mode (Deriv only)
    await handleQuickConnect(selectedBroker, 'quick_connect');
  };

  const handleConnect = async () => {
    // Check if already connected to a different broker
    if (connectedBroker && connectedBroker !== broker) {
      toast.error(`Please disconnect from ${connectedBroker.toUpperCase()} first before connecting to ${broker?.toUpperCase()}`);
      return;
    }

    if (!broker) {
      toast.error('Please select a broker');
      return;
    }

    // Validation based on broker type
    if (broker === 'exness') {
      // Exness always requires MT5 credentials (no demo mode)
      if (!mt5Login || !mt5Password || !mt5Server) {
        toast.error('Exness requires MT5 credentials. Please fill in all MT5 fields.');
        return;
      }
    } else if (broker === 'deriv') {
      if (!useDemo && (!apiKey || !apiSecret)) {
        toast.error('Please fill in all fields or use Demo Mode');
        return;
      }
    }

    try {
      setIsValidating(true);
      if (broker === 'exness') {
        // Exness always uses MT5 connection (no demo mode)
        await connectBroker(broker, undefined, undefined, mt5Login, mt5Password, mt5Server);
        toast.success(`Successfully connected to ${broker.toUpperCase()}`);
      } else if (useDemo) {
        // Deriv demo mode
        await connectBrokerDemo(broker);
        toast.success(`Successfully connected to ${broker.toUpperCase()} in Demo Mode`);
      } else {
        // Deriv live mode with API keys
        await connectBroker(broker, apiKey, apiSecret);
        toast.success(`Successfully connected to ${broker.toUpperCase()}`);
      }
      setOpen(false);
      setApiKey('');
      setApiSecret('');
      setMt5Login('');
      setMt5Password('');
      setMt5Server('Exness-MT5Trial');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect broker');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBroker();
      toast.success('Broker disconnected successfully');
      setOpen(false);
      // Reset form fields
      setBroker(null);
      setApiKey('');
      setApiSecret('');
      setMt5Login('');
      setMt5Password('');
      setMt5Server('Exness-MT5Trial');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect broker');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {connectedBroker ? (
          <Button 
            variant="outline" 
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className="text-sm sm:text-base"
          >
            <span className="hidden sm:inline">Manage {connectedBroker.toUpperCase()} Connection</span>
            <span className="sm:hidden">Manage</span>
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => handleQuickConnect('exness', 'oauth2')}
              className="flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <Zap className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Quick Connect Exness</span>
              <span className="sm:hidden">Exness</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleQuickConnect('deriv', 'quick_connect')}
              className="flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <Zap className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Quick Connect Deriv</span>
              <span className="sm:hidden">Deriv</span>
            </Button>
            <Button 
              onClick={() => setOpen(true)}
              className="flex-1 sm:flex-initial text-sm sm:text-base bg-yellow-500 hover:bg-yellow-600 text-gray-900"
            >
              <Key className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Connect with API</span>
              <span className="sm:hidden">API</span>
            </Button>
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Connect Broker</DialogTitle>
          <DialogDescription className="text-sm">
            Connect to Exness or Deriv to enable auto-trading. Your credentials are stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Broker Toggle Switch - Mobile Responsive */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Broker</Label>
            
            {/* Warning if trying to switch brokers */}
            {connectedBroker && broker && connectedBroker !== broker && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs sm:text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Disconnect from {connectedBroker.toUpperCase()} first to connect to {broker.toUpperCase()}</span>
                </p>
              </div>
            )}
            
            {/* Desktop: Toggle Switch */}
            <div className="hidden sm:flex items-center justify-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Button
                variant={broker === 'exness' ? 'default' : 'outline'}
                onClick={() => {
                  setBroker('exness');
                  setApiKey('');
                  setApiSecret('');
                  setMt5Login('');
                  setMt5Password('');
                  setUseDemo(false); // Exness doesn't support demo mode
                }}
                disabled={isValidating || isConnecting}
                className={`flex-1 ${
                  broker === 'exness' 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' 
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                Exness
              </Button>
              
              <div className="flex items-center gap-2 px-2">
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <ArrowLeft className="h-4 w-4 text-gray-500" />
              </div>
              
              <Button
                variant={broker === 'deriv' ? 'default' : 'outline'}
                onClick={() => {
                  setBroker('deriv');
                  setApiKey('');
                  setApiSecret('');
                  setMt5Login('');
                  setMt5Password('');
                  setUseDemo(true); // Deriv supports demo mode by default
                }}
                disabled={isValidating || isConnecting}
                className={`flex-1 ${
                  broker === 'deriv' 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' 
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                Deriv
              </Button>
            </div>

            {/* Mobile: Select Dropdown with Back Button */}
            <div className="sm:hidden space-y-2">
              <div className="flex items-center gap-2">
                {broker && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBroker(null);
                      setApiKey('');
                      setApiSecret('');
                      setMt5Login('');
                      setMt5Password('');
                    }}
                    disabled={isValidating || isConnecting}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <Select
                  value={broker || ''}
                  onValueChange={(value) => {
                    const selectedBroker = value as BrokerType;
                    setBroker(selectedBroker);
                    setApiKey('');
                    setApiSecret('');
                    setMt5Login('');
                    setMt5Password('');
                    // Exness doesn't support demo mode, Deriv does
                    setUseDemo(selectedBroker === 'deriv');
                  }}
                  disabled={isValidating || isConnecting}
                >
                  <SelectTrigger className="flex-1 bg-gray-800">
                    <SelectValue placeholder="Select a broker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exness">Exness</SelectItem>
                    <SelectItem value="deriv">Deriv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Quick Connect Buttons - Mobile Responsive */}
          {/* Note: Exness does not support demo mode - requires MT5 credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast.error('Exness requires MT5 credentials. Please use the form below to connect.');
                setBroker('exness');
                setUseDemo(false);
              }}
              disabled={isValidating || isConnecting}
              className="flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Exness (Requires MT5)</span>
              <span className="sm:hidden">Exness</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConnectDemo('deriv')}
              disabled={isValidating || isConnecting}
              className="flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Connect Deriv (Demo)</span>
              <span className="sm:hidden">Deriv Demo</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-900 px-2 text-gray-500">Or connect with credentials</span>
            </div>
          </div>

          {/* Demo Mode Toggle - Mobile Responsive */}
          {/* Note: Exness does not support demo mode */}
          {broker !== 'exness' && (
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex-1">
                <Label htmlFor="demoMode" className="cursor-pointer text-sm sm:text-base">
                  Demo Mode
                </Label>
                <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                  No credentials required
                </p>
              </div>
              <Switch
                id="demoMode"
                checked={useDemo}
                onCheckedChange={setUseDemo}
                disabled={isValidating || isConnecting}
              />
            </div>
          )}
          
          {broker === 'exness' && (
            <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-400">
                ℹ️ <span className="font-semibold">Exness Connection:</span> MT5 credentials are required. Demo mode is not available for Exness.
              </p>
            </div>
          )}

          {/* Exness MT5 Fields (always required for Exness) */}
          {broker === 'exness' && (
            <div className="space-y-4 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm sm:text-base font-semibold text-gray-200">Exness MT5 Credentials</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mt5Login" className="text-sm">MT5 Login ID</Label>
                <Input
                  id="mt5Login"
                  type="text"
                  placeholder="Enter your MT5 Login ID"
                  value={mt5Login}
                  onChange={(e) => setMt5Login(e.target.value)}
                  disabled={isValidating || isConnecting}
                  className="bg-gray-900 text-sm sm:text-base"
                />
                <p className="text-xs text-gray-500">
                  Your MT5 account login number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mt5Password" className="text-sm">MT5 Password</Label>
                <Input
                  id="mt5Password"
                  type="password"
                  placeholder="Enter your MT5 password"
                  value={mt5Password}
                  onChange={(e) => setMt5Password(e.target.value)}
                  disabled={isValidating || isConnecting}
                  className="bg-gray-900 text-sm sm:text-base"
                />
                <p className="text-xs text-gray-500">
                  Your MT5 account password
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mt5Server" className="text-sm">MT5 Server</Label>
                <Select
                  value={mt5Server}
                  onValueChange={(value) => setMt5Server(value as 'Exness-MT5Real' | 'Exness-MT5Trial')}
                  disabled={isValidating || isConnecting}
                >
                  <SelectTrigger id="mt5Server" className="bg-gray-900 text-sm sm:text-base">
                    <SelectValue placeholder="Select server" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Exness-MT5Trial">Exness-MT5Trial (Demo)</SelectItem>
                    <SelectItem value="Exness-MT5Real">Exness-MT5Real (Live)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Select your MT5 server type
                </p>
              </div>
            </div>
          )}

          {/* Deriv API Key Fields (only show if not using demo and Deriv is selected) */}
          {broker === 'deriv' && (
            <div className="space-y-4">
              {/* Account Creator Feature */}
              <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-200 mb-1">
                      Don't have a Deriv account?
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Create a new Deriv account directly from here. Supports demo accounts, real accounts (EU/Non-EU), and wallet accounts.
                    </p>
                    <DerivAccountCreator />
                  </div>
                </div>
              </div>

              {!useDemo && (
                <div className="space-y-4 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-200">Deriv API Credentials</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-sm">API Key / OAuth Token</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your API key or OAuth token"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={isValidating || isConnecting}
                      className="bg-gray-900 text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-500">
                      Use API keys with TRADE-ONLY permissions or OAuth token from account creation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiSecret" className="text-sm">API Secret</Label>
                    <Input
                      id="apiSecret"
                      type="password"
                      placeholder="Enter your API secret (if using API keys)"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      disabled={isValidating || isConnecting}
                      className="bg-gray-900 text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-500">
                      Required only if using API keys. OAuth tokens don't need a secret.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {connectionError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{connectionError}</span>
            </div>
          )}

          {/* Connected Status with Disconnect Button */}
          {connectedBroker && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400 flex-1">
                  Connected to {connectedBroker.toUpperCase()}
                </span>
              </div>
              
              {/* Disconnect Button - Prominent */}
              <Button
                onClick={handleDisconnect}
                disabled={isValidating || isConnecting}
                variant="destructive"
                className="w-full text-sm sm:text-base py-2 sm:py-3"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Disconnect from {connectedBroker.toUpperCase()}</span>
                <span className="sm:hidden">Disconnect</span>
              </Button>
              
              {/* Warning Message */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs sm:text-sm text-yellow-400">
                  ⚠️ Disconnect before connecting to a different broker
                </p>
              </div>
            </div>
          )}

          {/* Connect Button - Mobile Responsive */}
          <Button
            onClick={handleConnect}
            disabled={
              !broker || 
              (connectedBroker && connectedBroker !== broker) ||
              (broker === 'exness' && (!mt5Login || !mt5Password || !mt5Server)) ||
              (broker === 'deriv' && !useDemo && (!apiKey || !apiSecret)) ||
              isValidating || 
              isConnecting
            }
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold text-sm sm:text-base py-2 sm:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating || isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
                <span className="sm:hidden">Connecting</span>
              </>
            ) : useDemo ? (
              <>
                <span className="hidden sm:inline">Connect {broker?.toUpperCase() || ''} (Demo Mode)</span>
                <span className="sm:hidden">Connect {broker?.toUpperCase() || 'Broker'} Demo</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Connect to {broker?.toUpperCase() || ''}</span>
                <span className="sm:hidden">Connect</span>
              </>
            )}
          </Button>

          {/* Demo Mode Notice - Mobile Responsive */}
          {useDemo && (
            <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-400 leading-relaxed">
                💡 <span className="font-semibold">Demo Mode:</span> You're connecting with a virtual account. No real money will be used. Perfect for testing strategies!
              </p>
            </div>
          )}

          {/* Safety Notice (only for live mode) - Mobile Responsive */}
          {!useDemo && (
            <div className="p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs sm:text-sm text-yellow-400 leading-relaxed">
                ⚠️ <span className="font-semibold">Security:</span> Always use API keys with TRADE-ONLY permissions. Never use keys with withdrawal access.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



