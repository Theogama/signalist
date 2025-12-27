/**
 * Liveness Probe
 * GET: Kubernetes liveness probe endpoint
 * Returns 200 if service is alive, 503 if it should be restarted
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic liveness check - just verify the service is responding
    // If we get here, the service is alive
    return NextResponse.json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error: any) {
    // If we can't even respond, service should be restarted
    return NextResponse.json(
      {
        alive: false,
        timestamp: new Date().toISOString(),
        error: error.message || 'Service not responding',
      },
      { status: 503 }
    );
  }
}

