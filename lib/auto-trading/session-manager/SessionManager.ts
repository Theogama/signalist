/**
 * Session Manager
 * Manages active bot sessions and broker connections
 */

import { IBrokerAdapter } from '../interfaces';
import { BrokerType } from '../types';

export interface BotSession {
  sessionId: string;
  userId: string;
  botId: string;
  broker: BrokerType;
  adapter: IBrokerAdapter | null;
  instrument: string;
  parameters: Record<string, any>;
  startedAt: Date;
  isRunning: boolean;
  paperTrading: boolean;
}

class SessionManager {
  private sessions: Map<string, BotSession> = new Map();
  private userAdapters: Map<string, Map<BrokerType, IBrokerAdapter>> = new Map();
  private sessionCounter: number = 0;

  /**
   * Create a new bot session
   */
  createSession(
    userId: string,
    botId: string,
    broker: BrokerType,
    adapter: IBrokerAdapter | null,
    instrument: string,
    parameters: Record<string, any>,
    paperTrading: boolean = true
  ): string {
    const sessionId = `session-${Date.now()}-${++this.sessionCounter}`;
    
    const session: BotSession = {
      sessionId,
      userId,
      botId,
      broker,
      adapter,
      instrument,
      parameters,
      startedAt: new Date(),
      isRunning: true,
      paperTrading,
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): BotSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): BotSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId
    );
  }

  /**
   * Get active session for a user and bot
   */
  getActiveSession(userId: string, botId: string): BotSession | null {
    const sessions = this.getUserSessions(userId);
    return sessions.find(
      (session) => session.botId === botId && session.isRunning
    ) || null;
  }

  /**
   * Stop a session
   */
  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isRunning = false;
    return true;
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Store user's broker adapter
   */
  setUserAdapter(userId: string, broker: BrokerType, adapter: IBrokerAdapter): void {
    if (!this.userAdapters.has(userId)) {
      this.userAdapters.set(userId, new Map());
    }
    const userAdapters = this.userAdapters.get(userId)!;
    userAdapters.set(broker, adapter);
  }

  /**
   * Get user's broker adapter
   */
  getUserAdapter(userId: string, broker: BrokerType): IBrokerAdapter | null {
    const userAdapters = this.userAdapters.get(userId);
    if (!userAdapters) {
      return null;
    }
    return userAdapters.get(broker) || null;
  }

  /**
   * Remove user's broker adapter
   */
  removeUserAdapter(userId: string, broker: BrokerType): void {
    const userAdapters = this.userAdapters.get(userId);
    if (userAdapters) {
      userAdapters.delete(broker);
      if (userAdapters.size === 0) {
        this.userAdapters.delete(userId);
      }
    }
  }

  /**
   * Check if user has an active session
   */
  hasActiveSession(userId: string, botId?: string): boolean {
    const sessions = this.getUserSessions(userId);
    if (botId) {
      return sessions.some((s) => s.botId === botId && s.isRunning);
    }
    return sessions.some((s) => s.isRunning);
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions(): BotSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.isRunning);
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.startedAt.getTime();
      if (age > maxAge && !session.isRunning) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Cleanup old sessions every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    sessionManager.cleanupOldSessions();
  }, 60 * 60 * 1000); // Every hour
}










