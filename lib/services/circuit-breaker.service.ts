/**
 * Circuit Breaker Service
 * 
 * Implements circuit breaker pattern to prevent runaway trading after repeated failures.
 * Automatically pauses bot execution when failure threshold is reached and attempts recovery.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, requests allowed
 * - OPEN: Circuit is open, requests blocked (too many failures)
 * - HALF_OPEN: Testing recovery, allowing limited requests
 * 
 * Features:
 * - Configurable failure thresholds
 * - Automatic recovery attempts
 * - Per-bot failure tracking
 * - Time-based state transitions
 */

import { EventEmitter } from 'events';

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Circuit open, blocking requests
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  // Failure threshold to open circuit
  failureThreshold: number;        // Number of failures before opening (default: 5)
  failureWindowMs: number;         // Time window for counting failures (default: 60000 = 1 minute)
  
  // Recovery configuration
  recoveryTimeoutMs: number;       // Time to wait before attempting recovery (default: 30000 = 30 seconds)
  successThreshold: number;        // Number of successes needed to close circuit (default: 2)
  
  // Half-open state configuration
  halfOpenMaxAttempts: number;     // Max attempts in half-open state (default: 3)
}

/**
 * Circuit Breaker Status
 */
export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  halfOpenAttempts: number;
}

/**
 * Circuit Breaker Result
 */
export interface CircuitBreakerResult {
  allowed: boolean;
  state: CircuitState;
  message?: string;
}

/**
 * Default Circuit Breaker Configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,           // Open circuit after 5 failures
  failureWindowMs: 60000,        // Within 1 minute
  recoveryTimeoutMs: 30000,      // Wait 30 seconds before recovery attempt
  successThreshold: 2,           // Need 2 successes to close circuit
  halfOpenMaxAttempts: 3,        // Max 3 attempts in half-open state
};

/**
 * Circuit Breaker Service
 * Singleton service managing circuit breakers per bot
 */
export class CircuitBreakerService extends EventEmitter {
  private static instance: CircuitBreakerService;
  private circuits: Map<string, {
    config: CircuitBreakerConfig;
    status: CircuitBreakerStatus;
    failureHistory: Array<{ timestamp: Date }>;
    successHistory: Array<{ timestamp: Date }>;
    halfOpenTimer?: NodeJS.Timeout;
  }> = new Map();

  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Get circuit key for bot
   */
  private getCircuitKey(botId: string, userId: string): string {
    return `${userId}-${botId}`;
  }

  /**
   * Initialize circuit breaker for a bot
   */
  initialize(botId: string, userId: string, config?: Partial<CircuitBreakerConfig>): void {
    const key = this.getCircuitKey(botId, userId);
    
    if (this.circuits.has(key)) {
      return; // Already initialized
    }

    const circuitConfig: CircuitBreakerConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.circuits.set(key, {
      config: circuitConfig,
      status: {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        halfOpenAttempts: 0,
      },
      failureHistory: [],
      successHistory: [],
    });
  }

  /**
   * Check if request is allowed (circuit breaker check)
   */
  canExecute(botId: string, userId: string): CircuitBreakerResult {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      // If not initialized, allow by default (backward compatibility)
      return {
        allowed: true,
        state: CircuitState.CLOSED,
      };
    }

    const { status, config } = circuit;

    // Clean old failure history
    this.cleanFailureHistory(key);

