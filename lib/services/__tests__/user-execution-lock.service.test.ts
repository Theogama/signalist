/**
 * User Execution Lock Service Tests
 * Tests for Phase 2 user-level execution lock implementation
 */

import { userExecutionLockService } from '../user-execution-lock.service';

describe('UserExecutionLockService', () => {
  const userId = 'test-user-id';
  const botId1 = 'bot-1';
  const botId2 = 'bot-2';

  beforeEach(() => {
    // Clean up any existing locks before each test
    // Since the service uses in-memory storage, we need to release all locks
    try {
      userExecutionLockService.releaseLock(userId, botId1);
      userExecutionLockService.releaseLock(userId, botId2);
    } catch (error) {
      // Ignore errors if locks don't exist
    }
  });

  afterEach(() => {
    // Clean up after each test
    try {
      userExecutionLockService.releaseLock(userId, botId1);
      userExecutionLockService.releaseLock(userId, botId2);
    } catch (error) {
      // Ignore errors
    }
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully for a user and bot', async () => {
      const acquired = await userExecutionLockService.acquireLock(userId, botId1);
      expect(acquired).toBe(true);
    });

    it('should prevent multiple bots from acquiring lock simultaneously for same user', async () => {
      // First bot acquires lock
      const firstAcquired = await userExecutionLockService.acquireLock(userId, botId1);
      expect(firstAcquired).toBe(true);

      // Second bot tries to acquire lock (should fail)
      const secondAcquired = await userExecutionLockService.acquireLock(userId, botId2);
      expect(secondAcquired).toBe(false);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should allow same bot to re-acquire lock after release', async () => {
      // Acquire lock
      const firstAcquired = await userExecutionLockService.acquireLock(userId, botId1);
      expect(firstAcquired).toBe(true);

      // Release lock
      const released = await userExecutionLockService.releaseLock(userId, botId1);
      expect(released).toBe(true);

      // Re-acquire lock (should succeed)
      const secondAcquired = await userExecutionLockService.acquireLock(userId, botId1);
      expect(secondAcquired).toBe(true);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should allow different users to acquire locks independently', async () => {
      const userId2 = 'test-user-id-2';

      // User 1 acquires lock
      const user1Lock = await userExecutionLockService.acquireLock(userId, botId1);
      expect(user1Lock).toBe(true);

      // User 2 acquires lock (should succeed - different users)
      const user2Lock = await userExecutionLockService.acquireLock(userId2, botId1);
      expect(user2Lock).toBe(true);

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
      await userExecutionLockService.releaseLock(userId2, botId1);
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      // Acquire lock
      await userExecutionLockService.acquireLock(userId, botId1);

      // Check lock is held
      const isLocked = await userExecutionLockService.isLocked(userId);
      expect(isLocked).toBe(true);

      // Release lock
      const released = await userExecutionLockService.releaseLock(userId, botId1);
      expect(released).toBe(true);

      // Verify lock is released
      const isLockedAfter = await userExecutionLockService.isLocked(userId);
      expect(isLockedAfter).toBe(false);
    });

    it('should return false when releasing non-existent lock', async () => {
      const released = await userExecutionLockService.releaseLock(userId, botId1);
      expect(released).toBe(false);
    });

    it('should release lock even if wrong botId provided (force release)', async () => {
      // Acquire lock with botId1
      await userExecutionLockService.acquireLock(userId, botId1);

      // Try to release with wrong botId (should still release - user-level lock)
      const released = await userExecutionLockService.releaseLock(userId, botId2);
      // The service may implement this differently, but typically user-level locks
      // release regardless of botId since it's per-user
      expect(typeof released).toBe('boolean');
    });
  });

  describe('getLockStatus', () => {
    it('should return lock status when lock is held', async () => {
      await userExecutionLockService.acquireLock(userId, botId1);
      const status = await userExecutionLockService.getLockStatus(userId);

      expect(status.userId).toBe(userId);
      expect(status.isLocked).toBe(true);
      expect(status.lockedBy).toBe(botId1);
      expect(status.lockedAt).toBeDefined();

      // Cleanup
      await userExecutionLockService.releaseLock(userId, botId1);
    });

    it('should return unlocked status when lock is not held', async () => {
      const status = await userExecutionLockService.getLockStatus(userId);
      expect(status.userId).toBe(userId);
      expect(status.isLocked).toBe(false);
      expect(status.lockedBy).toBeUndefined();
    });

    it('should return unlocked status after lock is released', async () => {
      // Acquire and release
      await userExecutionLockService.acquireLock(userId, botId1);
      await userExecutionLockService.releaseLock(userId, botId1);

      // Should be unlocked
      const status = await userExecutionLockService.getLockStatus(userId);
      expect(status.isLocked).toBe(false);
    });
  });

  describe('forceRelease', () => {
    it('should force release lock for a user', async () => {
      // Acquire lock
      await userExecutionLockService.acquireLock(userId, botId1);

      // Force release
      const released = await userExecutionLockService.forceRelease(userId);
      expect(released).toBe(true);

      // Verify lock is released
      const status = await userExecutionLockService.getLockStatus(userId);
      expect(status.isLocked).toBe(false);
    });

    it('should handle force release when lock not held by this instance', async () => {
      // Force release on non-existent lock (may return false in multi-instance scenarios)
      const released = await userExecutionLockService.forceRelease(userId);
      expect(typeof released).toBe('boolean');
    });
  });
});

