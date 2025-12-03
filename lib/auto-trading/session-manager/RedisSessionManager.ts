/**
 * Redis Session Manager (Optional)
 * Provides Redis-backed session persistence with in-memory fallback
 */

import { BotSession } from './SessionManager';
import { BrokerType } from '../types';
import { IBrokerAdapter } from '../interfaces';

// Try to import Redis, but don't fail if not available
let Redis: any = null;
try {
  Redis = require('ioredis');
} catch (error) {
  // Redis not installed, will use in-memory fallback
}

class RedisSessionManager {
  private redis: any = null;
  private inMemoryFallback: Map<string, any> = new Map();
  private useRedis: boolean = false;

  constructor() {
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
          console.warn('[RedisSessionManager] Redis error, falling back to in-memory:', error.message);
          this.useRedis = false;
        });

        this.redis.on('connect', () => {
          console.log('[RedisSessionManager] Connected to Redis');
          this.useRedis = true;
        });

        this.useRedis = true;
      } catch (error) {
        console.warn('[RedisSessionManager] Failed to connect to Redis, using in-memory fallback:', error);
        this.useRedis = false;
      }
    } else {
      console.log('[RedisSessionManager] Redis not configured, using in-memory storage');
      this.useRedis = false;
    }
  }

  /**
   * Store session in Redis or memory
   */
  async setSession(sessionId: string, session: BotSession): Promise<void> {
    const key = `session:${sessionId}`;
    const data = JSON.stringify(session, null, 0);

    if (this.useRedis && this.redis) {
      try {
        await this.redis.setex(key, 86400, data); // 24 hours TTL
      } catch (error) {
        console.warn('[RedisSessionManager] Redis set failed, using fallback:', error);
        this.inMemoryFallback.set(key, { data, expires: Date.now() + 86400000 });
      }
    } else {
      this.inMemoryFallback.set(key, { data, expires: Date.now() + 86400000 });
    }
  }

  /**
   * Get session from Redis or memory
   */
  async getSession(sessionId: string): Promise<BotSession | null> {
    const key = `session:${sessionId}`;

    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        console.warn('[RedisSessionManager] Redis get failed, trying fallback:', error);
        const fallback = this.inMemoryFallback.get(key);
        if (fallback && fallback.expires > Date.now()) {
          return JSON.parse(fallback.data);
        }
      }
    } else {
      const fallback = this.inMemoryFallback.get(key);
      if (fallback && fallback.expires > Date.now()) {
        return JSON.parse(fallback.data);
      }
    }

    return null;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;

    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.warn('[RedisSessionManager] Redis delete failed:', error);
      }
    }

    this.inMemoryFallback.delete(key);
  }

  /**
   * Store user adapter
   */
  async setUserAdapter(userId: string, broker: BrokerType, adapter: IBrokerAdapter): Promise<void> {
    // Note: Adapters can't be serialized, so we only store metadata
    const key = `adapter:${userId}:${broker}`;
    const data = JSON.stringify({
      broker,
      userId,
      timestamp: Date.now(),
    });

    if (this.useRedis && this.redis) {
      try {
        await this.redis.setex(key, 3600, data); // 1 hour TTL
      } catch (error) {
        this.inMemoryFallback.set(key, { data, expires: Date.now() + 3600000 });
      }
    } else {
      this.inMemoryFallback.set(key, { data, expires: Date.now() + 3600000 });
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    if (!this.useRedis) {
      // Clean in-memory fallback
      const now = Date.now();
      for (const [key, value] of this.inMemoryFallback.entries()) {
        if (value.expires < now) {
          this.inMemoryFallback.delete(key);
        }
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

// Export singleton (optional - can be used by SessionManager if needed)
export const redisSessionManager = new RedisSessionManager();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    redisSessionManager.cleanup();
  }, 5 * 60 * 1000);
}


