/**
 * Deriv Market Status Detection Service
 * Detects market status (Open, Closed, Suspended) using Deriv API
 * Blocks trade execution when market is not tradable
 * Emits alerts for market status changes
 */

import { EventEmitter } from 'events';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { decrypt } from '@/lib/utils/encryption';

/**
 * Market Status Enum
 */
export enum MarketStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
  UNKNOWN = 'unknown',
}

/**
 * Market Status Details
 */
export interface MarketStatusResult {
  status: MarketStatus;
  symbol: string;
  isTradable: boolean;
  reason?: string;
  nextOpen?: Date;
  lastChecked: Date;
  source: 'api' | 'trading-hours' | 'fallback';
  metadata?: {
    marketOpenTime?: Date;
    marketCloseTime?: Date;
    timezone?: string;
    tradingDays?: string[];
  };
}

/**
 * Market Status Alert
 */
export interface MarketStatusAlert {
  symbol: string;
  previousStatus: MarketStatus;
  currentStatus: MarketStatus;
  timestamp: Date;
  message: string;
  isTradable: boolean;
}

/**
 * Trading Hours Configuration
 * Used as fallback when API is unavailable
 */
interface TradingHoursConfig {
  symbol: string;
  marketType: 'synthetic' | 'forex' | 'crypto' | 'commodities';
  tradingDays: number[]; // 0 = Sunday, 6 = Saturday
  openTime?: string; // HH:MM format
  closeTime?: string; // HH:MM format
  timezone?: string; // Default: UTC
  is24Hours?: boolean; // For synthetic indices
}

/**
 * Deriv Market Status Service
 * Singleton service for market status detection
 */
export class DerivMarketStatusService extends EventEmitter {
  private static instance: DerivMarketStatusService;
  private statusCache: Map<string, { result: MarketStatusResult; expiresAt: Date }> = new Map();
  private cacheTTL = 60000; // 1 minute cache
  private wsClient: DerivServerWebSocketClient | null = null;
  private userId: string | null = null;

