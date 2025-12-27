/**
 * Detailed Health Check API
 * GET: Comprehensive health check for all services
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis?: {
      status: 'healthy' | 'unhealthy' | 'not_configured';
      latency?: number;
      error?: string;
    };
    websocket?: {
      status: 'healthy' | 'unhealthy' | 'not_configured';
      error?: string;
    };
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
    uptime: process.uptime(),
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
    },
  };

  // Check memory usage
  if (process.memoryUsage) {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    health.memory = {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };
  }

  // Check Database connectivity
  try {
    const dbStartTime = Date.now();
    await connectToDatabase();
    const dbLatency = Date.now() - dbStartTime;

    health.services.database = {
      status: 'healthy',
      latency: dbLatency,
    };
  } catch (error: any) {
    health.services.database = {
      status: 'unhealthy',
      error: error.message || 'Database connection failed',
    };
    health.status = 'unhealthy';
  }

  // Check Redis connectivity (optional)
  try {
    const Redis = require('ioredis');
    if (process.env.REDIS_URL) {
      const redisStartTime = Date.now();
      const redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 2000,
        retryStrategy: () => null, // Don't retry for health check
      });

      try {
        await redis.ping();
        const redisLatency = Date.now() - redisStartTime;
        health.services.redis = {
          status: 'healthy',
          latency: redisLatency,
        };
        redis.disconnect();
      } catch (error: any) {
        health.services.redis = {
          status: 'unhealthy',
          error: error.message || 'Redis connection failed',
        };
        health.status = health.status === 'healthy' ? 'degraded' : 'unhealthy';
        redis.disconnect();
      }
    } else {
      health.services.redis = {
        status: 'not_configured',
      };
    }
  } catch (error: any) {
    // Redis not installed or not configured - this is OK
    health.services.redis = {
      status: 'not_configured',
    };
  }

  // Determine overall status
  const hasUnhealthyServices = Object.values(health.services).some(
    (service) => service.status === 'unhealthy'
  );
  const hasDegradedServices = Object.values(health.services).some(
    (service) => service.status === 'unhealthy' || (service.status === 'not_configured' && health.services.redis)
  );

  if (hasUnhealthyServices) {
    health.status = 'unhealthy';
  } else if (hasDegradedServices && health.status === 'healthy') {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

