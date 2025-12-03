/**
 * Bot Manager
 * Manages active bot instances
 */

import { EventEmitter } from 'events';
import { SignalistBotEngine } from './bot-engine';
import { SignalistBotSettings, UnifiedBrokerAdapter, BotStatus } from '../types';
import { MT5Adapter } from '../adapters/mt5-adapter';
import { DerivAdapter } from '../adapters/deriv-adapter';

export class SignalistBotManager extends EventEmitter {
  private bots: Map<string, SignalistBotEngine> = new Map(); // key: userId
  private adapters: Map<string, UnifiedBrokerAdapter> = new Map(); // key: userId

  /**
   * Start a bot for a user
   */
  async startBot(settings: SignalistBotSettings): Promise<string> {
    const botKey = settings.userId;

    // Check if bot is already running
    if (this.bots.has(botKey)) {
      throw new Error('Bot is already running for this user');
    }

    // Get or create adapter
    let adapter = this.adapters.get(botKey);
    if (!adapter) {
      adapter = await this.createAdapter(settings);
      this.adapters.set(botKey, adapter);
    }

    // Create bot engine
    const bot = new SignalistBotEngine(settings, adapter);

    // Set up event forwarding
    bot.on('trade_opened', (event) => this.emit('trade_opened', event));
    bot.on('trade_closed', (event) => this.emit('trade_closed', event));
    bot.on('signal_detected', (event) => this.emit('signal_detected', event));
    bot.on('stop_triggered', (event) => this.emit('stop_triggered', event));
    bot.on('error', (event) => this.emit('error', event));
    bot.on('status_update', (event) => this.emit('status_update', event));
    bot.on('candle_processed', (event) => this.emit('candle_processed', event));

    // Start bot
    await bot.start();

    this.bots.set(botKey, bot);

    return botKey;
  }

  /**
   * Stop a bot for a user
   */
  async stopBot(userId: string, reason?: string): Promise<boolean> {
    const bot = this.bots.get(userId);
    if (!bot) {
      return false;
    }

    await bot.stop(reason);
    this.bots.delete(userId);

    // Clean up adapter
    const adapter = this.adapters.get(userId);
    if (adapter) {
      await adapter.disconnect().catch(console.error);
      this.adapters.delete(userId);
    }

    return true;
  }

  /**
   * Get bot status
   */
  getBotStatus(userId: string): BotStatus | null {
    const bot = this.bots.get(userId);
    if (!bot) {
      return null;
    }
    return bot.getStatus();
  }

  /**
   * Check if bot is running
   */
  isBotRunning(userId: string): boolean {
    return this.bots.has(userId);
  }

  /**
   * Update bot settings
   */
  async updateBotSettings(userId: string, settings: Partial<SignalistBotSettings>): Promise<boolean> {
    const bot = this.bots.get(userId);
    if (!bot) {
      return false;
    }

    bot.updateSettings(settings);
    return true;
  }

  /**
   * Pause bot
   */
  pauseBot(userId: string): boolean {
    const bot = this.bots.get(userId);
    if (!bot) {
      return false;
    }
    bot.pause();
    return true;
  }

  /**
   * Resume bot
   */
  resumeBot(userId: string): boolean {
    const bot = this.bots.get(userId);
    if (!bot) {
      return false;
    }
    bot.resume();
    return true;
  }

  /**
   * Create adapter based on settings
   */
  private async createAdapter(settings: SignalistBotSettings): Promise<UnifiedBrokerAdapter> {
    if (settings.broker === 'exness') {
      const adapter = new MT5Adapter();
      await adapter.initialize({
        broker: 'exness',
        mt5Login: settings.mt5Login,
        mt5Password: settings.mt5Password,
        mt5Server: settings.mt5Server,
        mt5MagicNumber: settings.magicNumber,
        paperTrading: false, // Can be configured
        environment: 'live',
      });
      return adapter;
    } else {
      const adapter = new DerivAdapter();
      await adapter.initialize({
        broker: 'deriv',
        derivToken: settings.derivToken,
        derivAppId: process.env.DERIV_APP_ID || '113058',
        paperTrading: false,
        environment: 'live',
      });
      return adapter;
    }
  }

  /**
   * Stop all bots
   */
  async stopAllBots(): Promise<void> {
    const userIds = Array.from(this.bots.keys());
    await Promise.all(userIds.map((userId) => this.stopBot(userId, 'System shutdown')));
  }
}

// Singleton instance
export const botManager = new SignalistBotManager();

