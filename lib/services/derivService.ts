/**
 * Deriv WebSocket API Service
 * 
 * Production-ready service for interacting with Deriv's official WebSocket API.
 * 
 * Features:
 * - Automatic connection management and reconnection
 * - Request/response correlation with timeouts
 * - Error handling and parsing
 * - Server-side only token handling
 * - Support for all major Deriv API calls
 * 
 * @module derivService
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

// ============================================================================
// Configuration
// ============================================================================

const DERIV_WS_URL = process.env.DERIV_WS_URL || 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// ============================================================================
// Type Definitions
// ============================================================================

export interface DerivAccountInfo {
  balance: number;
  currency: string;
  accountId: string;
  accountType: 'demo' | 'real';
  email?: string;
  country?: string;
  landingCompany?: string;
  loginId?: string;
}

export interface DerivProposalRequest {
  proposal: number;
  amount: number;
  basis?: 'stake' | 'payout';
  contract_type: 'CALL' | 'PUT' | 'RISE' | 'FALL' | 'DIGIT' | 'MULTIPLIER' | 'CFD';
  currency?: string;
  duration?: number;
  duration_unit?: 't' | 's' | 'm' | 'h' | 'd';
  symbol: string;
  barrier?: string;
  barrier2?: string;
  date_start?: number;
}

export interface DerivProposalResponse {
  proposal: {
    id: string;
    ask_price: number;
    date_expiry: number;
    display_value: string;
    longcode: string;
    payout: number;
    spot: number;
    spot_time: number;
  };
  echo_req?: any;
  msg_type: string;
  req_id?: number;
  error?: DerivError;
}

export interface DerivBuyRequest {
  buy: string | number; // Contract proposal ID or 1 for direct buy
  price: number; // Stake amount
  parameters?: {
    contract_type: 'CALL' | 'PUT' | 'RISE' | 'FALL' | 'DIGIT' | 'MULTIPLIER' | 'CFD';
    currency?: string;
    duration?: number;
    duration_unit?: 't' | 's' | 'm' | 'h' | 'd';
    symbol: string;
    barrier?: string;
    barrier2?: string;
    basis?: 'stake' | 'payout';
  };
}

export interface DerivBuyResponse {
  buy?: {
    buy_price: number;
    contract_id: string;
    longcode: string;
    purchase_time: number;
    start_time: number;
    transaction_id: number;
  };
  balance?: number;
  echo_req?: any;
  msg_type: string;
  req_id?: number;
  error?: DerivError;
}

export interface DerivTransaction {
  transaction_id: number;
  contract_id: string;
  symbol: string;
  action: 'buy' | 'sell';
  amount: number;
  balance_after: number;
  transaction_time: number;
  contract_type?: string;
}

export interface DerivTransactionHistoryRequest {
  transaction: number;
  limit?: number;
  offset?: number;
  action?: 'buy' | 'sell';
  date_from?: number;
  date_to?: number;
}

export interface DerivTransactionHistoryResponse {
  transaction: {
    transactions: DerivTransaction[];
  };
  echo_req?: any;
  msg_type: string;
  req_id?: number;
  error?: DerivError;
}

export interface DerivError {
  code: string;
  message: string;
  details?: any;
}

export interface DerivAuthorizeResponse {
  authorize?: {
    account_list?: Array<{
      account_type: string;
      balance: number;
      currency: string;
      loginid: string;
    }>;
    balance?: number;
    country?: string;
    currency?: string;
    email?: string;
    fullname?: string;
    is_virtual?: number;
    landing_company_name?: string;
    loginid?: string;
    scopes?: string[];
  };
  echo_req?: any;
  msg_type: string;
  req_id?: number;
  error?: DerivError;
}

export interface DerivBalanceResponse {
  balance?: {
    balance: number;
    currency: string;
    loginid?: string;
  };
  echo_req?: any;
  msg_type: string;
  req_id?: number;
  error?: DerivError;
}

// ============================================================================
// Service Class
// ============================================================================

export class DerivService extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private authenticated: boolean = false;
  private token: string | null = null;
  private requestId: number = 1;
  private pendingRequests: Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    timestamp: number;
  }> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private accountInfo: DerivAccountInfo | null = null;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Initialize the service with an API token
   * Token should be obtained from environment variables or secure storage
   * 
   * @param token - Deriv API token (server-side only)
   */
  constructor(token?: string) {
    super();
    // Get token from parameter, environment variable, or throw error
    this.token = token || process.env.DERIV_API_TOKEN || null;
    
    if (!this.token) {
      console.warn('[DerivService] No API token provided. Some operations will require authorization first.');
    }
  }

  /**
   * Connect to Deriv WebSocket API
   * 
   * @returns Promise that resolves when connected and authorized
   */
  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.connected && this.authenticated) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const wsUrl = `${DERIV_WS_URL}?app_id=${DERIV_APP_ID}`;
        console.log(`[DerivService] Connecting to ${DERIV_WS_URL}...`);
        
        this.ws = new WebSocket(wsUrl);

        // Connection timeout
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.terminate();
            this.isConnecting = false;
            this.connectionPromise = null;
            reject(new Error('Connection timeout'));
          }
        }, DEFAULT_TIMEOUT);

        this.ws.on('open', async () => {
          clearTimeout(connectionTimeout);
          console.log('[DerivService] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.isConnecting = false;

          // Start heartbeat
          this.startHeartbeat();

          // Authorize if token is available
          if (this.token) {
            try {
              await this.authorize(this.token);
              this.connectionPromise = null;
              resolve();
            } catch (error: any) {
              this.connectionPromise = null;
              reject(error);
            }
          } else {
            // Connected but not authenticated
            this.connectionPromise = null;
            resolve();
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('[DerivService] Error parsing message:', error);
            this.emit('error', new Error('Failed to parse WebSocket message'));
          }
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectionTimeout);
          console.error('[DerivService] WebSocket error:', error);
          this.isConnecting = false;
          this.connectionPromise = null;
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          clearTimeout(connectionTimeout);
          console.log(`[DerivService] WebSocket closed: ${code} - ${reason.toString()}`);
          this.connected = false;
          this.authenticated = false;
          this.isConnecting = false;
          this.connectionPromise = null;
          this.stopHeartbeat();
          this.ws = null;

          // Attempt to reconnect if not intentionally closed
          if (code !== 1000 && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this.emit('reconnect_failed', new Error('Max reconnection attempts reached'));
          }
        });
      } catch (error: any) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from Deriv WebSocket
   */
  async disconnect(): Promise<void> {
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Clear all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();

    // Close WebSocket
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    console.log('[DerivService] Disconnected');
  }

  /**
   * Authorize with API token
   * 
   * @param token - Deriv API token
   * @returns Promise with account information
   */
  async authorize(token: string): Promise<DerivAccountInfo> {
    this.token = token;
    
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const reqId = this.getNextRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Authorization timeout'));
      }, DEFAULT_TIMEOUT);

      this.pendingRequests.set(reqId, {
        resolve: (data: DerivAuthorizeResponse) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(`Authorization failed: ${data.error.message} (${data.error.code})`));
            return;
          }

          if (data.authorize) {
            const auth = data.authorize;
            this.authenticated = true;
            
            // Extract account info
            const account = auth.account_list?.[0] || {
              account_type: auth.is_virtual ? 'demo' : 'real',
              balance: auth.balance || 0,
              currency: auth.currency || 'USD',
              loginid: auth.loginid || '',
            };

            this.accountInfo = {
              balance: account.balance || auth.balance || 0,
              currency: account.currency || auth.currency || 'USD',
              accountId: account.loginid || auth.loginid || '',
              accountType: account.account_type === 'virtual' || auth.is_virtual ? 'demo' : 'real',
              email: auth.email,
              country: auth.country,
              landingCompany: auth.landing_company_name,
              loginId: auth.loginid,
            };

            this.emit('authorized', this.accountInfo);
            resolve(this.accountInfo);
          } else {
            reject(new Error('Invalid authorization response'));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        timestamp: Date.now(),
      });

      this.send({
        authorize: token,
        req_id: reqId,
      });
    });
  }

  /**
   * Get account balance
   * 
   * @returns Promise with balance information
   */
  async getBalance(): Promise<{ balance: number; currency: string }> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    return new Promise((resolve, reject) => {
      const reqId = this.getNextRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Balance request timeout'));
      }, DEFAULT_TIMEOUT);

      this.pendingRequests.set(reqId, {
        resolve: (data: DerivBalanceResponse) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(`Balance request failed: ${data.error.message} (${data.error.code})`));
            return;
          }

          if (data.balance) {
            // Update account info
            if (this.accountInfo) {
              this.accountInfo.balance = data.balance.balance;
              this.accountInfo.currency = data.balance.currency;
            }

            resolve({
              balance: data.balance.balance,
              currency: data.balance.currency,
            });
          } else {
            reject(new Error('Invalid balance response'));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        timestamp: Date.now(),
      });

      this.send({
        balance: 1,
        req_id: reqId,
      });
    });
  }

  /**
   * Get contract proposal
   * 
   * @param request - Proposal request parameters
   * @returns Promise with proposal information
   */
  async getProposal(request: DerivProposalRequest): Promise<DerivProposalResponse['proposal']> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    return new Promise((resolve, reject) => {
      const reqId = this.getNextRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Proposal request timeout'));
      }, DEFAULT_TIMEOUT);

      this.pendingRequests.set(reqId, {
        resolve: (data: DerivProposalResponse) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(`Proposal request failed: ${data.error.message} (${data.error.code})`));
            return;
          }

          if (data.proposal) {
            resolve(data.proposal);
          } else {
            reject(new Error('Invalid proposal response'));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        timestamp: Date.now(),
      });

      this.send({
        proposal: 1,
        amount: request.amount,
        basis: request.basis || 'stake',
        contract_type: request.contract_type,
        currency: request.currency,
        duration: request.duration,
        duration_unit: request.duration_unit,
        symbol: request.symbol,
        barrier: request.barrier,
        barrier2: request.barrier2,
        date_start: request.date_start,
        req_id: reqId,
      });
    });
  }

  /**
   * Buy a contract
   * 
   * @param request - Buy request parameters
   * @returns Promise with buy response
   */
  async buy(request: DerivBuyRequest): Promise<DerivBuyResponse['buy']> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    return new Promise((resolve, reject) => {
      const reqId = this.getNextRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Buy request timeout'));
      }, DEFAULT_TIMEOUT);

      this.pendingRequests.set(reqId, {
        resolve: (data: DerivBuyResponse) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(`Buy request failed: ${data.error.message} (${data.error.code})`));
            return;
          }

          if (data.buy) {
            // Update balance if provided
            if (data.balance !== undefined && this.accountInfo) {
              this.accountInfo.balance = data.balance;
            }

            this.emit('contract_bought', data.buy);
            resolve(data.buy);
          } else {
            reject(new Error('Invalid buy response'));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        timestamp: Date.now(),
      });

      const buyMessage: any = {
        buy: request.buy,
        price: request.price,
        req_id: reqId,
      };

      if (request.parameters) {
        Object.assign(buyMessage, request.parameters);
      }

      this.send(buyMessage);
    });
  }

  /**
   * Get transaction history
   * 
   * @param request - Transaction history request parameters
   * @returns Promise with transaction history
   */
  async getTransactionHistory(request?: Partial<DerivTransactionHistoryRequest>): Promise<DerivTransaction[]> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    return new Promise((resolve, reject) => {
      const reqId = this.getNextRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Transaction history request timeout'));
      }, DEFAULT_TIMEOUT);

      this.pendingRequests.set(reqId, {
        resolve: (data: DerivTransactionHistoryResponse) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(`Transaction history request failed: ${data.error.message} (${data.error.code})`));
            return;
          }

          if (data.transaction?.transactions) {
            resolve(data.transaction.transactions);
          } else {
            resolve([]);
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        timestamp: Date.now(),
      });

      this.send({
        transaction: 1,
        limit: request?.limit || 50,
        offset: request?.offset || 0,
        action: request?.action,
        date_from: request?.date_from,
        date_to: request?.date_to,
        req_id: reqId,
      });
    });
  }

  /**
   * Get account information
   */
  getAccountInfo(): DerivAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Send message via WebSocket
   */
  private send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const jsonMessage = JSON.stringify(message);
      this.ws.send(jsonMessage);
      console.log('[DerivService] Sent:', JSON.stringify(message, null, 2));
    } catch (error) {
      console.error('[DerivService] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    // Handle responses to pending requests
    if (message.req_id !== undefined) {
      const pending = this.pendingRequests.get(message.req_id);
      if (pending) {
        pending.resolve(message);
        return;
      }
    }

    // Handle subscription updates (contract updates, etc.)
    if (message.msg_type === 'contract') {
      this.emit('contract_update', message);
    } else if (message.msg_type === 'tick') {
      this.emit('tick', message);
    } else if (message.msg_type === 'proposal') {
      this.emit('proposal', message);
    } else if (message.msg_type === 'transaction') {
      this.emit('transaction', message);
    }

    // Emit all messages for debugging
    this.emit('message', message);
  }

  /**
   * Get next request ID
   */
  private getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ ping: 1 });
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    console.log(`[DerivService] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error('[DerivService] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Clean up old pending requests (prevent memory leaks)
   */
  private cleanupPendingRequests(): void {
    const now = Date.now();
    const maxAge = DEFAULT_TIMEOUT * 2; // 2x timeout

    this.pendingRequests.forEach((request, reqId) => {
      if (now - request.timestamp > maxAge) {
        clearTimeout(request.timeout);
        request.reject(new Error('Request expired'));
        this.pendingRequests.delete(reqId);
      }
    });
  }
}

// ============================================================================
// Singleton Instance (Optional)
// ============================================================================

let defaultInstance: DerivService | null = null;

/**
 * Get or create default DerivService instance
 * Uses token from environment variable DERIV_API_TOKEN
 */
export function getDerivService(token?: string): DerivService {
  if (!defaultInstance) {
    defaultInstance = new DerivService(token);
  }
  return defaultInstance;
}

// ============================================================================
// Export
// ============================================================================

export default DerivService;


