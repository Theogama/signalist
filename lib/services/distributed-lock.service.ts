/**
 * Distributed Lock Service
 * Provides distributed locking mechanism for multi-instance deployments
 * Uses Redis with in-memory fallback for single-instance deployments
 */

// Try to import Redis, but don't fail if not available
let Redis: any = null;
try {
  Redis = require('ioredis');
} catch (error) {
  // Redis not installed, will use in-memory fallback
}

export interface DistributedLockOptions {
  /**
   * Lock TTL in milliseconds (default: 30000 = 30 seconds)
   * Locks automatically expire after this time to prevent deadlocks
   */
  ttl?: number;
  /**
   * Retry interval in milliseconds (default: 100)
   */
  retryInterval?: number;
  /**
   * Maximum retry attempts (default: 10)
   */
  maxRetries?: number;
}

export interface LockInfo {
  lockKey: string;
  lockedAt: number;
  expiresAt: number;
  instanceId: string;
}

class DistributedLockService {
  private redis: any = null;
  private inMemoryLocks: Map<string, { expiresAt: number; instanceId: string }> = new Map();
  private useRedis: boolean = false;
  private instanceId: string;

  constructor() {
    // Generate unique instance ID for this process
    this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (Redis && process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });

        this.redis.on('error', (error: any) => {
          console.warn('[DistributedLock] Redis error, falling back to in-memory:', error.message);
          this.useRedis = false;
        });

        this.redis.on('connect', () => {
          console.log('[DistributedLock] Connected to Redis');
          this.useRedis = true;
        });

