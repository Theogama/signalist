/**
 * Start Auto-Trade API
 * Starts the auto-trading engine with provided settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const {
      botId,
      botName, // Strategy name from bot object
      instrument,
      settings,
      broker,
    } = body;

    if (!botId || !instrument || !settings || !broker) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: botId, instrument, settings, broker' },
        { status: 400 }
      );
    }

    // Get adapter from session
    const adapter = sessionManager.getUserAdapter(userId, broker);
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Broker not connected. Please connect a broker first.' },
        { status: 400 }
      );
    }

    // Ensure adapter is properly initialized (authenticate if needed and not in paper trading)
    if (!adapter.isPaperTrading()) {
      try {
        const authenticated = await adapter.authenticate();
        if (!authenticated) {
          return NextResponse.json(
            { success: false, error: 'Adapter authentication failed' },
            { status: 401 }
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: `Authentication failed: ${error.message}` },
          { status: 401 }
        );
      }
    }

    // Create strategy config
    const strategyConfig = {
      name: botId,
      enabled: true,
      riskPercent: settings.riskPercent || 1,
      takeProfitPercent: settings.takeProfitPercent || 2,
      stopLossPercent: settings.stopLossPercent || 1,
      maxConcurrentTrades: settings.maxTrades || 1,
      maxDailyTrades: settings.maxDailyTrades,
      maxDailyLoss: settings.maxDailyLoss,
      maxDrawdown: settings.maxDrawdown,
      parameters: settings,
    };

    // Load strategy from registry
    // For registered bots, botName already contains the strategy name (e.g., "EvenOdd", "RiseFall")
    // Map botId/botName to the correct strategy name in the registry
    let strategyName = botName || botId;
    
    // If botId starts with "registered-", use botName directly (it contains the strategy name)
    if (botId.startsWith('registered-')) {
      if (botName) {
        // botName already contains the strategy name for registered bots
        strategyName = botName;
      } else {
        // Fallback: get strategy name from registry by index
        const index = parseInt(botId.replace('registered-', ''), 10);
        const registeredStrategies = strategyRegistry.list();
        if (index >= 0 && index < registeredStrategies.length) {
          strategyName = registeredStrategies[index];
        }
      }
    }
    
    // Map common bot ID/name patterns to strategy names
    const strategyNameMap: Record<string, string> = {
      'even-odd': 'EvenOdd',
      'evenodd': 'EvenOdd',
      'rise-fall': 'RiseFall',
      'risefall': 'RiseFall',
      'digits': 'Digits',
    };
    
    // Try mapped name if botId or botName matches a known pattern
    const keyToCheck = (botName || botId).toLowerCase();
    if (strategyNameMap[keyToCheck]) {
      strategyName = strategyNameMap[keyToCheck];
    }
    
    let strategy;
    try {
      // Try loading from registry with the resolved strategy name
      if (strategyRegistry.has(strategyName)) {
        strategy = strategyRegistry.create(strategyName, strategyConfig);
      } else {
        // Last resort: try botId directly
        if (strategyRegistry.has(botId)) {
          strategy = strategyRegistry.create(botId, strategyConfig);
        } else {
          return NextResponse.json(
            { success: false, error: `Strategy not found: ${strategyName || botId}. Available: ${strategyRegistry.list().join(', ')}` },
            { status: 404 }
          );
        }
      }
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: `Failed to create strategy: ${error.message}` },
        { status: 500 }
      );
    }

    // Prepare parameters
    const parameters = {
      broker,
      riskPercent: settings.riskPercent || 1,
      takeProfitPercent: settings.takeProfitPercent || 2,
      stopLossPercent: settings.stopLossPercent || 1,
      maxTrades: settings.maxTrades || 1,
      lotSize: settings.lotSize,
      sessionStart: settings.sessionStart,
      sessionEnd: settings.sessionEnd,
      martingale: settings.martingale || false,
      martingaleMultiplier: settings.martingaleMultiplier || 2,
      maxDailyLoss: settings.maxDailyLoss,
      maxDailyProfit: settings.maxDailyProfit,
      paperTrading: adapter.isPaperTrading(),
    };

    // Start bot
    const botKey = await botManager.startBot(
      botId,
      userId,
      strategy,
      adapter,
      instrument,
      parameters,
      adapter.isPaperTrading()
    );

    return NextResponse.json({
      success: true,
      message: 'Auto-trade started successfully',
      data: {
        botKey,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error starting auto-trade:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start auto-trade' },
      { status: 500 }
    );
  }
}

