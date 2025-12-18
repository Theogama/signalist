/**
 * Server-Side Deriv WebSocket Client
 * Handles WebSocket connections to Deriv API for server-side trading
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';

export interface DerivAccountInfo {
  balance: number;
  currency: string;
  accountId: string;
  accountType: 'demo' | 'real';
  email?: string;
  country?: string;
}

export interface DerivContract {
  contract_id: string;
  symbol: string;
  contract_type: 'CALL' | 'PUT' | 'RISE' | 'FALL' | 'DIGIT' | 'MULTIPLIER' | 'CFD';
  buy_price: number;
  purchase_price: number;
  current_spot?: number;
  profit?: number;
  date_start: number;
  date_expiry?: number;
  status: 'open' | 'sold' | 'won' | 'lost';
}

export interface DerivBuyRequest {
  symbol: string;
  contract_type: 'CALL' | 'PUT' | 'RISE' | 'FALL' | 'DIGIT' | 'MULTIPLIER' | 'CFD';
  amount: number; // Stake amount
  duration?: number; // Duration in ticks or seconds
  duration_unit?: 't' | 's' | 'm' | 'h' | 'd'; // ticks, seconds, minutes, hours, days
  basis?: 'stake' | 'payout';
  barrier?: string; // For digit contracts
  barrier2?: string; // For range contracts
}

export interface DerivBuyResponse {
  buy?: {
    contract_id: string;
    purchase_price: number;
    buy_price: number;
    start_time: number;
    date_start: number;
  };
  error?: {
    code: string;
    message: string;
  };
  req_id?: number;
}

export class DerivServerWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private authenticated: boolean = false;
  private token: string;
  private requestId: number = 1;
  private pendingRequests: Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private subscriptions: Map<string, {
    id: string;
    callback: (data: any) => void;
  }> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private accountInfo: DerivAccountInfo | null = null;

  constructor(token: string) {
    super();
    this.token = token;
  }

  /**
   * Connect to Deriv WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${DERIV_WS_URL}?app_id=${DERIV_APP_ID}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', async () => {
          console.log('[DerivServerWS] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;

          // Start heartbeat
          this.startHeartbeat();

          // Authorize with token
          try {
            await this.authorize();
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('[DerivServerWS] Error parsing message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[DerivServerWS] WebSocket error:', error);
          this.connected = false;
          this.authenticated = false;
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[DerivServerWS] WebSocket closed');
          this.connected = false;
          this.authenticated = false;
          this.stopHeartbeat();
          this.emit('disconnect');

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`[DerivServerWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(console.error);
            }, delay);
          } else {
            this.emit('reconnect_failed');
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.clearPendingRequests();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.connected && this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Authorize with API token
   */
  private async authorize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      this.sendMessage({ authorize: this.token, req_id: reqId });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Authorization timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Authorization failed'));
          } else if (data.authorize) {
            this.authenticated = true;
            this.accountInfo = {
              balance: parseFloat(data.authorize.balance || 0),
              currency: data.authorize.currency || 'USD',
              accountId: data.authorize.loginid || '',
              accountType: data.authorize.account_list?.[0]?.account_type === 'real' ? 'real' : 'demo',
              email: data.authorize.email,
              country: data.authorize.country,
            };
            this.emit('authorized', this.accountInfo);
            resolve();
          } else {
            reject(new Error('Invalid authorization response'));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any): void {
    // Handle ping/pong
    if (data.ping) {
      this.sendMessage({ pong: 1 });
      return;
    }

    const reqId = data.req_id;

    // Handle response to pending request
    if (reqId && this.pendingRequests.has(reqId)) {
      const { resolve, timeout } = this.pendingRequests.get(reqId)!;
      clearTimeout(timeout);
      this.pendingRequests.delete(reqId);
      resolve(data);
      return;
    }

    // Handle subscription updates
    if (data.subscription) {
      const subscriptionId = data.subscription.id;
      const subscription = Array.from(this.subscriptions.values()).find(s => s.id === subscriptionId);
      if (subscription) {
        subscription.callback(data);
      }
    }

    // Handle contract updates
    if (data.proposal_open_contract) {
      this.emit('contract_update', data.proposal_open_contract);
    }

    // Handle balance updates
    if (data.balance) {
      if (this.accountInfo) {
        this.accountInfo.balance = parseFloat(data.balance.balance || 0);
      }
      this.emit('balance_update', parseFloat(data.balance.balance || 0));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ ping: 1 });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clear all pending requests
   */
  private clearPendingRequests(): void {
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<DerivAccountInfo> {
    if (this.accountInfo) {
      return this.accountInfo;
    }

    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      this.sendMessage({ account: 1, req_id: reqId });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get account info timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get account info'));
          } else {
            const account = data.account;
            this.accountInfo = {
              balance: parseFloat(account.balance || 0),
              currency: account.currency || 'USD',
              accountId: account.loginid || '',
              accountType: account.account_type === 'real' ? 'real' : 'demo',
              email: account.email,
              country: account.country,
            };
            resolve(this.accountInfo);
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }

  /**
   * Place a buy contract
   */
  async buyContract(request: DerivBuyRequest): Promise<DerivBuyResponse> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      const buyRequest: any = {
        buy: reqId,
        price: request.amount,
        parameters: {
          contract_type: request.contract_type,
          symbol: request.symbol,
          amount: request.amount,
          basis: request.basis || 'stake',
        },
        req_id: reqId,
      };

      if (request.duration) {
        buyRequest.parameters.duration = request.duration;
        buyRequest.parameters.duration_unit = request.duration_unit || 'm';
      }

      if (request.barrier) {
        buyRequest.parameters.barrier = request.barrier;
      }

      if (request.barrier2) {
        buyRequest.parameters.barrier2 = request.barrier2;
      }

      this.sendMessage(buyRequest);

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Buy contract timeout'));
      }, 30000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            resolve({
              error: {
                code: data.error.code || 'UNKNOWN',
                message: data.error.message || 'Buy failed',
              },
              req_id: reqId,
            });
          } else {
            resolve(data as DerivBuyResponse);
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }

  /**
   * Sell/Close a contract
   */
  async sellContract(contractId: string, price?: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      this.sendMessage({
        sell: contractId,
        price: price || 0,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Sell contract timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            resolve(false);
          } else {
            resolve(true);
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }

  /**
   * Subscribe to contract updates
   */
  async subscribeToContract(contractId: string, callback: (contract: DerivContract) => void): Promise<() => void> {
    const reqId = this.requestId++;
    const subscriptionId = `contract_${contractId}_${reqId}`;

    this.sendMessage({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: reqId,
    });

    const timeout = setTimeout(() => {
      this.subscriptions.delete(subscriptionId);
      throw new Error('Subscribe to contract timeout');
    }, 10000);

    return new Promise((resolve, reject) => {
      const handler = (data: any) => {
        if (data.proposal_open_contract) {
          const contract: DerivContract = {
            contract_id: data.proposal_open_contract.contract_id,
            symbol: data.proposal_open_contract.symbol,
            contract_type: data.proposal_open_contract.contract_type,
            buy_price: parseFloat(data.proposal_open_contract.buy_price || 0),
            purchase_price: parseFloat(data.proposal_open_contract.purchase_price || 0),
            current_spot: parseFloat(data.proposal_open_contract.current_spot || 0),
            profit: parseFloat(data.proposal_open_contract.profit || 0),
            date_start: data.proposal_open_contract.date_start,
            date_expiry: data.proposal_open_contract.date_expiry,
            status: data.proposal_open_contract.is_sold ? 'sold' : 
                   data.proposal_open_contract.profit > 0 ? 'won' : 
                   data.proposal_open_contract.profit < 0 ? 'lost' : 'open',
          };
          callback(contract);
        }
      };

      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        callback: handler,
      });

      clearTimeout(timeout);
      resolve(() => {
        // Unsubscribe
        this.sendMessage({
          forget: subscriptionId,
        });
        this.subscriptions.delete(subscriptionId);
      });
    });
  }

  /**
   * Subscribe to balance updates
   */
  async subscribeToBalance(callback: (balance: number) => void): Promise<() => void> {
    const reqId = this.requestId++;
    const subscriptionId = `balance_${reqId}`;

    this.sendMessage({
      balance: 1,
      subscribe: 1,
      req_id: reqId,
    });

    const handler = (data: any) => {
      if (data.balance) {
        const balance = parseFloat(data.balance.balance || 0);
        callback(balance);
      }
    };

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      callback: handler,
    });

    return () => {
      this.sendMessage({
        forget: subscriptionId,
      });
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Get open contracts/positions
   */
  async getOpenContracts(): Promise<DerivContract[]> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      this.sendMessage({
        portfolio: 1,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get open contracts timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get open contracts'));
          } else {
            const contracts = data.portfolio?.contracts || [];
            const result: DerivContract[] = contracts.map((c: any) => ({
              contract_id: c.contract_id,
              symbol: c.symbol,
              contract_type: c.contract_type,
              buy_price: parseFloat(c.buy_price || 0),
              purchase_price: parseFloat(c.purchase_price || 0),
              current_spot: parseFloat(c.current_spot || 0),
              profit: parseFloat(c.profit || 0),
              date_start: c.date_start,
              date_expiry: c.date_expiry,
              status: c.is_sold ? 'sold' : 'open',
            }));
            resolve(result);
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }
}

