/**
 * Deriv Account Synchronization Service
 * Handles fetching and syncing Deriv account data (Demo and Real)
 */

import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';

const DERIV_API_URL = process.env.DERIV_API_URL || 'https://api.deriv.com';

export interface DerivAccount {
  loginid: string;
  account_type: 'demo' | 'real';
  currency: string;
  balance: number;
  email?: string;
  country?: string;
  [key: string]: any;
}

export interface DerivAccountData {
  accounts: DerivAccount[];
  demoAccounts: DerivAccount[];
  realAccounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  accountType: 'demo' | 'real';
}

export class DerivAccountSyncService {
  /**
   * Fetch all Deriv accounts (demo and real) for a user
   */
  static async fetchAccounts(accessToken: string): Promise<DerivAccountData> {
    try {
      // Fetch account list
      const accountsResponse = await fetch(`${DERIV_API_URL}/account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        throw new Error(`Failed to fetch accounts: ${accountsResponse.status} ${errorText}`);
      }

      const accountsData = await accountsResponse.json();
      
      // Process account list
      const accounts: DerivAccount[] = [];
      
      if (accountsData.account_list && Array.isArray(accountsData.account_list)) {
        for (const account of accountsData.account_list) {
          try {
            // Fetch detailed account information
            const accountDetailsResponse = await fetch(`${DERIV_API_URL}/account/${account.loginid}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (accountDetailsResponse.ok) {
              const details = await accountDetailsResponse.json();
              
              // Determine account type
              const accountType = this.determineAccountType(account.loginid, details);
              
              accounts.push({
                loginid: account.loginid,
                account_type: accountType,
                currency: details.currency || 'USD',
                balance: details.balance || 0,
                email: details.email,
                country: details.country,
                name: details.name,
                ...details,
              });
            }
          } catch (e) {
            console.warn(`Failed to fetch details for account ${account.loginid}:`, e);
            // Add basic account info even if details fail
            accounts.push({
              loginid: account.loginid,
              account_type: this.determineAccountType(account.loginid),
              currency: 'USD',
              balance: 0,
            });
          }
        }
      }

      // Separate demo and real accounts
      const demoAccounts = accounts.filter(acc => acc.account_type === 'demo');
      const realAccounts = accounts.filter(acc => acc.account_type === 'real');

      // Determine active account (prefer real if available, otherwise demo)
      let activeAccount: DerivAccount | null = null;
      let accountType: 'demo' | 'real' = 'demo';
      
      if (realAccounts.length > 0) {
        activeAccount = realAccounts[0];
        accountType = 'real';
      } else if (demoAccounts.length > 0) {
        activeAccount = demoAccounts[0];
        accountType = 'demo';
      }

      return {
        accounts,
        demoAccounts,
        realAccounts,
        activeAccount,
        accountType,
      };
    } catch (error: any) {
      console.error('Error fetching Deriv accounts:', error);
      throw error;
    }
  }

  /**
   * Determine account type based on login ID and account details
   */
  private static determineAccountType(loginid: string, details?: any): 'demo' | 'real' {
    // Deriv demo accounts typically start with 'VR' (Virtual)
    if (loginid?.startsWith('VR') || loginid?.startsWith('CR')) {
      return 'demo';
    }
    
    // Check account type from details
    if (details?.account_type) {
      return details.account_type === 'demo' ? 'demo' : 'real';
    }
    
    // Default to real for production accounts
    return 'real';
  }

  /**
   * Fetch account balance for a specific account
   */
  static async fetchAccountBalance(
    accessToken: string,
    loginid: string
  ): Promise<{
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    currency: string;
  }> {
    try {
      const response = await fetch(`${DERIV_API_URL}/account/${loginid}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        balance: data.balance || 0,
        equity: data.balance || 0, // Deriv uses balance as equity
        margin: data.margin || 0,
        freeMargin: (data.balance || 0) - (data.margin || 0),
        currency: data.currency || 'USD',
      };
    } catch (error: any) {
      console.error(`Error fetching balance for account ${loginid}:`, error);
      throw error;
    }
  }

  /**
   * Fetch available instruments for Deriv account
   */
  static async fetchInstruments(accessToken: string): Promise<string[]> {
    try {
      // Deriv synthetic indices
      const syntheticIndices = [
        'BOOM1000', 'BOOM500', 'BOOM300', 'BOOM100',
        'CRASH1000', 'CRASH500', 'CRASH300', 'CRASH100',
      ];

      // You can extend this to fetch from Deriv API if they provide an endpoint
      return syntheticIndices;
    } catch (error: any) {
      console.error('Error fetching instruments:', error);
      return [];
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    try {
      const DERIV_TOKEN_URL = process.env.DERIV_TOKEN_URL || 'https://oauth.deriv.com/oauth2/token';
      const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';

      const response = await fetch(DERIV_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: DERIV_APP_ID,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in || 3600,
      };
    } catch (error: any) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