  // Trading hours configuration for fallback
  private tradingHoursConfig: Map<string, TradingHoursConfig> = new Map([
    // Synthetic Indices (24/7)
    ['BOOM1000', { symbol: 'BOOM1000', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['BOOM500', { symbol: 'BOOM500', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['BOOM300', { symbol: 'BOOM300', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['BOOM100', { symbol: 'BOOM100', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['CRASH1000', { symbol: 'CRASH1000', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['CRASH500', { symbol: 'CRASH500', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['CRASH300', { symbol: 'CRASH300', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    ['CRASH100', { symbol: 'CRASH100', marketType: 'synthetic', tradingDays: [0, 1, 2, 3, 4, 5, 6], is24Hours: true }],
    // Forex (Sunday 22:00 GMT - Friday 22:00 GMT)
    ['R_10', { symbol: 'R_10', marketType: 'forex', tradingDays: [0, 1, 2, 3, 4, 5], openTime: '22:00', closeTime: '22:00', timezone: 'GMT' }],
    ['R_25', { symbol: 'R_25', marketType: 'forex', tradingDays: [0, 1, 2, 3, 4, 5], openTime: '22:00', closeTime: '22:00', timezone: 'GMT' }],
    ['R_50', { symbol: 'R_50', marketType: 'forex', tradingDays: [0, 1, 2, 3, 4, 5], openTime: '22:00', closeTime: '22:00', timezone: 'GMT' }],
    ['R_100', { symbol: 'R_100', marketType: 'forex', tradingDays: [0, 1, 2, 3, 4, 5], openTime: '22:00', closeTime: '22:00', timezone: 'GMT' }],
  ]);

  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DerivMarketStatusService {
    if (!DerivMarketStatusService.instance) {
      DerivMarketStatusService.instance = new DerivMarketStatusService();
    }
    return DerivMarketStatusService.instance;
  }

  /**
   * Initialize service with user token
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    
    try {
      await connectToDatabase();
      const tokenDoc = await DerivApiToken.findOne({ userId, isValid: true });
      
      if (tokenDoc) {
        const token = await decrypt(tokenDoc.token);
        this.wsClient = new DerivServerWebSocketClient(token);
        await this.wsClient.connect();
      }
    } catch (error) {
      console.warn('[MarketStatus] Failed to initialize WebSocket client, using fallback:', error);
      // Continue with fallback mode
    }
  }

  /**
   * Get market status for a symbol
   * Main method for checking market status
   * 
   * @param symbol - Trading symbol (e.g., 'BOOM1000', 'R_10')
   * @returns Market status result
   */
  async getMarketStatus(symbol: string): Promise<MarketStatusResult> {
    // Check cache first
    const cached = this.statusCache.get(symbol);
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    let result: MarketStatusResult;

    try {
      // Try API-based detection first
      if (this.wsClient && this.wsClient.isConnected()) {
        result = await this.getMarketStatusFromAPI(symbol);
      } else {
        // Fallback to trading hours logic
        result = await this.getMarketStatusFromTradingHours(symbol);
      }
    } catch (error: any) {
      console.error(`[MarketStatus] Error checking status for ${symbol}:`, error);
      // Fallback to trading hours on error
      result = await this.getMarketStatusFromTradingHours(symbol);
    }

    // Cache result
    this.statusCache.set(symbol, {
      result,
      expiresAt: new Date(Date.now() + this.cacheTTL),
    });

    // Emit alert if market is not tradable
    if (!result.isTradable) {
      this.emitMarketStatusAlert(symbol, result.status, result);
    }

    return result;
  }

  /**
   * Get market status from Deriv API
   * Attempts to get proposal or check symbol availability
   */
  private async getMarketStatusFromAPI(symbol: string): Promise<MarketStatusResult> {
    if (!this.wsClient) {
      throw new Error('WebSocket client not initialized');
    }

    try {
      // Method 1: Try to get a proposal (tests if market is open)
      // This is a read-only operation that doesn't execute a trade
      const proposalResult = await this.testProposal(symbol);

      if (proposalResult.success) {
        return {
          status: MarketStatus.OPEN,
          symbol,
          isTradable: true,
          lastChecked: new Date(),
          source: 'api',
          metadata: {
            timezone: 'UTC',
          },
        };
      }

      // Method 2: Check for specific error codes
      if (proposalResult.error) {
        const errorCode = proposalResult.error.code?.toLowerCase() || '';
        const errorMessage = proposalResult.error.message?.toLowerCase() || '';

        // Market closed errors
        if (errorCode.includes('market_closed') || errorMessage.includes('market closed')) {
          return {
            status: MarketStatus.CLOSED,
            symbol,
            isTradable: false,
            reason: 'Market is currently closed',
            lastChecked: new Date(),
            source: 'api',
          };
        }

        // Market suspended errors
        if (errorCode.includes('suspended') || errorMessage.includes('suspended')) {
          return {
            status: MarketStatus.SUSPENDED,
            symbol,
            isTradable: false,
            reason: 'Market is currently suspended',
            lastChecked: new Date(),
            source: 'api',
          };
        }

        // Symbol not found
        if (errorCode.includes('symbol') || errorMessage.includes('symbol')) {
          return {
            status: MarketStatus.CLOSED,
            symbol,
            isTradable: false,
            reason: 'Symbol not available',
            lastChecked: new Date(),
            source: 'api',
          };
        }
      }

      // If we can't determine from proposal, fall back to trading hours
      return await this.getMarketStatusFromTradingHours(symbol);
    } catch (error: any) {
      console.error(`[MarketStatus] API check failed for ${symbol}:`, error);
      // Fallback to trading hours
      return await this.getMarketStatusFromTradingHours(symbol);
    }
  }

  /**
   * Test proposal to check if market is open
   */
  private async testProposal(symbol: string): Promise<{
    success: boolean;
    error?: { code?: string; message?: string };
  }> {
    if (!this.wsClient) {
      return { success: false, error: { message: 'WebSocket not connected' } };
    }

    return new Promise((resolve) => {
      const reqId = Math.floor(Math.random() * 1000000);
      const timeout = setTimeout(() => {
        resolve({ success: false, error: { message: 'Proposal timeout' } });
      }, 5000);

      // Send proposal request (read-only, doesn't execute trade)
      (this.wsClient as any).sendMessage({
        proposal: 1,
        amount: 1,
        basis: 'stake',
        contract_type: 'CALL',
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
        symbol,
        req_id: reqId,
      });

      // Listen for response
      const handler = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          (this.wsClient as any).removeListener('message', handler);

          if (data.proposal) {
            resolve({ success: true });
          } else if (data.error) {
            resolve({ success: false, error: data.error });
          } else {
            resolve({ success: false, error: { message: 'Unknown response' } });
          }
        }
      };

      (this.wsClient as any).on('message', handler);
    });
  }

  /**
   * Get market status from trading hours logic (fallback)
   */
  private async getMarketStatusFromTradingHours(symbol: string): Promise<MarketStatusResult> {
    const config = this.tradingHoursConfig.get(symbol);
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute; // Minutes since midnight

    // Default: assume closed if no config
    if (!config) {
      return {
        status: MarketStatus.UNKNOWN,
        symbol,
        isTradable: false,
        reason: 'Symbol configuration not found',
        lastChecked: now,
        source: 'fallback',
      };
    }

    // Synthetic indices are 24/7
    if (config.is24Hours) {
      return {
        status: MarketStatus.OPEN,
        symbol,
        isTradable: true,
        lastChecked: now,
        source: 'trading-hours',
        metadata: {
          timezone: config.timezone || 'UTC',
          tradingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        },
      };
    }

    // Check trading days
    if (!config.tradingDays.includes(day)) {
      const nextTradingDay = this.getNextTradingDay(day, config.tradingDays);
      return {
        status: MarketStatus.CLOSED,
        symbol,
        isTradable: false,
        reason: `Market closed. Trading days: ${config.tradingDays.map(d => this.getDayName(d)).join(', ')}`,
        nextOpen: nextTradingDay,
        lastChecked: now,
        source: 'trading-hours',
        metadata: {
          tradingDays: config.tradingDays.map(d => this.getDayName(d)),
          timezone: config.timezone || 'UTC',
        },
      };
    }

    // Check trading hours
    if (config.openTime && config.closeTime) {
      const [openHour, openMinute] = config.openTime.split(':').map(Number);
      const [closeHour, closeMinute] = config.closeTime.split(':').map(Number);
      const openTime = openHour * 60 + openMinute;
      const closeTime = closeHour * 60 + closeMinute;

      // Handle overnight trading (e.g., Sunday 22:00 - Friday 22:00)
      if (closeTime < openTime) {
        // Overnight: open until close time next day, or after open time today
        const isOpen = currentTime >= openTime || currentTime < closeTime;
        
        if (!isOpen) {
          const nextOpen = new Date(now);
          if (currentTime < openTime) {
            nextOpen.setHours(openHour, openMinute, 0, 0);
          } else {
            nextOpen.setDate(now.getDate() + 1);
            nextOpen.setHours(openHour, openMinute, 0, 0);
          }

          return {
            status: MarketStatus.CLOSED,
            symbol,
            isTradable: false,
            reason: `Market closed. Trading hours: ${config.openTime} - ${config.closeTime} ${config.timezone || 'UTC'}`,
            nextOpen,
            lastChecked: now,
            source: 'trading-hours',
            metadata: {
              marketOpenTime: new Date(now.setHours(openHour, openMinute, 0, 0)),
              marketCloseTime: new Date(now.setHours(closeHour, closeMinute, 0, 0)),
              timezone: config.timezone || 'UTC',
              tradingDays: config.tradingDays.map(d => this.getDayName(d)),
            },
          };
        }
      } else {
        // Normal hours: open between open and close
        const isOpen = currentTime >= openTime && currentTime < closeTime;
        
        if (!isOpen) {
          const nextOpen = new Date(now);
          if (currentTime < openTime) {
            nextOpen.setHours(openHour, openMinute, 0, 0);
          } else {
            nextOpen.setDate(now.getDate() + 1);
            nextOpen.setHours(openHour, openMinute, 0, 0);
          }

          return {
            status: MarketStatus.CLOSED,
            symbol,
            isTradable: false,
            reason: `Market closed. Trading hours: ${config.openTime} - ${config.closeTime} ${config.timezone || 'UTC'}`,
            nextOpen,
            lastChecked: now,
            source: 'trading-hours',
            metadata: {
              marketOpenTime: new Date(now.setHours(openHour, openMinute, 0, 0)),
              marketCloseTime: new Date(now.setHours(closeHour, closeMinute, 0, 0)),
              timezone: config.timezone || 'UTC',
              tradingDays: config.tradingDays.map(d => this.getDayName(d)),
            },
          };
        }
      }
    }

    // Market is open
    return {
      status: MarketStatus.OPEN,
      symbol,
      isTradable: true,
      lastChecked: now,
      source: 'trading-hours',
      metadata: {
        timezone: config.timezone || 'UTC',
        tradingDays: config.tradingDays.map(d => this.getDayName(d)),
      },
    };
  }

  /**
   * Get next trading day
   */
  private getNextTradingDay(currentDay: number, tradingDays: number[]): Date {
    const next = new Date();
    let daysToAdd = 1;
    
    while (daysToAdd < 7) {
      const nextDay = (currentDay + daysToAdd) % 7;
      if (tradingDays.includes(nextDay)) {
        next.setDate(next.getDate() + daysToAdd);
        return next;
      }
      daysToAdd++;
    }
    
    return next;
  }

  /**
   * Get day name from day number
   */
  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }

  /**
   * Emit market status alert
   */
  private emitMarketStatusAlert(
    symbol: string,
    status: MarketStatus,
    result: MarketStatusResult
  ): void {
    const alert: MarketStatusAlert = {
      symbol,
      previousStatus: MarketStatus.OPEN, // Could track previous status
      currentStatus: status,
      timestamp: new Date(),
      message: result.reason || `Market is ${status}`,
      isTradable: result.isTradable,
    };

    this.emit('market_status_alert', alert);
    this.emit('market_not_tradable', { symbol, status, reason: result.reason });
  }

  /**
   * Check if market is tradable (convenience method)
   */
  async isMarketTradable(symbol: string): Promise<boolean> {
    const status = await this.getMarketStatus(symbol);
    return status.isTradable;
  }

  /**
   * Clear cache
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.statusCache.delete(symbol);
    } else {
      this.statusCache.clear();
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.wsClient) {
      try {
        await this.wsClient.disconnect();
      } catch (error) {
        console.error('[MarketStatus] Error disconnecting:', error);
      }
      this.wsClient = null;
    }
    this.statusCache.clear();
  }
}

// Export singleton instance
export const marketStatusService = DerivMarketStatusService.getInstance();