    // Check circuit state
    switch (status.state) {
      case CircuitState.CLOSED:
        // Normal operation, allow request
        return {
          allowed: true,
          state: CircuitState.CLOSED,
        };

      case CircuitState.OPEN:
        // Circuit is open, check if recovery timeout has passed
        if (status.openedAt) {
          const timeSinceOpen = Date.now() - status.openedAt.getTime();
          if (timeSinceOpen >= config.recoveryTimeoutMs) {
            // Transition to half-open state
            this.transitionToHalfOpen(key);
            return {
              allowed: true,
              state: CircuitState.HALF_OPEN,
              message: 'Circuit breaker in recovery mode, allowing limited requests',
            };
          }
        }
        // Still in open state, block request
        return {
          allowed: false,
          state: CircuitState.OPEN,
          message: `Circuit breaker is OPEN. Too many failures. Will retry after ${config.recoveryTimeoutMs / 1000} seconds.`,
        };

      case CircuitState.HALF_OPEN:
        // Testing recovery, allow limited requests
        if (status.halfOpenAttempts >= config.halfOpenMaxAttempts) {
          // Too many attempts, open circuit again
          this.transitionToOpen(key, 'Half-open attempts exceeded');
          return {
            allowed: false,
            state: CircuitState.OPEN,
            message: 'Circuit breaker re-opened after failed recovery attempts',
          };
        }
        // Allow request in half-open state
        return {
          allowed: true,
          state: CircuitState.HALF_OPEN,
          message: 'Circuit breaker in recovery mode',
        };

      default:
        return {
          allowed: true,
          state: CircuitState.CLOSED,
        };
    }
  }

  /**
   * Record a success (call after successful operation)
   */
  recordSuccess(botId: string, userId: string): void {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return;
    }

    const { status, config } = circuit;
    const now = new Date();

    // Record success
    circuit.successHistory.push({ timestamp: now });
    status.lastSuccess = now;
    status.successes++;

    // Clean old success history
    this.cleanSuccessHistory(key);

    // Handle state transitions
    if (status.state === CircuitState.HALF_OPEN) {
      status.halfOpenAttempts++;

      // If we have enough successes, close the circuit
      const recentSuccesses = this.getRecentSuccesses(key, config.recoveryTimeoutMs);
      if (recentSuccesses >= config.successThreshold) {
        this.transitionToClosed(key);
        this.emit('circuit_closed', { botId, userId, key });
      }
    } else if (status.state === CircuitState.CLOSED) {
      // Reset failure count on success (circuit is healthy)
      status.failures = 0;
      circuit.failureHistory = [];
    }
  }

  /**
   * Record a failure (call after failed operation)
   */
  recordFailure(botId: string, userId: string, error?: Error): void {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      // Initialize if not exists
      this.initialize(botId, userId);
      return this.recordFailure(botId, userId, error);
    }

    const { status, config } = circuit;
    const now = new Date();

    // Record failure
    circuit.failureHistory.push({ timestamp: now });
    status.lastFailure = now;
    status.failures++;

    // Clean old failure history
    this.cleanFailureHistory(key);

    // Check if we should open the circuit
    const recentFailures = this.getRecentFailures(key, config.failureWindowMs);
    
    if (status.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state, immediately open circuit
      this.transitionToOpen(key, error?.message || 'Failure during recovery');
      this.emit('circuit_opened', { botId, userId, key, reason: error?.message });
    } else if (status.state === CircuitState.CLOSED && recentFailures >= config.failureThreshold) {
      // Too many failures, open the circuit
      this.transitionToOpen(key, `Failure threshold reached (${recentFailures}/${config.failureThreshold})`);
      this.emit('circuit_opened', { 
        botId, 
        userId, 
        key, 
        reason: `Failure threshold reached (${recentFailures}/${config.failureThreshold})`,
        error: error?.message,
      });
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus(botId: string, userId: string): CircuitBreakerStatus | null {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return null;
    }

    // Clean history before returning status
    this.cleanFailureHistory(key);
    this.cleanSuccessHistory(key);

    return { ...circuit.status };
  }

  /**
   * Reset circuit breaker (force close)
   */
  reset(botId: string, userId: string): void {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return;
    }

    // Clear timers
    if (circuit.halfOpenTimer) {
      clearTimeout(circuit.halfOpenTimer);
      circuit.halfOpenTimer = undefined;
    }

    // Reset status
    circuit.status = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      halfOpenAttempts: 0,
    };
    circuit.failureHistory = [];
    circuit.successHistory = [];

    this.emit('circuit_reset', { botId, userId, key });
  }

  /**
   * Remove circuit breaker (cleanup)
   */
  remove(botId: string, userId: string): void {
    const key = this.getCircuitKey(botId, userId);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return;
    }

    // Clear timers
    if (circuit.halfOpenTimer) {
      clearTimeout(circuit.halfOpenTimer);
    }

    this.circuits.delete(key);
    this.emit('circuit_removed', { botId, userId, key });
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(key: string, reason: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    circuit.status.state = CircuitState.OPEN;
    circuit.status.openedAt = new Date();
    circuit.status.halfOpenAttempts = 0;

    console.warn(`[CircuitBreaker] Circuit OPEN for ${key}: ${reason}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    circuit.status.state = CircuitState.HALF_OPEN;
    circuit.status.halfOpenAttempts = 0;
    circuit.status.openedAt = undefined;

    console.log(`[CircuitBreaker] Circuit HALF_OPEN for ${key} - testing recovery`);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    circuit.status.state = CircuitState.CLOSED;
    circuit.status.failures = 0;
    circuit.status.successes = 0;
    circuit.status.halfOpenAttempts = 0;
    circuit.status.openedAt = undefined;
    circuit.failureHistory = [];

    console.log(`[CircuitBreaker] Circuit CLOSED for ${key} - recovery successful`);
  }

  /**
   * Get recent failures within time window
   */
  private getRecentFailures(key: string, windowMs: number): number {
    const circuit = this.circuits.get(key);
    if (!circuit) return 0;

    const now = Date.now();
    const cutoff = now - windowMs;

    return circuit.failureHistory.filter(
      f => f.timestamp.getTime() >= cutoff
    ).length;
  }

  /**
   * Get recent successes within time window
   */
  private getRecentSuccesses(key: string, windowMs: number): number {
    const circuit = this.circuits.get(key);
    if (!circuit) return 0;

    const now = Date.now();
    const cutoff = now - windowMs;

    return circuit.successHistory.filter(
      s => s.timestamp.getTime() >= cutoff
    ).length;
  }

  /**
   * Clean old failure history
   */
  private cleanFailureHistory(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    const { config } = circuit;
    const now = Date.now();
    const cutoff = now - config.failureWindowMs;

    circuit.failureHistory = circuit.failureHistory.filter(
      f => f.timestamp.getTime() >= cutoff
    );
  }

  /**
   * Clean old success history
   */
  private cleanSuccessHistory(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    const { config } = circuit;
    const now = Date.now();
    const cutoff = now - config.recoveryTimeoutMs;

    circuit.successHistory = circuit.successHistory.filter(
      s => s.timestamp.getTime() >= cutoff
    );
  }
}

/**
 * Export singleton instance
 */
export const circuitBreakerService = CircuitBreakerService.getInstance();

