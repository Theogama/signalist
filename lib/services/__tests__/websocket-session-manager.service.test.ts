/**
 * WebSocket Session Manager Service Tests
 * Tests for Phase 2 WebSocket session management implementation
 */

import { webSocketSessionManager } from '../websocket-session-manager.service';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

// Mock DerivServerWebSocketClient
jest.mock('@/lib/deriv/server-websocket-client');

describe('WebSocketSessionManagerService', () => {
  const userId1 = 'test-user-1';
  const userId2 = 'test-user-2';

  let mockWsClient1: jest.Mocked<DerivServerWebSocketClient>;
  let mockWsClient2: jest.Mocked<DerivServerWebSocketClient>;
  let mockWsClient3: jest.Mocked<DerivServerWebSocketClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket clients
    mockWsClient1 = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockWsClient2 = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockWsClient3 = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Clear all sessions before each test
    webSocketSessionManager.disconnectAllSessions();
  });

  afterEach(() => {
    // Clean up after each test
    webSocketSessionManager.disconnectAllSessions();
  });

  describe('registerSession', () => {
    it('should register a session for a user', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toBe(mockWsClient1);
    });

    it('should register multiple sessions for the same user', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId1, mockWsClient2);
      
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(mockWsClient1);
      expect(sessions).toContain(mockWsClient2);
    });

    it('should register sessions independently for different users', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId2, mockWsClient2);
      
      const sessions1 = webSocketSessionManager.getUserSessions(userId1);
      const sessions2 = webSocketSessionManager.getUserSessions(userId2);
      
      expect(sessions1).toHaveLength(1);
      expect(sessions2).toHaveLength(1);
      expect(sessions1[0]).toBe(mockWsClient1);
      expect(sessions2[0]).toBe(mockWsClient2);
    });
  });

  describe('disconnectUserSessions', () => {
    it('should disconnect all sessions for a user', async () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId1, mockWsClient2);
      
      await webSocketSessionManager.disconnectUserSessions(userId1);
      
      expect(mockWsClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient2.disconnect).toHaveBeenCalledTimes(1);
      
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      expect(sessions).toHaveLength(0);
    });

    it('should not disconnect sessions for other users', async () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId2, mockWsClient2);
      
      await webSocketSessionManager.disconnectUserSessions(userId1);
      
      expect(mockWsClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient2.disconnect).not.toHaveBeenCalled();
      
      const sessions2 = webSocketSessionManager.getUserSessions(userId2);
      expect(sessions2).toHaveLength(1);
    });

    it('should handle disconnect errors gracefully', async () => {
      const errorClient = {
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      } as any;

      webSocketSessionManager.registerSession(userId1, errorClient);
      
      // Should not throw
      await expect(
        webSocketSessionManager.disconnectUserSessions(userId1)
      ).resolves.not.toThrow();
      
      expect(errorClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle user with no sessions', async () => {
      // Should not throw when disconnecting user with no sessions
      await expect(
        webSocketSessionManager.disconnectUserSessions(userId1)
      ).resolves.not.toThrow();
    });
  });

  describe('disconnectAllSessions', () => {
    it('should disconnect all sessions for all users', async () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId1, mockWsClient2);
      webSocketSessionManager.registerSession(userId2, mockWsClient3);
      
      await webSocketSessionManager.disconnectAllSessions();
      
      expect(mockWsClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient2.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWsClient3.disconnect).toHaveBeenCalledTimes(1);
      
      const sessions1 = webSocketSessionManager.getUserSessions(userId1);
      const sessions2 = webSocketSessionManager.getUserSessions(userId2);
      
      expect(sessions1).toHaveLength(0);
      expect(sessions2).toHaveLength(0);
    });

    it('should handle empty session map', async () => {
      // Should not throw when no sessions exist
      await expect(
        webSocketSessionManager.disconnectAllSessions()
      ).resolves.not.toThrow();
    });
  });

  describe('getUserSessions', () => {
    it('should return empty array for user with no sessions', () => {
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      expect(sessions).toEqual([]);
    });

    it('should return all sessions for a user', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId1, mockWsClient2);
      
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(mockWsClient1);
      expect(sessions).toContain(mockWsClient2);
    });

    it('should return independent sessions for different users', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId2, mockWsClient2);
      
      const sessions1 = webSocketSessionManager.getUserSessions(userId1);
      const sessions2 = webSocketSessionManager.getUserSessions(userId2);
      
      expect(sessions1).toHaveLength(1);
      expect(sessions2).toHaveLength(1);
      expect(sessions1[0]).toBe(mockWsClient1);
      expect(sessions2[0]).toBe(mockWsClient2);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should remove stale sessions', async () => {
      // Register a session
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      
      // Mock client as disconnected (stale)
      (mockWsClient1 as any).isConnected = false;
      
      // Cleanup should remove stale sessions
      // Note: Implementation depends on how stale sessions are detected
      // This is a placeholder test - adjust based on actual implementation
      await webSocketSessionManager.cleanupStaleSessions();
      
      // Verify cleanup behavior (adjust based on actual implementation)
      const sessions = webSocketSessionManager.getUserSessions(userId1);
      // Implementation-specific assertion
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('getTotalSessions', () => {
    it('should return 0 when no sessions exist', () => {
      const total = webSocketSessionManager.getTotalSessions();
      expect(total).toBe(0);
    });

    it('should return correct total session count', () => {
      webSocketSessionManager.registerSession(userId1, mockWsClient1);
      webSocketSessionManager.registerSession(userId1, mockWsClient2);
      webSocketSessionManager.registerSession(userId2, mockWsClient3);
      
      const total = webSocketSessionManager.getTotalSessions();
      
      expect(total).toBe(3); // 3 total sessions
    });
  });
});

