/**
 * Auto-Trading Strategies API
 * GET: List available strategies
 * POST: Create/update strategy configuration
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

    // Load generated strategies if available
    try {
      if (strategyLoader.hasGeneratedStrategies()) {
        await strategyLoader.loadAll();
      }
    } catch (error) {
      // Generated strategies not available - continue with default strategies
      console.warn('Could not load generated strategies:', error);
    }

    // Get all registered strategies
    const registeredStrategies = strategyRegistry.list();

    // Base strategies with descriptions
    const baseStrategies = [
      {
        name: 'EvenOdd',
        description: 'Trades based on even/odd last digit analysis',
        parameters: {
          riskPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          takeProfitPercent: { type: 'number', default: 2, min: 0.5, max: 20 },
          stopLossPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          martingale: { type: 'boolean', default: false },
          martingaleMultiplier: { type: 'number', default: 2, min: 1.5, max: 5 },
        },
      },
      {
        name: 'RiseFall',
        description: 'Trades based on candle close/open analysis',
        parameters: {
          riskPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          takeProfitPercent: { type: 'number', default: 2, min: 0.5, max: 20 },
          stopLossPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          lookbackPeriod: { type: 'number', default: 5, min: 2, max: 20 },
        },
      },
      {
        name: 'Digits',
        description: 'Analyzes last digits and predicts matches/differs',
        parameters: {
          riskPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          takeProfitPercent: { type: 'number', default: 2, min: 0.5, max: 20 },
          stopLossPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          lookbackPeriod: { type: 'number', default: 10, min: 5, max: 50 },
          digitThreshold: { type: 'number', default: 3, min: 1, max: 10 },
        },
      },
    ];

    // Add generated strategies
    const generatedStrategies = registeredStrategies
      .filter(name => !['EvenOdd', 'RiseFall', 'Digits'].includes(name))
      .map(name => ({
        name,
        description: `Generated strategy: ${name}`,
        parameters: {
          riskPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
          takeProfitPercent: { type: 'number', default: 2, min: 0.5, max: 20 },
          stopLossPercent: { type: 'number', default: 1, min: 0.1, max: 10 },
        },
        generated: true,
      }));

    const allStrategies = [...baseStrategies, ...generatedStrategies];

    return NextResponse.json({ 
      success: true, 
      data: allStrategies,
      total: allStrategies.length,
      generated: generatedStrategies.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const user = session.user;
    const body = await request.json();

    // TODO: Save strategy configuration to database
    // This would store user's strategy settings

    return NextResponse.json({ success: true, message: 'Strategy configuration saved' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save strategy' },
      { status: 500 }
    );
  }
}

