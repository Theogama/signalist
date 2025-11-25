/**
 * Automation Manager
 * Handles automated bot operations: scheduling, auto-start/stop, recovery, and performance adjustments
 */

import { botManager } from '@/lib/services/bot-manager.service';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';

export interface AutomationRule {
  id: string;
  userId: string;
  botId: string;
  type: 'schedule' | 'profit_target' | 'loss_limit' | 'time_limit' | 'recovery';
  enabled: boolean;
  conditions: AutomationConditions;
  actions: AutomationActions;
}

export interface AutomationConditions {
  // Schedule conditions
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  
  // Profit/Loss conditions
  profitTarget?: number; // USD or %
  lossLimit?: number; // USD or %
  profitPercent?: number;
  lossPercent?: number;
  
  // Time conditions
  maxRuntime?: number; // minutes
  minRuntime?: number; // minutes
  
  // Recovery conditions
  maxErrors?: number;
  errorCooldown?: number; // seconds
  autoRestart?: boolean;
}

export interface AutomationActions {
  startBot?: boolean;
  stopBot?: boolean;
  adjustRisk?: {
    increase?: number; // %
    decrease?: number; // %
  };
  notify?: boolean;
  logAction?: boolean;
}

class AutomationManager {
  private rules: Map<string, AutomationRule> = new Map();
  private activeSchedules: Map<string, NodeJS.Timeout> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private errorCounts: Map<string, { count: number; lastError: Date }> = new Map();

  /**
   * Register an automation rule
   */
  registerRule(rule: AutomationRule): void {
    this.rules.set(rule.id, rule);
    
    if (rule.enabled) {
      this.activateRule(rule);
    }
  }

  /**
   * Activate a rule
   */
  private activateRule(rule: AutomationRule): void {
    switch (rule.type) {
      case 'schedule':
        this.activateSchedule(rule);
        break;
      case 'profit_target':
      case 'loss_limit':
      case 'time_limit':
        this.startMonitoring(rule);
        break;
      case 'recovery':
        // Recovery is handled automatically
        break;
    }
  }

  /**
   * Activate schedule-based automation
   */
  private activateSchedule(rule: AutomationRule): void {
    const scheduleKey = `${rule.userId}-${rule.botId}`;
    
    // Clear existing schedule
    if (this.activeSchedules.has(scheduleKey)) {
      clearTimeout(this.activeSchedules.get(scheduleKey)!);
    }

    const now = new Date();
    const startTime = this.parseTime(rule.conditions.startTime || '09:00');
    const endTime = this.parseTime(rule.conditions.endTime || '17:00');

    // Check if we're within trading hours
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startTime.hours * 60 + startTime.minutes;
    const endMinutes = endTime.hours * 60 + endTime.minutes;

    // Check day of week
    const dayOfWeek = now.getDay();
    const allowedDays = rule.conditions.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    
    if (!allowedDays.includes(dayOfWeek)) {
      return; // Not a trading day
    }

    // Schedule start
    if (currentTime < startMinutes) {
      const delay = (startMinutes - currentTime) * 60 * 1000;
      const timeout = setTimeout(() => {
        this.executeAction(rule, 'start');
      }, delay);
      this.activeSchedules.set(`${scheduleKey}-start`, timeout);
    } else if (currentTime >= startMinutes && currentTime < endMinutes) {
      // Start immediately if within hours
      this.executeAction(rule, 'start');
    }

    // Schedule stop
    if (currentTime < endMinutes) {
      const delay = (endMinutes - currentTime) * 60 * 1000;
      const timeout = setTimeout(() => {
        this.executeAction(rule, 'stop');
      }, delay);
      this.activeSchedules.set(`${scheduleKey}-stop`, timeout);
    }
  }

  /**
   * Start monitoring for profit/loss/time conditions
   */
  private startMonitoring(rule: AutomationRule): void {
    const monitorKey = `${rule.userId}-${rule.botId}`;
    
    // Clear existing monitoring
    if (this.monitoringIntervals.has(monitorKey)) {
      clearInterval(this.monitoringIntervals.get(monitorKey)!);
    }

    // Check every 10 seconds
    const interval = setInterval(async () => {
      await this.checkConditions(rule);
    }, 10000);

    this.monitoringIntervals.set(monitorKey, interval);
  }

  /**
   * Check if conditions are met
   */
  private async checkConditions(rule: AutomationRule): Promise<void> {
    const bot = botManager.getUserBots(rule.userId).find(b => b.botId === rule.botId);
    if (!bot) return;

    const conditions = rule.conditions;
    let shouldAct = false;
    let actionType: 'start' | 'stop' | 'adjust' = 'stop';

    // Check profit target
    if (conditions.profitTarget || conditions.profitPercent) {
      const balance = bot.paperTrader?.getBalance() || { balance: 0, equity: 0 };
      const initialBalance = bot.paperTrader?.getInitialBalance() || 10000;
      const profit = balance.equity - initialBalance;
      
      if (conditions.profitTarget && profit >= conditions.profitTarget) {
        shouldAct = true;
        actionType = 'stop';
      } else if (conditions.profitPercent) {
        const profitPercent = ((balance.equity - initialBalance) / initialBalance) * 100;
        if (profitPercent >= conditions.profitPercent) {
          shouldAct = true;
          actionType = 'stop';
        }
      }
    }

    // Check loss limit
    if (conditions.lossLimit || conditions.lossPercent) {
      const balance = bot.paperTrader?.getBalance() || { balance: 0, equity: 0 };
      const initialBalance = bot.paperTrader?.getInitialBalance() || 10000;
      const loss = initialBalance - balance.equity;
      
      if (conditions.lossLimit && loss >= conditions.lossLimit) {
        shouldAct = true;
        actionType = 'stop';
      } else if (conditions.lossPercent) {
        const lossPercent = ((initialBalance - balance.equity) / initialBalance) * 100;
        if (lossPercent >= conditions.lossPercent) {
          shouldAct = true;
          actionType = 'stop';
        }
      }
    }

    // Check time limit
    if (conditions.maxRuntime && bot.startedAt) {
      const runtime = (Date.now() - bot.startedAt.getTime()) / (1000 * 60); // minutes
      if (runtime >= conditions.maxRuntime) {
        shouldAct = true;
        actionType = 'stop';
      }
    }

    if (shouldAct) {
      await this.executeAction(rule, actionType);
    }
  }

