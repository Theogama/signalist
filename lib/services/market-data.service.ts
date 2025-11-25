/**
 * Real-time Market Data Service
 * Handles live price updates from multiple sources (Finnhub, TradingView, Brokers)
 */

export interface LivePriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  source: 'finnhub' | 'tradingview' | 'broker';
}

export interface MarketDataSubscription {
  symbols: string[];
  callback: (data: LivePriceData) => void;
  unsubscribe: () => void;
}

class MarketDataService {
  private subscriptions: Map<string, Set<(data: LivePriceData) => void>> = new Map();
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;
  private websocketEnabled = false; // Disable WebSocket by default
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingDelay = 3000; // Poll every 3 seconds for live updates

  /**
   * Get base URL for API calls
   * Returns empty string for client-side (relative URLs work)
   * Returns absolute URL for server-side
   */
  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      // Client-side: use relative URLs
      return '';
    }
    // Server-side: need absolute URL
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback to localhost for development
    return 'http://localhost:3000';
  }

  /**
   * Initialize WebSocket connection for real-time updates
   * Only connects if WebSocket is explicitly enabled
   */
  async connect(): Promise<void> {
    // Don't attempt WebSocket connection if disabled
    if (!this.websocketEnabled) {
      this.startPolling();
      return;
    }

    if (this.websocket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Use server-side WebSocket endpoint
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/api/ws/market-data';
      
      // Check if WebSocket is supported
      if (typeof WebSocket === 'undefined') {
        console.warn('[MarketData] WebSocket not supported, using polling');
        this.isConnecting = false;
        this.startPolling();
        return;
      }

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('[MarketData] WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.stopPolling(); // Stop polling when WebSocket is connected
        this.subscribeToAll();
      };

      this.websocket.onmessage = (event) => {
        try {
          const data: LivePriceData = JSON.parse(event.data);
          this.notifySubscribers(data);
        } catch (error) {
          console.error('[MarketData] Error parsing message:', error);
        }
      };

      this.websocket.onerror = (error) => {
        // Silently handle WebSocket errors - fall back to polling
        this.isConnecting = false;
        this.startPolling();
      };

      this.websocket.onclose = () => {
        this.isConnecting = false;
        // Fall back to polling instead of reconnecting
        this.startPolling();
      };
    } catch (error) {
      // Silently fall back to polling on connection errors
      this.isConnecting = false;
      this.startPolling();
    }
  }

  /**
   * Start polling for price updates (fallback when WebSocket unavailable)
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    const symbols = Array.from(this.subscriptions.keys());
    if (symbols.length === 0) {
      return; // Nothing to poll
    }

    // Poll immediately, then at intervals
    this.pollPrices(symbols);
    
    this.pollingInterval = setInterval(() => {
      const currentSymbols = Array.from(this.subscriptions.keys());
      if (currentSymbols.length > 0) {
        this.pollPrices(currentSymbols);
      } else {
        this.stopPolling();
      }
    }, this.pollingDelay);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll prices for symbols
   */
  private async pollPrices(symbols: string[]): Promise<void> {
    try {
      const prices = await this.getCurrentPrices(symbols);
      prices.forEach((priceData, symbol) => {
        this.notifySubscribers(priceData);
      });
    } catch (error) {
      // Silently handle polling errors
      console.debug('[MarketData] Polling error (non-critical):', error);
    }
  }

  /**
   * Subscribe to live price updates for a symbol
   */
  subscribe(symbol: string, callback: (data: LivePriceData) => void): () => void {
    const upperSymbol = symbol.toUpperCase();
    
    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }

    this.subscriptions.get(upperSymbol)!.add(callback);

    // Start connection/polling if not already active
    if (this.websocketEnabled && this.websocket?.readyState === WebSocket.OPEN) {
      // Send subscription message to server
      this.sendSubscription(upperSymbol, 'subscribe');
    } else {
      // Use polling by default for live updates
      this.connect();
      // Ensure polling starts immediately
      if (!this.pollingInterval) {
        this.startPolling();
      }
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(upperSymbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(upperSymbol);
          if (this.websocket?.readyState === WebSocket.OPEN) {
            this.sendSubscription(upperSymbol, 'unsubscribe');
          }
        }
      }
    };
  }

  /**
   * Subscribe to multiple symbols at once
   */
  subscribeMultiple(
    symbols: string[],
    callback: (data: LivePriceData) => void
  ): () => void {
    const unsubscribers = symbols.map((symbol) => this.subscribe(symbol, callback));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Get current price (fallback to REST API if WebSocket not available)
   */
  async getCurrentPrice(symbol: string): Promise<LivePriceData | null> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/market-data/price/${symbol.toUpperCase()}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        next: { revalidate: 0 },
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        } else {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
        }
      }
      
      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`);
      }
      
      return await response.json();
    } catch (error: any) {
      // Log errors with more context
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Failed to parse URL')) {
        console.error('[MarketData] URL parsing error - this usually means the service is running on server without proper base URL. Error:', errorMessage);
      } else if (process.env.NODE_ENV === 'development') {
        console.debug('[MarketData] Error fetching price:', errorMessage);
      }
      return null;
    }
  }

  /**
   * Get prices for multiple symbols
   */
  async getCurrentPrices(symbols: string[]): Promise<Map<string, LivePriceData>> {
    if (symbols.length === 0) {
      return new Map();
    }

    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/market-data/prices`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbols.map((s) => s.toUpperCase()) }),
        cache: 'no-store',
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        // Silently return empty map on error
        return new Map();
      }

      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Expected JSON but got:', contentType);
        return new Map();
      }

      const data: LivePriceData[] = await response.json();
      const priceMap = new Map<string, LivePriceData>();

      if (Array.isArray(data)) {
        data.forEach((price) => {
          if (price && price.symbol && price.price) {
            priceMap.set(price.symbol, price);
          }
        });
      }

      return priceMap;
    } catch (error) {
      // Silently return empty map on error
      return new Map();
    }
  }

  /**
   * Disconnect WebSocket and stop polling
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.stopPolling();
    this.subscriptions.clear();
  }

  /**
   * Enable WebSocket (call this if you have a WebSocket server)
   */
  enableWebSocket(): void {
    this.websocketEnabled = true;
  }

  /**
   * Disable WebSocket and use polling instead
   */
  disableWebSocket(): void {
    this.websocketEnabled = false;
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.startPolling();
  }

  private notifySubscribers(data: LivePriceData): void {
    const callbacks = this.subscriptions.get(data.symbol);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('[MarketData] Callback error:', error);
        }
      });
    }
  }

  private subscribeToAll(): void {
    const symbols = Array.from(this.subscriptions.keys());
    if (symbols.length > 0) {
      this.sendSubscription(symbols, 'subscribe');
    }
  }

  private sendSubscription(symbols: string | string[], action: 'subscribe' | 'unsubscribe'): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(
        JSON.stringify({
          type: action,
          symbols: Array.isArray(symbols) ? symbols : [symbols],
        })
      );
    }
  }

  private attemptReconnect(): void {
    // Don't attempt reconnection if WebSocket is disabled
    if (!this.websocketEnabled) {
      this.startPolling();
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Fall back to polling after max attempts
      this.startPolling();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();

