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
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (error: any) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid request body. Please check your request format.' },
        { status: 400 }
      );
    }
    
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

    // Validate broker
    if (!['exness', 'deriv'].includes(broker)) {
      return NextResponse.json(
        { success: false, error: `Invalid broker: ${broker}. Supported brokers: exness, deriv` },
        { status: 400 }
      );
    }

    // Get adapter from session
    let adapter = sessionManager.getUserAdapter(userId, broker);
    
    // If adapter not found, try to create one for demo mode (Deriv only)
    if (!adapter) {
      if (broker === 'deriv') {
        console.log(`[Start Bot] Adapter not found for ${broker}, creating demo adapter as fallback...`);
        try {
          const DerivAdapter = (await import('@/lib/auto-trading/adapters/DerivAdapter')).DerivAdapter;
          const demoAdapter = new DerivAdapter();
          await demoAdapter.initialize({
            apiKey: '',
            apiSecret: '',
            environment: 'demo',
          });
          demoAdapter.setPaperTrading(true);
          
          // Store it in session manager for future use
          sessionManager.setUserAdapter(userId, 'deriv', demoAdapter);
          adapter = demoAdapter;
          console.log(`[Start Bot] Created and stored demo Deriv adapter as fallback`);
        } catch (error: any) {
          console.error(`[Start Bot] Failed to create demo adapter:`, error);
          return NextResponse.json(
            { 
              success: false, 
              error: `Broker "${broker}" not connected. Please connect to Deriv first using the "Connect Broker" button.`,
              hint: 'The connection may have been lost. Please reconnect to Deriv and try again.',
            },
            { status: 400 }
          );
        }
      } else {
        // For Exness - cannot create fallback, requires MT5 connection
        console.error(`[Start Bot] Adapter not found for broker: ${broker}, userId: ${userId}`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Broker "${broker}" not connected. Please connect to ${broker === 'exness' ? 'Exness' : broker} first using the "Connect Broker" button.`,
            hint: broker === 'exness' ? 'Exness requires MT5 credentials (login, password, server).' : 'Please connect your broker and try again.',
          },
          { status: 400 }
        );
      }
    }
    
    console.log(`[Start Bot] Using adapter for ${broker}, paperTrading: ${adapter.isPaperTrading()}`);

    // Ensure adapter is properly initialized (authenticate if needed and not in paper trading)
    // Skip authentication for paper trading mode (demo mode)
    if (!adapter.isPaperTrading()) {
      try {
        // Only authenticate if adapter is not already authenticated
        if (!(adapter as any).authenticated) {
          const authenticated = await adapter.authenticate();
          if (!authenticated) {
            return NextResponse.json(
              { success: false, error: 'Broker authentication failed. Please reconnect your broker.' },
              { status: 401 }
            );
          }
        }
      } catch (error: any) {
        console.error('Adapter authentication error:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: `Broker authentication failed: ${error.message || 'Unknown authentication error'}`,
            details: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ? error.stack : undefined,
          },
          { status: 401 }
        );
      }
    }
    
    // Validate instrument
    if (!instrument || typeof instrument !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid instrument. Please select a valid trading instrument.' },
        { status: 400 }
      );
    }
    
    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings. Please provide valid bot settings.' },
        { status: 400 }
      );
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
    const keyToCheck = (botName || botId || '').toLowerCase();
    if (keyToCheck && strategyNameMap[keyToCheck]) {
      strategyName = strategyNameMap[keyToCheck];
    }
    
    let strategy;
    try {
      // Log available strategies for debugging
      const availableStrategies = strategyRegistry.list();
      console.log(`[Start Bot] Available strategies: ${availableStrategies.join(', ')}`);
      console.log(`[Start Bot] Looking for strategy: ${strategyName} (from botId: ${botId}, botName: ${botName})`);
      
      // Try loading from registry with the resolved strategy name
      if (strategyRegistry.has(strategyName)) {
        console.log(`[Start Bot] Creating strategy: ${strategyName}`);
        strategy = strategyRegistry.create(strategyName, strategyConfig);
      } else {
        // Last resort: try botId directly
        if (strategyRegistry.has(botId)) {
          console.log(`[Start Bot] Creating strategy using botId: ${botId}`);
          strategy = strategyRegistry.create(botId, strategyConfig);
        } else {
          console.error(`[Start Bot] Strategy not found. Requested: ${strategyName || botId}, Available: ${availableStrategies.join(', ')}`);
          return NextResponse.json(
            { 
              success: false, 
              error: `Strategy "${strategyName || botId}" not found. Available strategies: ${availableStrategies.join(', ') || 'None'}`,
              availableStrategies: availableStrategies,
            },
            { status: 404 }
          );
        }
      }
      
      if (!strategy) {
        throw new Error('Strategy was created but is null or undefined');
      }
      
      console.log(`[Start Bot] Strategy created successfully: ${strategyName || botId}`);
    } catch (error: any) {
      console.error('[Start Bot] Strategy creation error:', error);
      console.error('[Start Bot] Error stack:', error.stack);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create strategy: ${error.message || 'Unknown error'}`,
          details: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ? {
            strategyName,
            botId,
            botName,
            error: error.message,
            stack: error.stack,
          } : undefined,
        },
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

    // Start bot with detailed error handling
    let botKey: string;
    try {
      botKey = await botManager.startBot(
        botId,
        userId,
        strategy,
        adapter,
        instrument,
        parameters,
        adapter.isPaperTrading()
      );
    } catch (error: any) {
      console.error('Error in botManager.startBot:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('already running')) {
        return NextResponse.json(
          { success: false, error: 'Bot is already running. Please stop it first.' },
          { status: 409 }
        );
      }
      
      if (error.message?.includes('strategy') || error.message?.includes('Strategy')) {
        return NextResponse.json(
          { success: false, error: `Strategy error: ${error.message}` },
          { status: 500 }
        );
      }
      
      if (error.message?.includes('adapter') || error.message?.includes('Adapter')) {
        return NextResponse.json(
          { success: false, error: `Broker adapter error: ${error.message}` },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to start bot: ${error.message || 'Unknown error occurred'}`,
          details: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-trade started successfully',
      data: {
        botKey,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    // Catch any unexpected errors
    console.error('Unexpected error in start route:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred while starting auto-trade',
        details: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

