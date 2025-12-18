/**
 * Deriv Callback Page
 * Client-side handler for Deriv redirect with account/token parameters
 * This page processes the redirect and establishes the connection
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DerivCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Deriv connection...');
  
  const { setBalance, addLog, loadInstruments } = useAutoTradingStore();

  useEffect(() => {
    const processDerivRedirect = async () => {
      try {
        // Extract account and token information from URL parameters
        const accounts: Array<{ loginid: string; token: string; currency: string }> = [];
        
        let index = 1;
        while (true) {
          const acct = searchParams.get(`acct${index}`);
          const token = searchParams.get(`token${index}`);
          const cur = searchParams.get(`cur${index}`);

          if (!acct || !token) {
            break;
          }

          accounts.push({
            loginid: acct,
            token: token,
            currency: cur || 'USD',
          });

          index++;
        }

        if (accounts.length === 0) {
          throw new Error('No accounts found in redirect parameters');
        }

        setMessage(`Found ${accounts.length} account(s). Connecting...`);

        // Send account/token info to backend to establish connection
        const response = await fetch('/api/auto-trading/deriv/redirect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to connect' }));
          throw new Error(errorData.error || 'Failed to establish connection');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Connection failed');
        }

        setMessage('Verifying connection...');

        // Verify connection by calling sync endpoint
        const syncResponse = await fetch('/api/auto-trading/deriv/sync-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!syncResponse.ok) {
          console.warn('Sync connection failed, but continuing with stored data');
        }

        // Update store with connection info - ensure all fields are set
        const currentState = useAutoTradingStore.getState();
        
        // Set all required fields for connection
        useAutoTradingStore.setState({
          connectedBroker: 'deriv' as const,
          brokerApiKey: null, // OAuth tokens stored server-side
          brokerApiSecret: null,
          mt5ConnectionId: null,
          mt5Login: null,
          mt5Server: null,
          isConnecting: false,
          connectionError: null,
          balance: data.data.balance || currentState.balance || 10000,
          equity: data.data.equity || currentState.equity || 10000,
          margin: data.data.margin || currentState.margin || 0,
        });

        // Also use setBalance to ensure it's properly persisted
        setBalance(
          data.data.balance || 10000,
          data.data.equity || 10000,
          data.data.margin || 0
        );

        // Force store persistence by accessing persisted state
        // The persist middleware should handle this, but we ensure it's set
        console.log('[Deriv Callback] Store updated:', {
          connectedBroker: 'deriv',
          balance: data.data.balance,
          equity: data.data.equity,
          margin: data.data.margin,
        });

        setMessage('Loading instruments...');

        // Load instruments
        try {
          await loadInstruments('deriv');
        } catch (error) {
          console.warn('Failed to load instruments:', error);
          // Continue anyway
        }

        // Verify connection one more time
        const verifyResponse = await fetch('/api/auto-trading/account?broker=deriv');
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          if (verifyData.success && verifyData.data) {
            setBalance(
              verifyData.data.balance || data.data.balance || 10000,
              verifyData.data.equity || data.data.equity || 10000,
              verifyData.data.margin || data.data.margin || 0
            );
          }
        }

        setStatus('success');
        setMessage(`Successfully connected to Deriv! ${accounts.length} account(s) available.`);

        addLog({
          level: 'success',
          message: `Deriv account connected successfully (${accounts[0].loginid})`,
        });

        toast.success('Deriv Account Connected', {
          description: `Successfully connected ${accounts.length} account(s)`,
          duration: 5000,
        });

        // Redirect to autotrade dashboard after 2 seconds with connection success param
        setTimeout(() => {
          router.replace('/autotrade?deriv_connected=true&account_type=' + (accounts[0].loginid?.startsWith('VR') || accounts[0].loginid?.startsWith('CR') ? 'demo' : 'real'));
        }, 2000);

      } catch (error: any) {
        console.error('Error processing Deriv redirect:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect Deriv account');
        
        toast.error('Connection Failed', {
          description: error.message || 'Please try again',
        });

        // Redirect to autotrade page after 3 seconds
        setTimeout(() => {
          router.replace('/autotrade?error=deriv_connection_failed');
        }, 3000);
      }
    };

    processDerivRedirect();
  }, [searchParams, router, setBalance, addLog, loadInstruments]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />}
            {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            Deriv Connection
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'processing' && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-sm text-gray-400 text-center">Please wait...</p>
            </div>
          )}
          {status === 'success' && (
            <div className="text-center space-y-2">
              <p className="text-green-400">Redirecting to dashboard...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center space-y-2">
              <p className="text-red-400">Redirecting to try again...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

