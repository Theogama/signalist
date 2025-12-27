/**
 * Distributed Lock Service Tests
 * Tests for Phase 2 distributed locking implementation
 */

import { distributedLockService } from '../distributed-lock.service';

describe('DistributedLockService', () => {
  beforeEach(() => {
    // Clean up any existing locks before each test
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire a lock successfully', async () => {
      const lockKey = 'test-lock';
      const acquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 5000,
        maxRetries: 0,
      });

      expect(acquired).toBe(true);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should fail to acquire lock if already held', async () => {
      const lockKey = 'test-lock-held';

      // Acquire lock
      const firstAcquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 5000,
        maxRetries: 0,
      });
      expect(firstAcquired).toBe(true);

      // Try to acquire again (should fail)
      const secondAcquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 5000,
        maxRetries: 0,
      });
      expect(secondAcquired).toBe(false);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should acquire lock after previous lock expires', async () => {
      const lockKey = 'test-lock-expiry';

      // Acquire lock with short TTL
      const firstAcquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 100, // 100ms
        maxRetries: 0,
      });
      expect(firstAcquired).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should now be able to acquire
      const secondAcquired = await distributedLockService.acquireLock(lockKey, {
        ttl: 5000,
        maxRetries: 0,
      });
      expect(secondAcquired).toBe(true);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });
  });

  describe('releaseLock', () => {
    it('should release a lock successfully', async () => {
      const lockKey = 'test-release';

      // Acquire lock
      await distributedLockService.acquireLock(lockKey, { ttl: 5000 });
      const wasLocked = await distributedLockService.isLocked(lockKey);
      expect(wasLocked).toBe(true);

      // Release lock
      const released = await distributedLockService.releaseLock(lockKey);
      expect(released).toBe(true);

      // Verify lock is released
      const isLocked = await distributedLockService.isLocked(lockKey);
      expect(isLocked).toBe(false);
    });

    it('should return false when releasing non-existent lock', async () => {
      const lockKey = 'non-existent-lock';
      const released = await distributedLockService.releaseLock(lockKey);
      expect(released).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return true when lock is held', async () => {
      const lockKey = 'test-is-locked';

      await distributedLockService.acquireLock(lockKey, { ttl: 5000 });
      const isLocked = await distributedLockService.isLocked(lockKey);
      expect(isLocked).toBe(true);

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should return false when lock is not held', async () => {
      const lockKey = 'test-not-locked';
      const isLocked = await distributedLockService.isLocked(lockKey);
      expect(isLocked).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info when lock is held', async () => {
      const lockKey = 'test-lock-info';

      await distributedLockService.acquireLock(lockKey, { ttl: 5000 });
      const lockInfo = await distributedLockService.getLockInfo(lockKey);

      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.lockKey).toContain(lockKey);
      expect(lockInfo?.lockedAt).toBeDefined();
      expect(lockInfo?.expiresAt).toBeGreaterThan(lockInfo?.lockedAt || 0);
      expect(lockInfo?.instanceId).toBeDefined();

      // Cleanup
      await distributedLockService.releaseLock(lockKey);
    });

    it('should return null when lock is not held', async () => {
      const lockKey = 'test-no-lock-info';
      const lockInfo = await distributedLockService.getLockInfo(lockKey);
      expect(lockInfo).toBeNull();
    });
  });
});

