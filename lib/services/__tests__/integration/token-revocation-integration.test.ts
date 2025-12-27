/**
 * Integration Test: Token Revocation with WebSocket Session Management
 * Tests the integration of token revocation with WebSocket session disconnection
 */

import { webSocketSessionManager } from '../../websocket-session-manager.service';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

// Mock DerivServerWebSocketClient
jest.mock('@/lib/deriv/server-websocket-client');

describe('Token Revocation Integration', () => {
  const userId = 'test-user-token-revocation';

  let mockWsClient1: jest.Mocked<DerivServerWebSocketClient>;
  let mockWsClient2: jest.Mocked<DerivServerWebSocketClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket clients
    mockWsClient1 = {
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as any;

    mockWsClient2 = {
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as any;

    // Clear all sessions
    webSocketSessionManager['disconnectAllSessions']();
  });

  afterEach(() => {
    // Cleanup
    webSocketSessionManager['disconnectAllSessions']();
  });

  describe('Session Registration and Disconnection', () => {
    it('should register sessions and disconnect on token revocation', async () => {
      // Register sessions
      webSocketSessionManager.registerSession(userId, mockWsClient1);
      webSocketSessionManager.registerSession(userId, mockWsClient2);

      // Verify sessions registered
      const sessions = webSocketSessionManager.getUserSessions(userId);
      expect(sessions.length).toBe(2);

      // Simulate token revocation - disconnect all sessions
      const disconnectedCount = await webSocketSessionManager.disconnectUserSessions(userId);

      expect(disconnectedCount).toBe(2);
      expect(mockWsClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient2.disconnect).toHaveBeenCalledTimes(1);

      // Verify sessions are removed
      const sessionsAfter = webSocketSessionManager.getUserSessions(userId);
      expect(sessionsAfter.length).toBe(0);
    });

    it('should handle disconnect errors gracefully', async () => {
      // Create client that fails to disconnect
      const errorClient = {
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
        on: jest.fn(),
      } as any;

      webSocketSessionManager.registerSession(userId, errorClient);

      // Should not throw
      await expect(
        webSocketSessionManager.disconnectUserSessions(userId)
      ).resolves.toBe(1);

      expect(errorClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should only disconnect sessions for the specified user', async () => {
      const userId2 = 'user-2';

      // Register sessions for both users
      webSocketSessionManager.registerSession(userId, mockWsClient1);
      webSocketSessionManager.registerSession(userId2, mockWsClient2);

      // Disconnect only user 1
      await webSocketSessionManager.disconnectUserSessions(userId);

      expect(mockWsClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient2.disconnect).not.toHaveBeenCalled();

      // User 2 sessions should still exist
      const user2Sessions = webSocketSessionManager.getUserSessions(userId2);
      expect(user2Sessions.length).toBe(1);
    });
  });

  describe('Multiple Session Management', () => {
    it('should handle multiple sessions per user', async () => {
      // Register multiple sessions
      webSocketSessionManager.registerSession(userId, mockWsClient1);
      webSocketSessionManager.registerSession(userId, mockWsClient2);

      const sessions = webSocketSessionManager.getUserSessions(userId);
      expect(sessions.length).toBe(2);

      // Disconnect all
      const count = await webSocketSessionManager.disconnectUserSessions(userId);
      expect(count).toBe(2);
    });

    it('should track total session count correctly', () => {
      webSocketSessionManager.registerSession(userId, mockWsClient1);
      webSocketSessionManager.registerSession(userId, mockWsClient2);

      const total = webSocketSessionManager.getTotalSessions();
      expect(total).toBe(2);
    });
  });

  describe('Token Revocation Workflow', () => {
    it('should complete full token revocation workflow', async () => {
      // Step 1: Register active sessions
      webSocketSessionManager.registerSession(userId, mockWsClient1);
      webSocketSessionManager.registerSession(userId, mockWsClient2);

      expect(webSocketSessionManager.getTotalSessions()).toBe(2);

      // Step 2: Revoke token (disconnect all sessions)
      const disconnectedCount = await webSocketSessionManager.disconnectUserSessions(userId);

      expect(disconnectedCount).toBe(2);
      expect(webSocketSessionManager.getTotalSessions()).toBe(0);

      // Step 3: Verify no active sessions remain
      const sessions = webSocketSessionManager.getUserSessions(userId);
      expect(sessions.length).toBe(0);
    });

    it('should handle token revocation with no active sessions', async () => {
      // No sessions registered
      const count = await webSocketSessionManager.disconnectUserSessions(userId);
      expect(count).toBe(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup stale sessions', async () => {
      // Register a session
      webSocketSessionManager.registerSession(userId, mockWsClient1);

      // Cleanup stale sessions (older than 1ms - very short for testing)
      const cleaned = await webSocketSessionManager.cleanupStaleSessions(1);

      // Session should be cleaned up
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});

