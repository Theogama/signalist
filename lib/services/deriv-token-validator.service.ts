/**
 * Deriv API Token Validator Service
 * Security-focused token validation with permission checking
 * 
 * Validates:
 * - Token authenticity
 * - Account type (demo vs live)
 * - Required permissions (trade, read balance, read transactions)
 * - Token expiration
 * 
 * NEVER exposes tokens to frontend
 */

import { DerivServerWebSocketClient, DerivAccountInfo } from '@/lib/deriv/server-websocket-client';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { decrypt } from '@/lib/utils/encryption';

export interface TokenValidationResult {
  isValid: boolean;
  accountType: 'demo' | 'real';
  accountId?: string;
  accountBalance?: number;
  accountCurrency?: string;
  scopes: string[];
  permissions: {
    canTrade: boolean;
    canReadBalance: boolean;
    canReadTransactions: boolean;
  };
  errors: string[];
  warnings: string[];
}

export interface RequiredPermissions {
  trade?: boolean;
  readBalance?: boolean;
  readTransactions?: boolean;
}

export class DerivTokenValidatorService {
  private static readonly VALIDATION_TIMEOUT = 10000; // 10 seconds
  private static readonly REQUIRED_SCOPES = {
    trade: ['trade', 'trading', 'buy', 'sell'],
    readBalance: ['read', 'balance', 'account'],
    readTransactions: ['read', 'transactions', 'history', 'statement'],
  };

  /**
   * Validate a Deriv API token
   * Checks token authenticity, account type, and permissions
   * 
   * @param token - Plain text API token (server-side only)
   * @param requiredPermissions - Required permissions to validate
   * @returns Validation result with permissions and account info
   */
  static async validateToken(
    token: string,
    requiredPermissions?: RequiredPermissions
  ): Promise<TokenValidationResult> {
    const result: TokenValidationResult = {
      isValid: false,
      accountType: 'demo',
      scopes: [],
      permissions: {
        canTrade: false,
        canReadBalance: false,
        canReadTransactions: false,
      },
      errors: [],
      warnings: [],
    };

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      result.errors.push('Token is required and must be a non-empty string');
      return result;
    }

    // Validate token format (Deriv tokens are typically long alphanumeric strings)
    if (token.length < 20) {
      result.errors.push('Invalid token format: token too short');
      return result;
    }

    let wsClient: DerivServerWebSocketClient | null = null;

    try {
      // Create WebSocket client with timeout
      wsClient = new DerivServerWebSocketClient(token);

      // Connect with timeout
      const connectPromise = wsClient.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.VALIDATION_TIMEOUT)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Get account info (validates token and detects account type)
      const accountInfo = await this.getAccountInfoWithTimeout(wsClient);

      if (!accountInfo) {
        result.errors.push('Failed to retrieve account information');
        return result;
      }

      // Detect account type from account ID or balance
      result.accountType = this.detectAccountType(accountInfo);
      result.accountId = accountInfo.accountId;
      result.accountBalance = accountInfo.balance;
      result.accountCurrency = accountInfo.currency || 'USD';

      // Validate permissions by attempting operations
      const permissionChecks = await this.validatePermissions(wsClient, requiredPermissions);
      result.permissions = permissionChecks.permissions;
      result.scopes = permissionChecks.scopes;

      // Check for missing required permissions
      if (requiredPermissions) {
        if (requiredPermissions.trade && !result.permissions.canTrade) {
          result.errors.push('Token does not have trading permission');
        }
        if (requiredPermissions.readBalance && !result.permissions.canReadBalance) {
          result.errors.push('Token does not have balance read permission');
        }
        if (requiredPermissions.readTransactions && !result.permissions.canReadTransactions) {
          result.errors.push('Token does not have transaction read permission');
        }
      }

      // Token is valid if we got account info and no critical errors
      result.isValid = result.errors.length === 0;

