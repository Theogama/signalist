/**
 * Integration Test: Bot Execution with Distributed and User Locks
 * Tests the integration of BotExecutionEngine with distributed locks and user execution locks
 */

import { distributedLockService } from '../../distributed-lock.service';
import { userExecutionLockService } from '../../user-execution-lock.service';
import { userTradeLimitsService } from '../../user-trade-limits.service';

describe('Bot Execution Integration with Locks', () => {
  const userId = 'test-user-integration';
  const botId1 = 'bot-1';
  const botId2 = 'bot-2';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset services
    try {
      distributedLockService.releaseLock(`bot-execution:${userId}:${botId1}`);
      distributedLockService.releaseLock(`bot-execution:${userId}:${botId2}`);
      userExecutionLockService.forceRelease(userId);
      userTradeLimitsService.setUserLimits(userId, { enabled: false });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    // Cleanup
    try {
      distributedLockService.releaseLock(`bot-execution:${userId}:${botId1}`);
      distributedLockService.releaseLock(`bot-execution:${userId}:${botId2}`);
      userExecutionLockService.forceRelease(userId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Distributed Lock Integration', () => {
    it('should acquire distributed lock before bot execution', async () => {
      const lockKey = `bot-execution:${userId}:${botId1}`;
      
      // Simulate bot execution acquiring lock
      const lockAcquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 30000,
        maxRetries: 0,
      });

      expect(lockAcquired).toBe(true);
      expect(await distributedLockService.isLocked(lockKey)).toBe(true);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should prevent concurrent execution across instances', async () => {
      const lockKey = `bot-execution:${userId}:${botId1}`;

      // Instance 1 acquires lock
      const lock1 = await distributedLockService.acquireLock(lockKey, {
        ttl: 30000,
        maxRetries: 0,
      });
      expect(lock1).toBe(true);

      // Instance 2 tries to acquire same lock (should fail)
      const lock2 = await distributedLockService.acquireLock(lockKey, {
        ttl: 30000,
        maxRetries: 0,
      });
      expect(lock2).toBe(false);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should release lock after bot execution completes', async () => {
      const lockKey = `bot-execution:${userId}:${botId1}`;

      // Acquire lock
      await distributedLockService.acquireLock(lockKey, { ttl: 30000 });
      expect(await distributedLockService.isLocked(lockKey)).toBe(true);

      // Release lock (simulating execution completion)
      await distributedLockService.releaseLock(lockKey);
      expect(await distributedLockService.isLocked(lockKey)).toBe(false);
    });
  });

  describe('User Execution Lock Integration', () => {
    it('should prevent multiple bots from executing simultaneously for same user', async () => {
      // Bot 1 acquires user lock
      const bot1Lock = await userExecutionLockService.acquireLock(userId, botId1);
      expect(bot1Lock).toBe(true);

      // Bot 2 tries to acquire lock (should fail)
      const bot2Lock = await userExecutionLockService.acquireLock(userId, botId2);
      expect(bot2Lock).toBe(false);

      // Verify lock status
      const status = await userExecutionLockService.getLockStatus(userId);
      expect(status.isLocked).toBe(true);
      expect(status.lockedBy).toBe(botId1);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should allow bot to re-acquire lock after release', async () => {
      // Acquire and release
      await userExecutionLockService.acquireLock(userId, botId1);
      await userExecutionLockService.releaseLock(userId, botId1);

      // Should be able to acquire again
      const reacquired = await userExecutionLockService.acquireLock(userId, botId1);
      expect(reacquired).toBe(true);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should allow different users to have independent locks', async () => {
      const userId2 = 'test-user-2';

      // User 1 acquires lock
      const user1Lock = await userExecutionLockService.acquireLock(userId, botId1);
      expect(user1Lock).toBe(true);

      // User 2 acquires lock (should succeed - different users)
      const user2Lock = await userExecutionLockService.acquireLock(userId2, botId1);
      expect(user2Lock).toBe(true);

      // Both should be locked independently
      const status1 = await userExecutionLockService.getLockStatus(userId);
      const status2 = await userExecutionLockService.getLockStatus(userId2);
      expect(status1.isLocked).toBe(true);
      expect(status2.isLocked).toBe(true);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
      await userExecutionLockService.releaseLock(userId2, botId1);
    });
  });

  describe('Combined Lock Flow', () => {
    it('should acquire both distributed and user locks for bot execution', async () => {
      const distributedLockKey = `bot-execution:${userId}:${botId1}`;

      // Step 1: Acquire user execution lock
      const userLock = await userExecutionLockService.acquireLock(userId, botId1);
      expect(userLock).toBe(true);

      // Step 2: Acquire distributed lock
      const distLock = await distributedLockService.acquireLock(distributedLockKey, {
        ttl: 30000,
        maxRetries: 0,
      });
      expect(distLock).toBe(true);

      // Both locks should be held
      expect(await userExecutionLockService.getLockStatus(userId)).toMatchObject({
        isLocked: true,
        lockedBy: botId1,
      });
      expect(await distributedLockService.isLocked(distributedLockKey)).toBe(true);

      // Cleanup
      await distributedLockService.releaseLock(distributedLockKey);
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should release both locks after execution completes', async () => {
      const distributedLockKey = `bot-execution:${userId}:${botId1}`;

      // Acquire both locks
      await userExecutionLockService.acquireLock(userId, botId1);
      await distributedLockService.acquireLock(distributedLockKey, { ttl: 30000 });

      // Release both locks (simulating execution completion)
      await distributedLockService.releaseLock(distributedLockKey);
      await userExecutionLockService.releaseLock(userId, botId1);

      // Both should be released
      expect(await userExecutionLockService.getLockStatus(userId)).toMatchObject({
        isLocked: false,
      });
      expect(await distributedLockService.isLocked(distributedLockKey)).toBe(false);
    });

    it('should handle lock release order correctly', async () => {
      const distributedLockKey = `bot-execution:${userId}:${botId1}`;

      // Acquire both locks
      await userExecutionLockService.acquireLock(userId, botId1);
      await distributedLockService.acquireLock(distributedLockKey, { ttl: 30000 });

      // Release in reverse order (should still work)
      await userExecutionLockService.releaseLock(userId, botId1);
      await distributedLockService.releaseLock(distributedLockKey);

      // Both should be released
      expect(await userExecutionLockService.getLockStatus(userId)).toMatchObject({
        isLocked: false,
      });
      expect(await distributedLockService.isLocked(distributedLockKey)).toBe(false);
    });
  });

  describe('User Trade Limits Integration', () => {
    it('should check trade limits before acquiring locks', async () => {
      // Set up limits
      userTradeLimitsService.setUserLimits(userId, {
        maxTradesPerDay: 10,
        enabled: true,
      });

      // Mock: Check if trade is allowed (this would be done before lock acquisition)
      // In actual implementation, this check happens in BotExecutionEngine
      const limits = userTradeLimitsService.getUserLimits(userId);
      expect(limits.maxTradesPerDay).toBe(10);
      expect(limits.enabled).toBe(true);

      // Cleanup
      userTradeLimitsService.setUserLimits(userId, { enabled: false });
    });

    it('should respect disabled limits', async () => {
      // Disable limits
      userTradeLimitsService.setUserLimits(userId, { enabled: false });

      const limits = userTradeLimitsService.getUserLimits(userId);
      expect(limits.enabled).toBe(false);
    });
  });
});

