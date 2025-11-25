/**
 * List All Available Strategies
 * Includes both base and generated strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';
import { strategyLoader } from '@/lib/auto-trading/strategies/StrategyLoader';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Load generated strategies
    if (strategyLoader.hasGeneratedStrategies()) {
      const result = await strategyLoader.loadAll();
      if (result.errors.length > 0) {
        console.warn('Some strategies failed to load:', result.errors);
      }
    }

    const allStrategies = strategyRegistry.list();
    const availableFiles = strategyLoader.getAvailableStrategies();

    return NextResponse.json({
      success: true,
      data: {
        registered: allStrategies,
        available: availableFiles,
        total: allStrategies.length,
        generated: availableFiles.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list strategies' },
      { status: 500 }
    );
  }
}




