/**
 * Readiness Probe
 * GET: Kubernetes readiness probe endpoint
 * Returns 200 if service is ready to accept traffic, 503 otherwise
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';

export async function GET() {
  try {
    // Check database connectivity (required for readiness)
    await connectToDatabase();

    // Optional: Check Redis if configured
    let redisReady = true;
    if (process.env.REDIS_URL) {
      try {
        const Redis = require('ioredis');
        const redis = new Redis(process.env.REDIS_URL, {
          connectTimeout: 2000,
          retryStrategy: () => null,
        });
        await redis.ping();
        redis.disconnect();
      } catch (error) {
        // Redis not critical for readiness, but log it
        redisReady = false;
      }
    }

    return NextResponse.json({
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        redis: process.env.REDIS_URL ? redisReady : 'not_configured',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message || 'Service not ready',
      },
      { status: 503 }
    );
  }
}