  /**
   * Execute automation action
   */
  private async executeAction(rule: AutomationRule, actionType: 'start' | 'stop' | 'adjust'): Promise<void> {
    const actions = rule.actions;
    
    try {
      if (actionType === 'start' && actions.startBot) {
        // Bot start is handled by the API endpoint
        logEmitter.info(
          `[Automation] Auto-start triggered for bot ${rule.botId}`,
          rule.userId,
          { ruleId: rule.id, type: rule.type }
        );
      } else if (actionType === 'stop' && actions.stopBot) {
        botManager.stopBot(rule.userId, rule.botId);
        logEmitter.info(
          `[Automation] Auto-stop triggered for bot ${rule.botId}`,
          rule.userId,
          { ruleId: rule.id, type: rule.type }
        );
      } else if (actionType === 'adjust' && actions.adjustRisk) {
        // Risk adjustment would be handled by updating bot parameters
        logEmitter.info(
          `[Automation] Risk adjustment triggered for bot ${rule.botId}`,
          rule.userId,
          { ruleId: rule.id, adjustment: actions.adjustRisk }
        );
      }

      if (actions.notify) {
        // Send notification (could integrate with email/push notifications)
        logEmitter.warning(
          `[Automation] Notification: ${rule.type} condition met for bot ${rule.botId}`,
          rule.userId
        );
      }
    } catch (error: any) {
      logEmitter.error(
        `[Automation] Error executing action: ${error.message}`,
        rule.userId,
        { ruleId: rule.id, error: error.message }
      );
    }
  }

  /**
   * Handle bot error and recovery
   */
  handleError(userId: string, botId: string, error: Error): void {
    const errorKey = `${userId}-${botId}`;
    const errorInfo = this.errorCounts.get(errorKey) || { count: 0, lastError: new Date() };
    
    errorInfo.count++;
    errorInfo.lastError = new Date();

    // Find recovery rules
    const recoveryRules = Array.from(this.rules.values()).filter(
      r => r.userId === userId && r.botId === botId && r.type === 'recovery' && r.enabled
    );

    for (const rule of recoveryRules) {
      const conditions = rule.conditions;
      
      // Check max errors
      if (conditions.maxErrors && errorInfo.count >= conditions.maxErrors) {
        if (conditions.autoRestart) {
          // Wait for cooldown before restarting
          const cooldown = (conditions.errorCooldown || 60) * 1000;
          setTimeout(() => {
            logEmitter.info(
              `[Automation] Auto-recovery: Restarting bot ${botId} after ${errorInfo.count} errors`,
              userId
            );
            // Restart would be handled by the API
          }, cooldown);
        } else {
          // Stop bot on too many errors
          botManager.stopBot(userId, botId);
          logEmitter.error(
            `[Automation] Bot ${botId} stopped due to ${errorInfo.count} errors`,
            userId
          );
        }
      }
    }

    this.errorCounts.set(errorKey, errorInfo);
  }

  /**
   * Reset error count (called on successful bot operation)
   */
  resetErrorCount(userId: string, botId: string): void {
    const errorKey = `${userId}-${botId}`;
    this.errorCounts.delete(errorKey);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const scheduleKey = `${rule.userId}-${rule.botId}`;
      const monitorKey = `${rule.userId}-${rule.botId}`;
      
      // Clear schedules
      this.activeSchedules.forEach((timeout, key) => {
        if (key.startsWith(scheduleKey)) {
          clearTimeout(timeout);
          this.activeSchedules.delete(key);
        }
      });

      // Clear monitoring
      if (this.monitoringIntervals.has(monitorKey)) {
        clearInterval(this.monitoringIntervals.get(monitorKey)!);
        this.monitoringIntervals.delete(monitorKey);
      }
    }

    this.rules.delete(ruleId);
  }

  /**
   * Get all rules for a user/bot
   */
  getRules(userId: string, botId?: string): AutomationRule[] {
    const allRules = Array.from(this.rules.values());
    return allRules.filter(r => 
      r.userId === userId && (!botId || r.botId === botId)
    );
  }

  /**
   * Enable/disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      if (enabled) {
        this.activateRule(rule);
      } else {
        this.removeRule(ruleId);
        this.rules.set(ruleId, rule); // Re-add without activating
      }
    }
  }

  /**
   * Parse time string (HH:mm) to hours and minutes
   */
  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  /**
   * Cleanup all automation for a user
   */
  cleanup(userId: string): void {
    const userRules = this.getRules(userId);
    userRules.forEach(rule => this.removeRule(rule.id));
  }
}

export const automationManager = new AutomationManager();


