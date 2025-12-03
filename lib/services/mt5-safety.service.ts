/**
 * MT5 Bot Safety Service
 * Implements safety checks before placing trades
 */

interface SafetyCheck {
  passed: boolean;
  error?: string;
}

interface SafetyConfig {
  maxDailyTrades: number;
  maxDailyLoss: number;
  minMarginLevel: number;
  maxPositionSize: number;
  newsFilter: boolean;
}

export class MT5SafetyService {
  private dailyTradeCount: number = 0;
  private dailyLoss: number = 0;
  private lastTradeDate: string = '';

  /**
   * Check if trade can be placed
   */
  async checkTradeSafety(
    connectionId: string,
    symbol: string,
    volume: number,
    accountInfo: any,
    settings: any
  ): Promise<SafetyCheck> {
    // Reset daily counters if new day
    const today = new Date().toDateString();
    if (this.lastTradeDate !== today) {
      this.dailyTradeCount = 0;
      this.dailyLoss = 0;
      this.lastTradeDate = today;
    }

    // Check 1: Over-trading protection
    if (settings.maxDailyTrades > 0 && this.dailyTradeCount >= settings.maxDailyTrades) {
      return {
        passed: false,
        error: `Maximum daily trades (${settings.maxDailyTrades}) reached`,
      };
    }

    // Check 2: Max daily loss
    if (settings.maxDailyLoss > 0) {
      const lossPercent = (Math.abs(this.dailyLoss) / accountInfo.balance) * 100;
      if (lossPercent >= settings.maxDailyLoss) {
        return {
          passed: false,
          error: `Maximum daily loss (${settings.maxDailyLoss}%) reached`,
        };
      }
    }

    // Check 3: Lot size validity
    if (volume <= 0 || volume > 100) {
      return {
        passed: false,
        error: `Invalid lot size: ${volume}. Must be between 0.01 and 100`,
      };
    }

    // Check 4: Margin availability
    const requiredMargin = this.calculateRequiredMargin(symbol, volume, accountInfo);
    if (accountInfo.freeMargin < requiredMargin) {
      return {
        passed: false,
        error: `Insufficient margin. Required: ${requiredMargin.toFixed(2)}, Available: ${accountInfo.freeMargin.toFixed(2)}`,
      };
    }

    // Check 5: Margin level
    const marginLevel = accountInfo.marginLevel;
    if (marginLevel < 100) {
      return {
        passed: false,
        error: `Margin level too low: ${marginLevel.toFixed(1)}%. Minimum: 100%`,
      };
    }

    // Check 6: News filter (if enabled)
    if (settings.newsFilter) {
      const isNewsTime = await this.checkNewsTime();
      if (isNewsTime) {
        return {
          passed: false,
          error: 'Trading paused due to high-impact news event',
        };
      }
    }

    return { passed: true };
  }

  /**
   * Calculate required margin for a trade
   */
  private calculateRequiredMargin(symbol: string, volume: number, accountInfo: any): number {
    // Simplified margin calculation
    // In production, use MT5 symbol info for contract size and margin requirements
    const contractSize = 100000; // Standard lot size
    const leverage = accountInfo.leverage || 500;
    const marginRequired = (contractSize * volume) / leverage;
    return marginRequired;
  }

  /**
   * Check if current time is during high-impact news
   */
  private async checkNewsTime(): Promise<boolean> {
    // Simplified news filter
    // In production, integrate with economic calendar API
    const now = new Date();
    const hour = now.getHours();
    
    // High-impact news typically at 8:30 AM, 10:00 AM, 2:00 PM EST
    // This is a simplified check - implement proper news calendar in production
    return false;
  }

  /**
   * Record a trade for daily tracking
   */
  recordTrade(profit: number) {
    const today = new Date().toDateString();
    if (this.lastTradeDate !== today) {
      this.dailyTradeCount = 0;
      this.dailyLoss = 0;
      this.lastTradeDate = today;
    }

    this.dailyTradeCount++;
    if (profit < 0) {
      this.dailyLoss += profit;
    }
  }

  /**
   * Get daily statistics
   */
  getDailyStats() {
    return {
      tradeCount: this.dailyTradeCount,
      dailyLoss: this.dailyLoss,
      date: this.lastTradeDate,
    };
  }

  /**
   * Check if MT5 connection is active
   */
  async checkConnection(connectionId: string): Promise<SafetyCheck> {
    try {
      const response = await fetch(`/api/mt5/account?connection_id=${connectionId}`);
      const data = await response.json();

      if (!data.success) {
        return {
          passed: false,
          error: 'MT5 connection lost. Please reconnect.',
        };
      }

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        error: 'Failed to verify MT5 connection',
      };
    }
  }
}

export const mt5SafetyService = new MT5SafetyService();