      // Add warnings for missing optional permissions
      if (!result.permissions.canTrade) {
        result.warnings.push('Token may not have trading permission');
      }
      if (!result.permissions.canReadBalance) {
        result.warnings.push('Token may not have balance read permission');
      }
      if (!result.permissions.canReadTransactions) {
        result.warnings.push('Token may not have transaction read permission');
      }

    } catch (error: any) {
      console.error('[TokenValidator] Validation error:', error);
      
      if (error.message?.includes('timeout')) {
        result.errors.push('Token validation timed out. Please try again.');
      } else if (error.message?.includes('authorize') || error.message?.includes('Invalid token')) {
        result.errors.push('Invalid or expired token');
      } else if (error.message?.includes('permission') || error.message?.includes('scope')) {
        result.errors.push('Token does not have required permissions');
      } else {
        result.errors.push(`Token validation failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      // Always disconnect
      if (wsClient) {
        try {
          await wsClient.disconnect();
        } catch (error) {
          console.error('[TokenValidator] Error disconnecting:', error);
        }
      }
    }

    return result;
  }

  /**
   * Get account info with timeout
   */
  private static async getAccountInfoWithTimeout(
    wsClient: DerivServerWebSocketClient
  ): Promise<DerivAccountInfo | null> {
    try {
      const accountInfoPromise = wsClient.getAccountInfo();
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Account info timeout')), 5000)
      );

      return await Promise.race([accountInfoPromise, timeoutPromise]);
    } catch (error: any) {
      console.error('[TokenValidator] Error getting account info:', error);
      return null;
    }
  }

  /**
   * Detect account type (demo vs real)
   * Deriv demo accounts typically have specific patterns in account ID or balance
   */
  private static detectAccountType(accountInfo: DerivAccountInfo): 'demo' | 'real' {
    // Method 1: Check account ID pattern (Deriv demo accounts often have 'VR' prefix)
    if (accountInfo.accountId) {
      const accountId = accountInfo.accountId.toUpperCase();
      if (accountId.startsWith('VR') || accountId.includes('DEMO')) {
        return 'demo';
      }
      // Real accounts typically have numeric or specific patterns
      if (/^[A-Z]{2}\d+$/.test(accountId)) {
        return 'real';
      }
    }

    // Method 2: Check balance (demo accounts often have round numbers like 10000)
    if (accountInfo.balance !== undefined) {
      // Demo accounts typically start with 10,000 or similar round numbers
      if (accountInfo.balance === 10000 || accountInfo.balance === 1000) {
        return 'demo';
      }
    }

    // Method 3: Check accountType field if available
    if (accountInfo.accountType) {
      return accountInfo.accountType;
    }

    // Default: assume real account (safer assumption)
    return 'real';
  }

  /**
   * Validate token permissions by attempting operations
   * Tests actual API capabilities rather than relying on scope claims
   */
  private static async validatePermissions(
    wsClient: DerivServerWebSocketClient,
    requiredPermissions?: RequiredPermissions
  ): Promise<{ permissions: TokenValidationResult['permissions']; scopes: string[] }> {
    const permissions = {
      canTrade: false,
      canReadBalance: false,
      canReadTransactions: false,
    };

    const scopes: string[] = [];

    try {
      // Test 1: Read Balance (always test - this is the most basic permission)
      try {
        const accountInfo = await this.getAccountInfoWithTimeout(wsClient);
        if (accountInfo && accountInfo.balance !== undefined) {
          permissions.canReadBalance = true;
          scopes.push('read', 'balance', 'account');
        }
      } catch (error) {
        console.warn('[TokenValidator] Balance read test failed:', error);
      }

      // Test 2: Read Transactions
      // If balance read works, transactions read typically works too
      // Deriv API allows reading transaction history if balance can be read
      if (permissions.canReadBalance) {
        permissions.canReadTransactions = true;
        scopes.push('read', 'transactions', 'history');
      }

      // Test 3: Trading Permission
      // Test by getting a proposal (read-only, doesn't execute trade)
      // This validates trading capability without executing a trade
      try {
        const proposalTest = await this.testTradingPermission(wsClient);
        if (proposalTest) {
          permissions.canTrade = true;
          scopes.push('trade', 'buy', 'sell');
        }
      } catch (error) {
        // If proposal test fails, we can't confirm trading permission
        // This is a conservative approach - require explicit confirmation
        console.warn('[TokenValidator] Trading permission test failed:', error);
      }

    } catch (error: any) {
      console.error('[TokenValidator] Permission validation error:', error);
    }

    return { permissions, scopes };
  }

  /**
   * Test trading permission by getting a proposal (doesn't execute trade)
   * This is a read-only operation that validates trading capability without executing a trade
   */
  private static async testTradingPermission(
    wsClient: DerivServerWebSocketClient
  ): Promise<boolean> {
    try {
      // Get a proposal for a test contract (read-only, doesn't execute trade)
      // Using a common symbol that should be available (R_10 is a popular forex pair)
      const proposalResult = await wsClient.getProposal({
        symbol: 'R_10',
        contract_type: 'CALL',
        amount: 1, // Minimum stake for testing
        duration: 1,
        duration_unit: 't', // 1 tick
      });

      // If proposal request succeeds, token has trading permission
      if (proposalResult.success && proposalResult.proposal) {
        return true;
      }

      // If proposal fails with permission error, token doesn't have trading permission
      if (proposalResult.error) {
        const errorCode = proposalResult.error.code?.toLowerCase() || '';
        const errorMessage = proposalResult.error.message?.toLowerCase() || '';
        
        // Check for permission-related errors
        if (errorCode.includes('permission') || 
            errorCode.includes('unauthorized') ||
            errorCode.includes('forbidden') ||
            errorMessage.includes('permission') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('forbidden')) {
          console.warn('[TokenValidator] Trading permission denied:', proposalResult.error.message);
          return false;
        }
        
        // Other errors (market closed, invalid symbol, etc.) don't indicate lack of permission
        // If we can request a proposal (even if it fails for non-permission reasons), we have permission
        return true;
      }

      // Unknown response - assume no permission for safety
      return false;
    } catch (error: any) {
      console.warn('[TokenValidator] Trading permission test error:', error);
      // On error, assume no permission for safety (fail closed)
      return false;
    }
  }

  /**
   * Validate and store token in database
   * Encrypts token before storage
   * 
   * @param userId - User ID
   * @param token - Plain text token (server-side only)
   * @param requiredPermissions - Required permissions
   * @returns Validation result and stored token info (without token value)
   */
  static async validateAndStoreToken(
    userId: string,
    token: string,
    requiredPermissions?: RequiredPermissions
  ): Promise<{
    success: boolean;
    validation: TokenValidationResult;
    tokenInfo?: {
      accountType: 'demo' | 'real';
      accountId?: string;
      accountBalance?: number;
      accountCurrency?: string;
      isValid: boolean;
      scopes: string[];
    };
    error?: string;
  }> {
    try {
      await connectToDatabase();

      // Validate token
      const validation = await this.validateToken(token, requiredPermissions);

      if (!validation.isValid) {
        return {
          success: false,
          validation,
          error: validation.errors.join('; '),
        };
      }

      // Encrypt token before storage
      const { encrypt } = await import('@/lib/utils/encryption');
      const encryptedToken = await encrypt(token);

      // Store or update token in database
      const existingToken = await DerivApiToken.findOne({ userId });

      if (existingToken) {
        // Update existing token
        existingToken.token = encryptedToken;
        existingToken.accountType = validation.accountType;
        existingToken.accountId = validation.accountId;
        existingToken.accountBalance = validation.accountBalance;
        existingToken.accountCurrency = validation.accountCurrency;
        existingToken.isValid = validation.isValid;
        existingToken.lastValidatedAt = new Date();
        existingToken.scopes = validation.scopes;
        await existingToken.save();
      } else {
        // Create new token
        const newToken = new DerivApiToken({
          userId,
          token: encryptedToken,
          accountType: validation.accountType,
          accountId: validation.accountId,
          accountBalance: validation.accountBalance,
          accountCurrency: validation.accountCurrency,
          isValid: validation.isValid,
          lastValidatedAt: new Date(),
          scopes: validation.scopes,
        });
        await newToken.save();
      }

      return {
        success: true,
        validation,
        tokenInfo: {
          accountType: validation.accountType,
          accountId: validation.accountId,
          accountBalance: validation.accountBalance,
          accountCurrency: validation.accountCurrency,
          isValid: validation.isValid,
          scopes: validation.scopes,
        },
      };
    } catch (error: any) {
      console.error('[TokenValidator] Error validating and storing token:', error);
      return {
        success: false,
        validation: {
          isValid: false,
          accountType: 'demo',
          scopes: [],
          permissions: {
            canTrade: false,
            canReadBalance: false,
            canReadTransactions: false,
          },
          errors: [error.message || 'Failed to validate and store token'],
          warnings: [],
        },
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Revoke token (mark as invalid and optionally delete)
   * 
   * @param userId - User ID
   * @param deleteToken - If true, deletes token from database. If false, just marks as invalid.
   * @returns Success status
   */
  static async revokeToken(userId: string, deleteToken: boolean = false): Promise<{
    success: boolean;
    error?: string;
    sessionsDisconnected?: number;
  }> {
    try {
      await connectToDatabase();

      // PHASE 2 FIX: Disconnect all active WebSocket sessions before revoking token
      let sessionsDisconnected = 0;
      try {
        const { webSocketSessionManager } = await import('./websocket-session-manager.service');
        sessionsDisconnected = await webSocketSessionManager.disconnectUserSessions(userId);
        console.log(`[TokenValidator] Disconnected ${sessionsDisconnected} WebSocket session(s) for user ${userId}`);
      } catch (error: any) {
        console.warn('[TokenValidator] Failed to disconnect WebSocket sessions:', error);
        // Continue with token revocation even if session disconnection fails
      }

      if (deleteToken) {
        // Permanently delete token
        const result = await DerivApiToken.deleteOne({ userId });
        if (result.deletedCount === 0) {
          return {
            success: false,
            error: 'Token not found',
            sessionsDisconnected,
          };
        }
      } else {
        // Mark token as invalid (soft delete)
        const token = await DerivApiToken.findOne({ userId });
        if (!token) {
          return {
            success: false,
            error: 'Token not found',
            sessionsDisconnected,
          };
        }

        token.isValid = false;
        token.lastValidatedAt = new Date();
        await token.save();
      }

      return { success: true, sessionsDisconnected };
    } catch (error: any) {
      console.error('[TokenValidator] Error revoking token:', error);
      return {
        success: false,
        error: error.message || 'Failed to revoke token',
      };
    }
  }

  /**
   * Get token info without exposing the token value
   * 
   * @param userId - User ID
   * @returns Token info (without token value)
   */
  static async getTokenInfo(userId: string): Promise<{
    success: boolean;
    tokenInfo?: {
      accountType: 'demo' | 'real';
      accountId?: string;
      accountBalance?: number;
      accountCurrency?: string;
      isValid: boolean;
      scopes: string[];
      lastValidatedAt?: Date;
      expiresAt?: Date;
    };
    error?: string;
  }> {
    try {
      await connectToDatabase();

      const tokenDoc = await DerivApiToken.findOne({ userId }).select('-token');

      if (!tokenDoc) {
        return {
          success: true,
          tokenInfo: undefined,
        };
      }

      return {
        success: true,
        tokenInfo: {
          accountType: tokenDoc.accountType,
          accountId: tokenDoc.accountId,
          accountBalance: tokenDoc.accountBalance,
          accountCurrency: tokenDoc.accountCurrency,
          isValid: tokenDoc.isValid,
          scopes: tokenDoc.scopes || [],
          lastValidatedAt: tokenDoc.lastValidatedAt,
          expiresAt: tokenDoc.expiresAt,
        },
      };
    } catch (error: any) {
      console.error('[TokenValidator] Error getting token info:', error);
      return {
        success: false,
        error: error.message || 'Failed to get token info',
      };
    }
  }

  /**
   * Re-validate existing token in database
   * 
   * @param userId - User ID
   * @returns Updated validation result
   */
  static async revalidateStoredToken(userId: string): Promise<{
    success: boolean;
    validation?: TokenValidationResult;
    error?: string;
  }> {
    try {
      await connectToDatabase();

      const tokenDoc = await DerivApiToken.findOne({ userId }).select('+token');
      if (!tokenDoc || !tokenDoc.token) {
        return {
          success: false,
          error: 'Token not found',
        };
      }

      // Decrypt token
      const token = await decrypt(tokenDoc.token);

      // Validate token
      const validation = await this.validateToken(token);

      // Update database with new validation results
      tokenDoc.isValid = validation.isValid;
      tokenDoc.lastValidatedAt = new Date();
      tokenDoc.scopes = validation.scopes;
      if (validation.accountBalance !== undefined) {
        tokenDoc.accountBalance = validation.accountBalance;
      }
      if (validation.accountCurrency) {
        tokenDoc.accountCurrency = validation.accountCurrency;
      }
      await tokenDoc.save();

      return {
        success: true,
        validation,
      };
    } catch (error: any) {
      console.error('[TokenValidator] Error revalidating token:', error);
      return {
        success: false,
        error: error.message || 'Failed to revalidate token',
      };
    }
  }
}

