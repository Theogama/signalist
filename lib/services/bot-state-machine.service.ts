/**
 * Bot State Machine Service
 * 
 * Implements explicit state machine for bot execution with transition guards.
 * Prevents invalid state transitions and ensures bot lifecycle integrity.
 * 
 * Bot States:
 * - IDLE: Bot is stopped, not executing
 * - STARTING: Bot is initializing (connecting, setting up)
 * - RUNNING: Bot is active and executing trading cycles
 * - IN_TRADE: Bot has an open trade (blocks new trades)
 * - STOPPING: Bot is shutting down gracefully
 * - ERROR: Bot encountered an error and stopped
 * - PAUSED: Bot is temporarily paused (circuit breaker, market closed, etc.)
 * 
 * State Transitions:
 * IDLE -> STARTING -> RUNNING -> IN_TRADE -> RUNNING (loop)
 * RUNNING -> STOPPING -> IDLE
 * RUNNING -> PAUSED -> RUNNING (recovery)
 * RUNNING -> ERROR -> IDLE
 * Any -> STOPPING -> IDLE (emergency stop)
 */

import { EventEmitter } from 'events';

/**
 * Bot State Enum
 */
export enum BotState {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  IN_TRADE = 'IN_TRADE',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
  PAUSED = 'PAUSED',
}

/**
 * State Transition
 */
export interface StateTransition {
  from: BotState;
  to: BotState;
  guard?: () => boolean | Promise<boolean>; // Optional guard function
  onTransition?: () => void | Promise<void>; // Optional callback
}

/**
 * State Machine Configuration
 */
export interface StateMachineConfig {
  botId: string;
  userId: string;
  onStateChange?: (from: BotState, to: BotState) => void;
}

/**
 * State Machine Status
 */
export interface StateMachineStatus {
  currentState: BotState;
  previousState?: BotState;
  lastTransition?: Date;
  transitionCount: number;
  errorCount: number;
  lastError?: string;
}

/**
 * Valid State Transitions
 * Defines which state transitions are allowed
 */
const VALID_TRANSITIONS: Map<BotState, BotState[]> = new Map([
  // From IDLE
  [BotState.IDLE, [BotState.STARTING]],
  
  // From STARTING
  [BotState.STARTING, [BotState.RUNNING, BotState.ERROR, BotState.IDLE]],
  
  // From RUNNING
  [BotState.RUNNING, [
    BotState.IN_TRADE,    // Trade opened
    BotState.PAUSED,      // Paused (circuit breaker, market closed, etc.)
    BotState.STOPPING,    // User stop or error
    BotState.ERROR,       // Critical error
  ]],
  
  // From IN_TRADE
  [BotState.IN_TRADE, [
    BotState.RUNNING,     // Trade closed, continue
    BotState.STOPPING,    // User stop during trade
    BotState.ERROR,       // Error during trade
  ]],
  
  // From PAUSED
  [BotState.PAUSED, [
    BotState.RUNNING,     // Resume after pause
    BotState.STOPPING,    // Stop while paused
    BotState.IDLE,        // Stop and reset
  ]],
  
  // From STOPPING
  [BotState.STOPPING, [BotState.IDLE]],
  
  // From ERROR
  [BotState.ERROR, [BotState.IDLE, BotState.STARTING]], // Can restart after error
]);

/**
 * State Transition Guards
 * Additional validation before allowing transitions
 */
const TRANSITION_GUARDS: Map<string, () => boolean | Promise<boolean>> = new Map([
  // IDLE -> STARTING: Always allowed
  [`${BotState.IDLE}->${BotState.STARTING}`, () => true],
  
  // STARTING -> RUNNING: Check initialization complete
  [`${BotState.STARTING}->${BotState.RUNNING}`, () => true], // Will be validated by caller
  
  // RUNNING -> IN_TRADE: Check not already in trade
  [`${BotState.RUNNING}->${BotState.IN_TRADE}`, () => true], // Will be validated by caller
  
  // IN_TRADE -> RUNNING: Check trade closed
  [`${BotState.IN_TRADE}->${BotState.RUNNING}`, () => true], // Will be validated by caller
  
  // RUNNING -> PAUSED: Always allowed (safety mechanism)
  [`${BotState.RUNNING}->${BotState.PAUSED}`, () => true],
  
  // PAUSED -> RUNNING: Check conditions (circuit breaker, market status)
  [`${BotState.PAUSED}->${BotState.RUNNING}`, () => true], // Will be validated by caller
  
  // Any -> STOPPING: Always allowed (emergency stop)
  [`*->${BotState.STOPPING}`, () => true],
  
  // STOPPING -> IDLE: Always allowed
  [`${BotState.STOPPING}->${BotState.IDLE}`, () => true],
  
  // ERROR -> IDLE: Always allowed
  [`${BotState.ERROR}->${BotState.IDLE}`, () => true],
  
  // ERROR -> STARTING: Allowed for recovery
  [`${BotState.ERROR}->${BotState.STARTING}`, () => true],
]);

