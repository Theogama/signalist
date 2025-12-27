'use client';

/**
 * Deriv Token Manager Component
 * Allows users to manage Deriv API tokens independently
 * Supports: storing, viewing, validating, and deleting tokens
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  AlertCircle,
  Loader2,
  Shield,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface TokenInfo {
  accountType?: 'demo' | 'real';
  accountId?: string;
  accountBalance?: number;
  accountCurrency?: string;
  isValid?: boolean;
  lastValidatedAt?: string;
  scopes?: string[];
  expiresAt?: string;
}

export default function DerivTokenManager() {
  const [open, setOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load token info on mount and when dialog opens
  useEffect(() => {
    if (open) {
      loadTokenInfo();
    }
  }, [open]);

  const loadTokenInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/deriv/token');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setTokenInfo(data.data || null);
      } else {
        setTokenInfo(null);
      }
    } catch (error: any) {
      console.error('Error loading token info:', error);
      setTokenInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoreToken = async () => {
    if (!tokenInput.trim()) {
      toast.error('Please enter a token');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/deriv/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          accountType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to store token' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Token stored successfully');
        setTokenInput('');
        setShowToken(false);
        await loadTokenInfo();
      } else {
        toast.error(data.error || 'Failed to store token');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to store token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateToken = async () => {
    try {
      setIsValidating(true);
      const response = await fetch('/api/deriv/token/validate', {
        method: 'PUT',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to validate token' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Token validated successfully');
        await loadTokenInfo();
      } else {
        toast.error(data.error || 'Failed to validate token');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate token');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!confirm('Are you sure you want to delete your Deriv token? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch('/api/deriv/token', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete token' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Token deleted successfully');
        setTokenInfo(null);
      } else {
        toast.error(data.error || 'Failed to delete token');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete token');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined || currency === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Key className="h-4 w-4" />
          Manage Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Deriv API Token Management
          </DialogTitle>
          <DialogDescription>
            Store and manage your Deriv API token securely. Tokens are encrypted and never exposed to the frontend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Token Status */}
          {isLoading && !tokenInfo ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : tokenInfo ? (
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Current Token</CardTitle>
                  <Badge
                    variant={tokenInfo.isValid ? 'default' : 'destructive'}
                    className={tokenInfo.isValid ? 'bg-green-500/20 text-green-400 border-green-500/50' : ''}
                  >
                    {tokenInfo.isValid ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Valid
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Invalid
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Account Type</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="capitalize">
                        {tokenInfo.accountType || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Account ID</Label>
                    <p className="mt-1 text-sm text-gray-300">{tokenInfo.accountId || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Balance</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-100">
                      {formatCurrency(tokenInfo.accountBalance, tokenInfo.accountCurrency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Currency</Label>
                    <p className="mt-1 text-sm text-gray-300">{tokenInfo.accountCurrency || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">Last Validated</Label>
                    <p className="mt-1 text-sm text-gray-300">{formatDate(tokenInfo.lastValidatedAt)}</p>
                  </div>
                  {tokenInfo.scopes && tokenInfo.scopes.length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-500">Scopes</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tokenInfo.scopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleValidateToken}
                    disabled={isValidating}
                    className="flex-1"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Validate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteToken}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-700 bg-gray-800">
              <CardContent className="p-6">
                <div className="text-center py-4">
                  <Key className="h-12 w-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-400">No token stored</p>
                  <p className="text-sm text-gray-500 mt-1">Store a token to get started</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Store/Update Token Form */}
          <Card className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">
                {tokenInfo ? 'Update Token' : 'Store Token'}
              </CardTitle>
              <CardDescription>
                Enter your Deriv API token. It will be encrypted and stored securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <select
                  id="accountType"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as 'demo' | 'real')}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="demo">Demo Account</option>
                  <option value="real">Real Account</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">API Token</Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="Enter your Deriv API token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={isLoading}
                    className="bg-gray-900 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Your token will be validated and encrypted before storage
                </p>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-400">
                    <p className="font-semibold mb-1">Security Notice</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                      <li>Tokens are encrypted server-side</li>
                      <li>Never share your token with anyone</li>
                      <li>Use tokens with TRADE-ONLY permissions</li>
                      <li>Token values are never returned to the frontend</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStoreToken}
                disabled={!tokenInput.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Storing...
                  </>
                ) : tokenInfo ? (
                  'Update Token'
                ) : (
                  'Store Token'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

