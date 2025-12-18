'use client';

/**
 * MT5 Quick Connect Component
 * Allows users to connect to Exness MT5 account
 */

import { useState } from 'react';
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

interface MT5Connection {
  connection_id: string;
  login: string;
  server: string;
  account: {
    balance: number;
    equity: number;
    margin: number;
    free_margin: number;
    margin_level: number;
    currency: string;
    leverage: number;
  };
}

export default function MT5QuickConnect() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('Exness-MT5Trial');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connection, setConnection] = useState<MT5Connection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!login || !password || !server) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const response = await fetch('/api/mt5/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: parseInt(login),
          password,
          server,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      setConnection(data.data);
      
      // Store connection in localStorage (in production, use secure storage)
      localStorage.setItem('mt5_connection', JSON.stringify(data.data));
      
      toast.success('Successfully connected to Exness MT5');
      setOpen(false);
      
      // Clear old bot settings as requested
      try {
        await fetch('/api/mt5/settings/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: false,
          }),
        });
      } catch (err) {
        console.error('Error clearing bot settings:', err);
      }
    } catch (error: any) {
      setError(error.message || 'Connection failed');
      toast.error(error.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    try {
      const response = await fetch('/api/mt5/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: connection.connection_id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConnection(null);
        localStorage.removeItem('mt5_connection');
        toast.success('Disconnected from Exness MT5');
      } else {
        toast.error(data.error || 'Disconnect failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    }
  };

  // Load connection from localStorage on mount
  useState(() => {
    const stored = localStorage.getItem('mt5_connection');
    if (stored) {
      try {
        setConnection(JSON.parse(stored));
      } catch (err) {
        console.error('Error loading stored connection:', err);
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {connection ? (
          <Button variant="outline" onClick={handleDisconnect}>
            Disconnect MT5
          </Button>
        ) : (
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Connect Exness MT5
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to Exness MT5</DialogTitle>
          <DialogDescription>
            Enter your MT5 login credentials to connect to your Exness account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Login ID */}
          <div className="space-y-2">
            <Label htmlFor="login">MT5 Login ID</Label>
            <Input
              id="login"
              type="number"
              placeholder="Enter your MT5 login ID"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={isConnecting}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your MT5 password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConnecting}
            />
          </div>

          {/* Server */}
          <div className="space-y-2">
            <Label htmlFor="server">Server</Label>
            <Select
              value={server}
              onValueChange={setServer}
              disabled={isConnecting}
            >
              <SelectTrigger id="server">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Exness-MT5Real">Exness-MT5Real (Live)</SelectItem>
                <SelectItem value="Exness-MT5Trial">Exness-MT5Trial (Demo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Use Exness-MT5Trial for demo account, Exness-MT5Real for live trading
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Connected Status */}
          {connection && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <div className="flex-1">
                <span className="text-sm text-green-400 block">
                  Connected to {connection.server}
                </span>
                <span className="text-xs text-gray-400">
                  Balance: {connection.account.currency} {connection.account.balance.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Connect Button */}
          <Button
            onClick={handleConnect}
            disabled={!login || !password || !server || isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Key className="mr-2 h-4 w-4" />
                Connect
              </>
            )}
          </Button>

          {/* Safety Notice */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400">
              ⚠️ Make sure MetaTrader 5 terminal is installed and running on your system.
              The MT5 Python service must be running to connect.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}






