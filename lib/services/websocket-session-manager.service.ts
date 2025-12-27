/**
 * WebSocket Session Manager
 * Tracks active WebSocket connections per user for token revocation invalidation
 */

import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';
import { EventEmitter } from 'events';

export interface WebSocketSession {
  userId: string;
  wsClient: DerivServerWebSocketClient;
  connectedAt: Date;
  lastActivity: Date;
}

class WebSocketSessionManager extends EventEmitter {
  private sessions: Map<string, WebSocketSession[]> = new Map(); // userId -> sessions[]

  /**
   * Register a WebSocket session
   * 
   * @param userId - User ID
   * @param wsClient - WebSocket client instance
   * @returns Session ID
   */
  registerSession(userId: string, wsClient: DerivServerWebSocketClient): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, []);
    }

    const session: WebSocketSession = {
      userId,
      wsClient,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    // Store session ID on client for cleanup
    (wsClient as any).__sessionId = sessionId;
    (wsClient as any).__userId = userId;

    this.sessions.get(userId)!.push(session);

    // Set up disconnect handler
    wsClient.on('disconnect', () => {
      this.removeSession(userId, wsClient);
    });

    this.emit('session_registered', { userId, sessionId });
    console.log(`[WebSocketSessionManager] Session registered for user ${userId}: ${sessionId}`);

    return sessionId;
  }

  /**
   * Remove a session
   */
  private removeSession(userId: string, wsClient: DerivServerWebSocketClient): void {
    const userSessions = this.sessions.get(userId);
    if (!userSessions) {
      return;
    }

    const index = userSessions.findIndex(s => s.wsClient === wsClient);
    if (index >= 0) {
      userSessions.splice(index, 1);
      if (userSessions.length === 0) {
        this.sessions.delete(userId);
      }
      this.emit('session_removed', { userId });
    }
  }

  /**
   * Disconnect all sessions for a user (used on token revocation)
   * 
   * @param userId - User ID
   * @returns Promise<number> - Number of sessions disconnected
   */
  async disconnectUserSessions(userId: string): Promise<number> {
    const userSessions = this.sessions.get(userId);
    if (!userSessions || userSessions.length === 0) {
      return 0;
    }

    console.log(`[WebSocketSessionManager] Disconnecting ${userSessions.length} session(s) for user ${userId}`);

    const disconnectPromises = userSessions.map(async (session) => {
      try {
        await session.wsClient.disconnect();
      } catch (error: any) {
        console.warn(`[WebSocketSessionManager] Error disconnecting session for user ${userId}:`, error.message);
      }
    });

    await Promise.allSettled(disconnectPromises);

    // Clear sessions
    const count = userSessions.length;
    this.sessions.delete(userId);

    this.emit('user_sessions_disconnected', { userId, count });
    console.log(`[WebSocketSessionManager] Disconnected ${count} session(s) for user ${userId}`);

    return count;
  }

  /**
   * Update last activity time for a session
   */
  updateActivity(userId: string, wsClient: DerivServerWebSocketClient): void {
    const userSessions = this.sessions.get(userId);
    if (!userSessions) {
      return;
    }

    const session = userSessions.find(s => s.wsClient === wsClient);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Get active sessions for a user
   * 
   * @param userId - User ID
   * @returns Array of session info
   */
  getUserSessions(userId: string): Omit<WebSocketSession, 'wsClient'>[] {
    const userSessions = this.sessions.get(userId);
    if (!userSessions) {
      return [];
    }

    return userSessions.map(s => ({
      userId: s.userId,
      connectedAt: s.connectedAt,
      lastActivity: s.lastActivity,
    }));
  }

  /**
   * Get total active session count
   */
  getTotalSessions(): number {
    let total = 0;
    for (const sessions of this.sessions.values()) {
      total += sessions.length;
    }
    return total;
  }

  /**
   * Cleanup stale sessions (older than maxAge)
   */
  async cleanupStaleSessions(maxAgeMs: number = 3600000): Promise<number> { // 1 hour default
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, userSessions] of this.sessions.entries()) {
      const staleSessions = userSessions.filter(
        s => (now - s.lastActivity.getTime()) > maxAgeMs
      );

      for (const staleSession of staleSessions) {
        try {
          await staleSession.wsClient.disconnect();
          this.removeSession(userId, staleSession.wsClient);
          cleaned++;
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[WebSocketSessionManager] Cleaned up ${cleaned} stale session(s)`);
    }

    return cleaned;
  }
}

// Export singleton instance
export const webSocketSessionManager = new WebSocketSessionManager();

// Cleanup stale sessions every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    webSocketSessionManager.cleanupStaleSessions().catch(console.error);
  }, 10 * 60 * 1000);
}

