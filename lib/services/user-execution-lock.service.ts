/**
 * User Execution Lock Service
 * Prevents multiple bots per user from trading simultaneously
 * Uses distributed locking to ensure thread safety across instances
 */

import { distributedLockService } from './distributed-lock.service';

export interface UserLockStatus {
  userId: string;
  isLocked: boolean;
  lockedBy?: string; // botId that holds the lock
  lockedAt?: Date;
}

class UserExecutionLockService {
  private userLocks: Map<string, { botId: string; lockedAt: Date }> = new Map();

  /**
   * Acquire execution lock for a user
   * Only one bot per user can execute trades at a time
   * 
   * @param userId - User ID
   * @param botId - Bot ID requesting the lock
   * @returns Promise<boolean> - true if lock acquired, false if already locked
   */
  async acquireLock(userId: string, botId: string): Promise<boolean> {
    const lockKey = `user-execution:${userId}`;
    
    // Check local state first (optimization)
    const existingLock = this.userLocks.get(userId);
    if (existingLock && existingLock.botId !== botId) {
      return false; // Another bot already has the lock
    }

    // Try to acquire distributed lock
    const acquired = await distributedLockService.acquireLock(lockKey, {
      ttl: 60000, // 1 minute (should be enough for trade execution)
      retryInterval: 50,
      maxRetries: 0, // Don't retry - if locked, return false immediately
    });

    if (acquired) {
      // Update local state
      this.userLocks.set(userId, {
        botId,
        lockedAt: new Date(),
      });

      console.log(`[UserExecutionLock] Lock acquired for user ${userId} by bot ${botId}`);
      return true;
    }

    // Check which bot holds the lock (if any)
    const lockInfo = await distributedLockService.getLockInfo(lockKey);
    if (lockInfo) {
      console.log(`[UserExecutionLock] Lock held by another instance for user ${userId}`);
    }

    return false;
  }

  /**
   * Release execution lock for a user
   * 
   * @param userId - User ID
   * @param botId - Bot ID releasing the lock (must match lock owner)
   * @returns Promise<boolean> - true if released, false if not owned by this bot
   */
  async releaseLock(userId: string, botId: string): Promise<boolean> {
    const lockKey = `user-execution:${userId}`;
    
    // Check local state
    const existingLock = this.userLocks.get(userId);
    if (existingLock && existingLock.botId !== botId) {
      console.warn(`[UserExecutionLock] Attempt to release lock by non-owner bot ${botId} (owner: ${existingLock.botId})`);
      return false; // Not owned by this bot
    }

    // Release distributed lock
    const released = await distributedLockService.releaseLock(lockKey);
    
    if (released) {
      // Update local state
      this.userLocks.delete(userId);
      console.log(`[UserExecutionLock] Lock released for user ${userId} by bot ${botId}`);
      return true;
    }

    return false;
  }

  /**
   * Check if user execution is locked
   * 
   * @param userId - User ID
   * @returns Promise<UserLockStatus> - Lock status
   */
  async getLockStatus(userId: string): Promise<UserLockStatus> {
    const lockKey = `user-execution:${userId}`;
    const isLocked = await distributedLockService.isLocked(lockKey);
    
    const localLock = this.userLocks.get(userId);
    
    return {
      userId,
      isLocked,
      lockedBy: localLock?.botId,
      lockedAt: localLock?.lockedAt,
    };
  }

  /**
   * Force release lock (use with caution - for emergency stops)
   * 
   * @param userId - User ID
   * @returns Promise<boolean> - true if released
   */
  async forceRelease(userId: string): Promise<boolean> {
    const lockKey = `user-execution:${userId}`;
    
    // Try to release distributed lock
    // Note: This will only work if this instance holds the lock
    // For true force release, we'd need to delete the Redis key directly
    const released = await distributedLockService.releaseLock(lockKey);
    
    if (released) {
      this.userLocks.delete(userId);
      console.log(`[UserExecutionLock] Force released lock for user ${userId}`);
      return true;
    }

    // Lock not held by this instance - this is expected in multi-instance deployments
    // In production, we'd need Redis admin access to force delete
    console.warn(`[UserExecutionLock] Cannot force release lock for user ${userId} - not held by this instance`);
    return false;
  }

  /**
   * Clear all local locks (for testing/cleanup)
   */
  clearLocalLocks(): void {
    this.userLocks.clear();
  }
}

// Export singleton instance
export const userExecutionLockService = new UserExecutionLockService();