/**
 * Bot State Machine
 * Manages bot state transitions with validation
 */
export class BotStateMachine extends EventEmitter {
  private static instances: Map<string, BotStateMachine> = new Map();
  
  private config: StateMachineConfig;
  private currentState: BotState = BotState.IDLE;
  private previousState?: BotState;
  private lastTransition?: Date;
  private transitionCount: number = 0;
  private errorCount: number = 0;
  private lastError?: string;
  private transitionHistory: Array<{
    from: BotState;
    to: BotState;
    timestamp: Date;
    reason?: string;
  }> = [];

  private constructor(config: StateMachineConfig) {
    super();
    this.config = config;
  }

  /**
   * Get or create state machine instance for a bot
   */
  static getInstance(botId: string, userId: string): BotStateMachine {
    const key = `${userId}-${botId}`;
    
    if (!BotStateMachine.instances.has(key)) {
      BotStateMachine.instances.set(key, new BotStateMachine({ botId, userId }));
    }
    
    return BotStateMachine.instances.get(key)!;
  }

  /**
   * Remove state machine instance
   */
  static removeInstance(botId: string, userId: string): void {
    const key = `${userId}-${botId}`;
    BotStateMachine.instances.delete(key);
  }

  /**
   * Get current state
   */
  getState(): BotState {
    return this.currentState;
  }