        this.useRedis = true;
      } catch (error) {
        console.warn('[DistributedLock] Failed to connect to Redis, using in-memory fallback:', error);
        this.useRedis = false;
      }
    } else {
      console.log('[DistributedLock] Redis not configured, using in-memory locks (single-instance mode)');
      this.useRedis = false;
    }
  }

  /**
   * Acquire a distributed lock
   * 
   * @param lockKey - Unique lock identifier (e.g., "bot-execution:userId:botId")
   * @param options - Lock options
   * @returns Promise<boolean> - true if lock acquired, false if failed
   */
  async acquireLock(
    lockKey: string,
    options: DistributedLockOptions = {}
  ): Promise<boolean> {
    const ttl = options.ttl || 30000; // 30 seconds default
    const retryInterval = options.retryInterval || 100;
    const maxRetries = options.maxRetries || 10;

    const fullLockKey = `lock:${lockKey}`;
    const expiresAt = Date.now() + ttl;

    // Try to acquire lock with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }

      const acquired = await this.tryAcquireLock(fullLockKey, expiresAt, ttl);
      if (acquired) {
        return true;
      }
    }

    return false; // Failed to acquire lock after max retries
  }

  /**
   * Try to acquire lock (single attempt)
   */
  private async tryAcquireLock(
    fullLockKey: string,
    expiresAt: number,
    ttl: number
  ): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        // Use SET NX EX for atomic lock acquisition
        // NX = set only if not exists
        // EX = set expiration in seconds
        const result = await this.redis.set(
          fullLockKey,
          JSON.stringify({
            instanceId: this.instanceId,
            lockedAt: Date.now(),
            expiresAt,
          }),
          'EX',
          Math.ceil(ttl / 1000), // Convert to seconds
          'NX'
        );

        return result === 'OK';
      } catch (error) {
        console.warn('[DistributedLock] Redis lock acquisition failed:', error);
        // Fall back to in-memory
        return this.tryAcquireInMemoryLock(fullLockKey, expiresAt);
      }
    } else {
      return this.tryAcquireInMemoryLock(fullLockKey, expiresAt);
    }
  }

  /**
   * Try to acquire in-memory lock
   */
  private tryAcquireInMemoryLock(
    fullLockKey: string,
    expiresAt: number
  ): boolean {
    const existing = this.inMemoryLocks.get(fullLockKey);
    const now = Date.now();

    // Clean up expired locks
    if (existing && existing.expiresAt <= now) {
      this.inMemoryLocks.delete(fullLockKey);
    }

    // Check if lock exists
    if (this.inMemoryLocks.has(fullLockKey)) {
      return false; // Lock already held
    }

    // Acquire lock
    this.inMemoryLocks.set(fullLockKey, {
      expiresAt,
      instanceId: this.instanceId,
    });

    return true;
  }

  /**
   * Release a distributed lock
   * 
   * @param lockKey - Lock identifier
   * @returns Promise<boolean> - true if released, false if not owned by this instance
   */
  async releaseLock(lockKey: string): Promise<boolean> {
    const fullLockKey = `lock:${lockKey}`;

    if (this.useRedis && this.redis) {
      try {
        // Get lock info to verify ownership
        const lockData = await this.redis.get(fullLockKey);
        if (!lockData) {
          return false; // Lock doesn't exist
        }

        const lockInfo = JSON.parse(lockData);
        if (lockInfo.instanceId !== this.instanceId) {
          return false; // Lock owned by different instance
        }

        // Delete lock
        await this.redis.del(fullLockKey);
        return true;
      } catch (error) {
        console.warn('[DistributedLock] Redis lock release failed:', error);
        // Fall back to in-memory
        return this.releaseInMemoryLock(fullLockKey);
      }
    } else {
      return this.releaseInMemoryLock(fullLockKey);
    }
  }

  /**
   * Release in-memory lock
   */
  private releaseInMemoryLock(fullLockKey: string): boolean {
    const lock = this.inMemoryLocks.get(fullLockKey);
    if (!lock) {
      return false; // Lock doesn't exist
    }

    if (lock.instanceId !== this.instanceId) {
      return false; // Lock owned by different instance
    }

    this.inMemoryLocks.delete(fullLockKey);
    return true;
  }

  /**
   * Check if a lock is currently held
   * 
   * @param lockKey - Lock identifier
   * @returns Promise<boolean> - true if lock is held
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const fullLockKey = `lock:${lockKey}`;

    if (this.useRedis && this.redis) {
      try {
        const exists = await this.redis.exists(fullLockKey);
        return exists === 1;
      } catch (error) {
        console.warn('[DistributedLock] Redis lock check failed:', error);
        return this.isInMemoryLocked(fullLockKey);
      }
    } else {
      return this.isInMemoryLocked(fullLockKey);
    }
  }

  /**
   * Check if in-memory lock is held
   */
  private isInMemoryLocked(fullLockKey: string): boolean {
    const lock = this.inMemoryLocks.get(fullLockKey);
    if (!lock) {
      return false;
    }

    // Clean up expired lock
    if (lock.expiresAt <= Date.now()) {
      this.inMemoryLocks.delete(fullLockKey);
      return false;
    }

    return true;
  }

  /**
   * Get lock information
   * 
   * @param lockKey - Lock identifier
   * @returns Promise<LockInfo | null> - Lock info if locked, null otherwise
   */
  async getLockInfo(lockKey: string): Promise<LockInfo | null> {
    const fullLockKey = `lock:${lockKey}`;

    if (this.useRedis && this.redis) {
      try {
        const lockData = await this.redis.get(fullLockKey);
        if (!lockData) {
          return null;
        }

        const lockInfo = JSON.parse(lockData);
        return {
          lockKey,
          lockedAt: lockInfo.lockedAt,
          expiresAt: lockInfo.expiresAt,
          instanceId: lockInfo.instanceId,
        };
      } catch (error) {
        console.warn('[DistributedLock] Redis lock info fetch failed:', error);
        return this.getInMemoryLockInfo(fullLockKey);
      }
    } else {
      return this.getInMemoryLockInfo(fullLockKey);
    }
  }

  /**
   * Get in-memory lock info
   */
  private getInMemoryLockInfo(fullLockKey: string): LockInfo | null {
    const lock = this.inMemoryLocks.get(fullLockKey);
    if (!lock) {
      return null;
    }

    // Clean up expired lock
    if (lock.expiresAt <= Date.now()) {
      this.inMemoryLocks.delete(fullLockKey);
      return null;
    }

    return {
      lockKey: fullLockKey,
      lockedAt: lock.expiresAt - 30000, // Approximate (we don't store lockedAt in memory)
      expiresAt: lock.expiresAt,
      instanceId: lock.instanceId,
    };
  }

  /**
   * Cleanup expired in-memory locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (lock.expiresAt <= now) {
        this.inMemoryLocks.delete(key);
      }
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Export singleton instance
export const distributedLockService = new DistributedLockService();

// Cleanup expired locks every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    distributedLockService['cleanupExpiredLocks']();
  }, 60000);
}

