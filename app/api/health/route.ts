/**
 * Health Check API
 * GET: Basic health check endpoint
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'signalist-api',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
      },
      { status: 503 }
    );
  }
}
