/**
 * Deriv WebSocket Service
 * Client-side service for real-time Deriv data via WebSocket
 */

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = '113058';

export interface DerivTickData {
  symbol: string;
  quote: number;
  bid?: number;
  ask?: number;
  epoch: number;
  pip_size?: number;
}

export interface DerivSubscription {
  symbol: string;
  callback: (data: DerivTickData) => void;
  unsubscribe: () => void;
}

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: DerivTickData) => void>> = new Map();
  private requestId: number = 1;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private isConnecting: boolean = false;
  private accessToken: string | null = null;

  /**
   * Connect to Deriv WebSocket
   */
  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for connection
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.isConnecting) {
            clearInterval(checkInterval);
            reject(new Error('Connection failed'));
          }
        }, 100);
        return;
      }

      this.isConnecting = true;
      this.accessToken = token || null;

      try {
        const wsUrl = `${DERIV_WS_URL}?app_id=${DERIV_APP_ID}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[DerivWS] Connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;

          // Authorize if token provided
          if (this.accessToken) {
            this.send({ authorize: this.accessToken });
          }

          // Resubscribe to all active subscriptions
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[DerivWS] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DerivWS] WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[DerivWS] Connection closed');
          this.ws = null;
          this.isConnecting = false;

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(
              this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
              30000
            );
            setTimeout(() => this.connect(this.accessToken || undefined), delay);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Subscribe to tick updates for a symbol
   */
  subscribe(symbol: string, callback: (data: DerivTickData) => void): DerivSubscription {
    const upperSymbol = symbol.toUpperCase();

    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }

    this.subscriptions.get(upperSymbol)!.add(callback);

    // Subscribe via WebSocket if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        ticks: upperSymbol,
        subscribe: 1,
      });
    } else {
      // Connect and then subscribe
      this.connect().then(() => {
        this.send({
          ticks: upperSymbol,
          subscribe: 1,
        });
      });
    }

    return {
      symbol: upperSymbol,
      callback,
      unsubscribe: () => {
        const callbacks = this.subscriptions.get(upperSymbol);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscriptions.delete(upperSymbol);
            // Unsubscribe from WebSocket
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.send({
                forget: upperSymbol,
              });
            }
          }
        }
      },
    };
  }

  /**
   * Send message via WebSocket
   */
  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const request = {
        ...message,
        req_id: this.requestId++,
      };
      this.ws.send(JSON.stringify(request));
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any): void {
    // Handle tick updates
    if (data.tick) {
      const tick: DerivTickData = data.tick;
      const callbacks = this.subscriptions.get(tick.symbol);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(tick);
          } catch (error) {
            console.error('[DerivWS] Callback error:', error);
          }
        });
      }
    }

    // Handle authorization response
    if (data.authorize) {
      if (data.authorize.error) {
        console.error('[DerivWS] Authorization error:', data.authorize.error);
      } else {
        console.log('[DerivWS] Authorized successfully');
      }
    }

    // Handle subscription responses
    if (data.subscription) {
      if (data.subscription.error) {
        console.error('[DerivWS] Subscription error:', data.subscription.error);
      }
    }
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private resubscribeAll(): void {
    const symbols = Array.from(this.subscriptions.keys());
    symbols.forEach((symbol) => {
      this.send({
        ticks: symbol,
        subscribe: 1,
      });
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.subscriptions.clear();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const derivWebSocketService = new DerivWebSocketService();


