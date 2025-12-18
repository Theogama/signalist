'use client';

/**
 * Deriv Account Creator Component
 * Guides users through Deriv account creation using the Deriv API
 * Supports: Email verification, Demo accounts, Real accounts (EU/Non-EU), Wallet accounts
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Loader2, BookOpen, Mail, UserPlus, Wallet, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AccountType = 'demo' | 'real' | 'wallet';
type UserRegion = 'eu' | 'non-eu';

interface AccountCreationState {
  step: 'email' | 'verification' | 'account' | 'complete';
  email: string;
  verificationCode: string;
  accountType: AccountType;
  userRegion: UserRegion;
  accountData: any;
}

export default function DerivAccountCreator() {
  const [open, setOpen] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [state, setState] = useState<AccountCreationState>({
    step: 'email',
    email: '',
    verificationCode: '',
    accountType: 'demo',
    userRegion: 'non-eu',
    accountData: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [verificationCodeDisplay, setVerificationCodeDisplay] = useState<string | null>(null);

  const handleEmailVerification = async () => {
    if (!state.email || !isValidEmail(state.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/deriv/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verify_email: state.email,
          type: 'account_opening',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Email verification failed');
      }

      const data = await response.json();
      
      // In development, show the verification code directly
      // In production, this would be sent via email
      if (data.verify_email?.verification_code) {
        setVerificationCodeDisplay(data.verify_email.verification_code);
        toast.success(`Verification code generated! Check the code below.`);
      } else {
        toast.success(`Verification code sent to ${maskEmail(state.email)}`);
      }
      
      setState({ ...state, step: 'verification' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountCreation = async () => {
    if (!state.verificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    try {
      setIsLoading(true);
      let endpoint = '';
      let payload: any = {
        email: state.email,
        verification_code: state.verificationCode,
      };

      if (state.accountType === 'demo') {
        endpoint = '/api/deriv/create-demo-account';
        payload = {
          ...payload,
          new_account_virtual: 1,
          client_password: generateSecurePassword(),
          residence: 'US', // Default for demo
          currency: 'USD',
        };
      } else if (state.accountType === 'real') {
        if (state.userRegion === 'eu') {
          endpoint = '/api/deriv/create-real-account-eu';
          payload = {
            ...payload,
            new_account_maltainvest: 1,
            client_password: generateSecurePassword(),
            residence: 'DE', // Example EU country
            currency: 'EUR',
            // Add required EU fields (simplified for UI)
            date_of_birth: '1990-01-01',
            first_name: '',
            last_name: '',
            phone: '',
            address_line_1: '',
            address_city: '',
            address_postcode: '',
            tax_residence: 'DE',
            employment_status: 'Employed',
            annual_income: '50000-100000',
            trading_experience: '2-5 years',
            risk_tolerance: 'Medium',
            accept_risk: 1,
            accept_terms: 1,
          };
        } else {
          endpoint = '/api/deriv/create-real-account';
          payload = {
            ...payload,
            new_account_real: 1,
            client_password: generateSecurePassword(),
            residence: 'US',
            currency: 'USD',
            date_of_birth: '1990-01-01',
            first_name: '',
            last_name: '',
            phone: '',
            address_line_1: '',
            address_city: '',
            address_postcode: '',
            tax_residence: 'US',
            accept_risk: 1,
            accept_terms: 1,
          };
        }
      } else if (state.accountType === 'wallet') {
        endpoint = '/api/deriv/create-wallet-account';
        payload = {
          ...payload,
          new_account_wallet: 1,
          client_password: generateSecurePassword(),
          residence: state.userRegion === 'eu' ? 'DE' : 'US',
          currency: state.userRegion === 'eu' ? 'EUR' : 'USD',
          date_of_birth: '1990-01-01',
          first_name: '',
          last_name: '',
          phone: '',
          address_line_1: '',
          address_city: '',
          address_postcode: '',
          tax_residence: state.userRegion === 'eu' ? 'DE' : 'US',
          accept_risk: 1,
          accept_terms: 1,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Account creation failed');
      }

      const data = await response.json();
      setState({ ...state, step: 'complete', accountData: data });
      toast.success('Account created successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFlow = () => {
    setState({
      step: 'email',
      email: '',
      verificationCode: '',
      accountType: 'demo',
      userRegion: 'non-eu',
      accountData: null,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetFlow();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Create Deriv Account
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Deriv Account
            </DialogTitle>
            <DialogDescription>
              Create a new Deriv trading or wallet account using the Deriv API
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Documentation Link */}
            <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-400">
                  Need API documentation?
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDocs(true)}
                className="text-blue-400 hover:text-blue-300"
              >
                View Docs
              </Button>
            </div>

            {/* Step 1: Email Verification */}
            {state.step === 'email' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Step 1: Email Verification
                  </CardTitle>
                  <CardDescription>
                    Verify your email address to proceed with account creation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={state.email}
                      onChange={(e) => setState({ ...state, email: e.target.value })}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      A verification code will be sent to this email
                    </p>
                  </div>
                  <Button
                    onClick={handleEmailVerification}
                    disabled={isLoading || !state.email}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Verification Code
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Verification Code */}
            {state.step === 'verification' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Step 2: Enter Verification Code
                  </CardTitle>
                  <CardDescription>
                    Check your email and enter the verification code
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-400">
                      ✓ Verification code sent to {maskEmail(state.email)}
                    </p>
                  </div>
                  
                  {/* Show verification code in development mode */}
                  {verificationCodeDisplay && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-xs text-yellow-400 mb-2 font-semibold">
                        🧪 Development Mode - Verification Code:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-2xl font-mono font-bold text-yellow-300 bg-gray-900 px-4 py-2 rounded border border-yellow-500/30">
                          {verificationCodeDisplay}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setState({ ...state, verificationCode: verificationCodeDisplay });
                            toast.success('Code copied to input field');
                          }}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          Use This Code
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        In production, this code would be sent to your email address.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="verificationCode">Verification Code</Label>
                    <Input
                      id="verificationCode"
                      type="text"
                      placeholder="123456"
                      value={state.verificationCode}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/\D/g, '');
                        setState({ ...state, verificationCode: value });
                      }}
                      disabled={isLoading}
                      maxLength={6}
                      className="text-center text-2xl font-mono tracking-widest"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the 6-digit verification code
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setState({ ...state, step: 'email' })}
                      variant="outline"
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setState({ ...state, step: 'account' })}
                      disabled={isLoading || !state.verificationCode}
                      className="flex-1"
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Account Type Selection */}
            {state.step === 'account' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Step 3: Select Account Type
                  </CardTitle>
                  <CardDescription>
                    Choose the type of account you want to create
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs
                    value={state.accountType}
                    onValueChange={(value) =>
                      setState({ ...state, accountType: value as AccountType })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="demo">Demo</TabsTrigger>
                      <TabsTrigger value="real">Real</TabsTrigger>
                      <TabsTrigger value="wallet">Wallet</TabsTrigger>
                    </TabsList>

                    <TabsContent value="demo" className="space-y-4">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <h4 className="font-semibold mb-2">Demo Trading Account</h4>
                        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                          <li>USD 10,000 virtual balance</li>
                          <li>No real money required</li>
                          <li>Perfect for testing strategies</li>
                          <li>No KYC verification needed</li>
                        </ul>
                      </div>
                    </TabsContent>

                    <TabsContent value="real" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Are you an EU resident?</Label>
                        <Select
                          value={state.userRegion}
                          onValueChange={(value) =>
                            setState({ ...state, userRegion: value as UserRegion })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eu">Yes, EU Resident</SelectItem>
                            <SelectItem value="non-eu">No, Non-EU Resident</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {state.userRegion === 'eu' ? (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <h4 className="font-semibold mb-2">EU Real Trading Account</h4>
                          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                            <li>Malta Invest regulation (MiFID II)</li>
                            <li>Full compliance checks required</li>
                            <li>Financial assessment questionnaire</li>
                            <li>Identity verification required</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <h4 className="font-semibold mb-2">Non-EU Real Trading Account</h4>
                          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                            <li>Simplified compliance requirements</li>
                            <li>Identity verification required</li>
                            <li>Basic financial information</li>
                          </ul>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="wallet" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Are you an EU resident?</Label>
                        <Select
                          value={state.userRegion}
                          onValueChange={(value) =>
                            setState({ ...state, userRegion: value as UserRegion })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eu">Yes, EU Resident</SelectItem>
                            <SelectItem value="non-eu">No, Non-EU Resident</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <h4 className="font-semibold mb-2">Wallet Account</h4>
                        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                          <li>Separate from trading accounts</li>
                          <li>Manage deposits and withdrawals</li>
                          <li>Can be linked to trading accounts</li>
                          <li>Compliance requirements based on region</li>
                        </ul>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setState({ ...state, step: 'verification' })}
                      variant="outline"
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleAccountCreation}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create Account
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Complete */}
            {state.step === 'complete' && state.accountData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    Account Created Successfully!
                  </CardTitle>
                  <CardDescription>
                    Your Deriv account has been created. Save these credentials securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500">Client ID</Label>
                      <p className="text-sm font-mono">{state.accountData.client_id}</p>
                    </div>
                    {state.accountData.oauth_token && (
                      <div>
                        <Label className="text-xs text-gray-500">OAuth Token</Label>
                        <p className="text-sm font-mono break-all">
                          {state.accountData.oauth_token.substring(0, 50)}...
                        </p>
                      </div>
                    )}
                    {state.accountData.balance !== undefined && (
                      <div>
                        <Label className="text-xs text-gray-500">Balance</Label>
                        <p className="text-sm font-semibold">
                          {state.accountData.currency} {state.accountData.balance.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-400 flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5" />
                      <span>
                        Use these credentials to connect your Deriv account in the broker connection modal.
                        The OAuth token can be used as your API key.
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setOpen(false);
                      resetFlow();
                    }}
                    className="w-full"
                  >
                    Done
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Documentation Viewer */}
      <Dialog open={showDocs} onOpenChange={setShowDocs}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deriv API Documentation</DialogTitle>
            <DialogDescription>
              Complete API reference for Deriv account and wallet creation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-400 mb-2">
                📚 Complete API documentation is available in the project root:
              </p>
              <code className="text-xs bg-gray-800 px-2 py-1 rounded block">
                DERIV_API_DOCUMENTATION.md
              </code>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Email Verification</h3>
                <p className="text-gray-400 mb-2">Endpoint: <code className="bg-gray-800 px-2 py-1 rounded">verify_email</code></p>
                <p className="text-gray-400 text-xs">
                  Verifies email address by sending a verification code. Required before creating any account.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Demo Trading Account</h3>
                <p className="text-gray-400 mb-2">Endpoint: <code className="bg-gray-800 px-2 py-1 rounded">new_account_virtual</code></p>
                <p className="text-gray-400 text-xs">
                  Creates a virtual account with USD 10,000 virtual balance. No KYC required.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Real Trading Account</h3>
                <p className="text-gray-400 mb-2">
                  EU: <code className="bg-gray-800 px-2 py-1 rounded">new_account_maltainvest</code> | 
                  Non-EU: <code className="bg-gray-800 px-2 py-1 rounded">new_account_real</code>
                </p>
                <p className="text-gray-400 text-xs">
                  Creates a real trading account. EU accounts require full compliance checks (MiFID II).
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Wallet Account</h3>
                <p className="text-gray-400 mb-2">Endpoint: <code className="bg-gray-800 px-2 py-1 rounded">new_account_wallet</code></p>
                <p className="text-gray-400 text-xs">
                  Creates a wallet account for deposits and withdrawals. Compliance varies by region.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                ⚠️ Note: These API endpoints use WebSocket connections. The full documentation includes 
                complete request/response examples, parameter tables, and error handling.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper functions
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

function generateSecurePassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