  /**
   * Get state machine status
   */
  getStatus(): StateMachineStatus {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      lastTransition: this.lastTransition,
      transitionCount: this.transitionCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
    };
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: BotState): boolean {
    const validTargets = VALID_TRANSITIONS.get(this.currentState);
    if (!validTargets) {
      return false;
    }
    return validTargets.includes(to);
  }

  /**
   * Transition to new state (with validation)
   */
  async transition(to: BotState, reason?: string): Promise<boolean> {
    // Check if transition is valid
    if (!this.canTransition(to)) {
      const error = `Invalid state transition: ${this.currentState} -> ${to}`;
      console.error(`[BotStateMachine] ${error}`);
      this.emit('transition_error', {
        from: this.currentState,
        to,
        error,
        botId: this.config.botId,
        userId: this.config.userId,
      });
      return false;
    }

    // Check transition guard
    const guardKey = `${this.currentState}->${to}`;
    const wildcardGuardKey = `*->${to}`;
    
    const guard = TRANSITION_GUARDS.get(guardKey) || TRANSITION_GUARDS.get(wildcardGuardKey);
    if (guard) {
      try {
        const guardResult = await guard();
        if (!guardResult) {
          const error = `Transition guard failed: ${this.currentState} -> ${to}`;
          console.warn(`[BotStateMachine] ${error}`);
          this.emit('transition_blocked', {
            from: this.currentState,
            to,
            reason: 'Guard check failed',
            botId: this.config.botId,
            userId: this.config.userId,
          });
          return false;
        }
      } catch (error: any) {
        const errorMsg = `Transition guard error: ${error.message}`;
        console.error(`[BotStateMachine] ${errorMsg}`);
        this.emit('transition_error', {
          from: this.currentState,
          to,
          error: errorMsg,
          botId: this.config.botId,
          userId: this.config.userId,
        });
        return false;
      }
    }

    // Perform transition
    const from = this.currentState;
    this.previousState = from;
    this.currentState = to;
    this.lastTransition = new Date();
    this.transitionCount++;

    // Record transition history
    this.transitionHistory.push({
      from,
      to,
      timestamp: new Date(),
      reason,
    });

    // Keep only last 50 transitions
    if (this.transitionHistory.length > 50) {
      this.transitionHistory.shift();
    }

    // Emit events
    this.emit('state_changed', {
      from,
      to,
      reason,
      botId: this.config.botId,
      userId: this.config.userId,
      timestamp: this.lastTransition,
    });

    // Call custom callback if provided
    if (this.config.onStateChange) {
      try {
        this.config.onStateChange(from, to);
      } catch (error) {
        console.error(`[BotStateMachine] Error in onStateChange callback:`, error);
      }
    }

    console.log(`[BotStateMachine] State transition: ${from} -> ${to}${reason ? ` (${reason})` : ''}`);

    return true;
  }

  /**
   * Force transition (bypasses guards, use with caution)
   * Only allowed for emergency stops or error recovery
   */
  async forceTransition(to: BotState, reason: string): Promise<boolean> {
    if (to === BotState.STOPPING || to === BotState.ERROR || to === BotState.IDLE) {
      const from = this.currentState;
      this.previousState = from;
      this.currentState = to;
      this.lastTransition = new Date();
      this.transitionCount++;

      if (to === BotState.ERROR) {
        this.errorCount++;
        this.lastError = reason;
      }

      this.emit('state_changed', {
        from,
        to,
        reason: `FORCED: ${reason}`,
        botId: this.config.botId,
        userId: this.config.userId,
        timestamp: this.lastTransition,
      });

      console.warn(`[BotStateMachine] FORCED state transition: ${from} -> ${to} (${reason})`);
      return true;
    }

    console.error(`[BotStateMachine] Force transition not allowed to ${to}. Only allowed to STOPPING, ERROR, or IDLE.`);
    return false;
  }

  /**
   * Check if bot is in a valid operational state
   */
  isOperational(): boolean {
    return [BotState.RUNNING, BotState.IN_TRADE].includes(this.currentState);
  }

  /**
   * Check if bot can execute trades
   */
  canExecuteTrades(): boolean {
    return this.currentState === BotState.RUNNING;
  }

  /**
   * Check if bot is in trade
   */
  isInTrade(): boolean {
    return this.currentState === BotState.IN_TRADE;
  }

  /**
   * Check if bot is stopped
   */
  isStopped(): boolean {
    return [BotState.IDLE, BotState.ERROR].includes(this.currentState);
  }

  /**
   * Reset state machine to IDLE
   */
  reset(): void {
    const from = this.currentState;
    this.currentState = BotState.IDLE;
    this.previousState = from;
    this.lastTransition = new Date();
    this.transitionCount = 0;
    this.errorCount = 0;
    this.lastError = undefined;
    this.transitionHistory = [];

    this.emit('state_reset', {
      botId: this.config.botId,
      userId: this.config.userId,
    });

    console.log(`[BotStateMachine] State machine reset to IDLE`);
  }

  /**
   * Get transition history
   */
  getTransitionHistory(limit?: number): Array<{
    from: BotState;
    to: BotState;
    timestamp: Date;
    reason?: string;
  }> {
    if (limit) {
      return this.transitionHistory.slice(-limit);
    }
    return [...this.transitionHistory];
  }

  /**
   * Validate current state (for recovery)
   */
  validateState(): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if state is valid enum value
    if (!Object.values(BotState).includes(this.currentState)) {
      issues.push(`Invalid state value: ${this.currentState}`);
    }

    // Check for stuck states
    if (this.currentState === BotState.STARTING && this.transitionCount > 10) {
      issues.push('Bot stuck in STARTING state');
    }

    if (this.currentState === BotState.STOPPING && this.transitionCount > 10) {
      issues.push('Bot stuck in STOPPING state');
    }

    // Check for excessive errors
    if (this.errorCount > 10) {
      issues.push(`Excessive errors: ${this.errorCount}`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Recover from invalid state
   */
  async recover(): Promise<boolean> {
    const validation = this.validateState();
    
    if (validation.valid) {
      return true;
    }

    console.warn(`[BotStateMachine] Recovering from invalid state. Issues: ${validation.issues.join(', ')}`);

    // Force transition to IDLE for recovery
    return await this.forceTransition(BotState.IDLE, `Recovery: ${validation.issues.join(', ')}`);
  }
}

/**
 * Export singleton getter
 */
export function getBotStateMachine(botId: string, userId: string): BotStateMachine {
  return BotStateMachine.getInstance(botId, userId);
}

