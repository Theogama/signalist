/**
 * Start Bot API
 * POST: Start the trading bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';
import { strategyLoader } from '@/lib/auto-trading/strategies/StrategyLoader';
import { XmlBotParser } from '@/lib/auto-trading/parsers/XmlBotParser';
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';
import { DerivAdapter } from '@/lib/auto-trading/adapters/DerivAdapter';
import * as fs from 'fs';
import * as path from 'path';

const BOTS_DIR = path.join(process.cwd(), 'freetradingbots-main');

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { botId, instrument, parameters, broker } = body;

    if (!botId || !instrument || !parameters) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Load generated strategies if available
    try {
      if (strategyLoader.hasGeneratedStrategies()) {
        await strategyLoader.loadAll();
      }
    } catch (error) {
      console.warn('Could not load generated strategies:', error);
    }

    // Determine if this is a registered strategy or XML bot
    let strategy;
    let strategyName: string;

    if (botId.startsWith('registered-')) {
      // Registered strategy
      const index = parseInt(botId.replace('registered-', ''));
      const registeredStrategies = strategyRegistry.list();
      
      if (isNaN(index) || index < 0 || index >= registeredStrategies.length) {
        return NextResponse.json(
          { success: false, error: `Invalid bot ID: ${botId}. Available strategies: ${registeredStrategies.join(', ')}` },
          { status: 400 }
        );
      }

      strategyName = registeredStrategies[index];
      
      if (!strategyName) {
        return NextResponse.json(
          { success: false, error: `Strategy not found at index ${index}` },
          { status: 400 }
        );
      }

      try {
        strategy = strategyRegistry.create(strategyName, parameters);
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: `Failed to create strategy: ${error.message}` },
          { status: 500 }
        );
      }
    } else if (botId.startsWith('xml-')) {
      // XML bot - try to find matching strategy or use default
      const index = parseInt(botId.replace('xml-', ''));
      
      if (isNaN(index) || index < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid XML bot index: ${botId}` },
          { status: 400 }
        );
      }

      if (!fs.existsSync(BOTS_DIR)) {
        return NextResponse.json(
          { success: false, error: 'XML bots directory not found' },
          { status: 400 }
        );
      }

      const parser = new XmlBotParser();
      const xmlFiles = fs.readdirSync(BOTS_DIR).filter(f => f.endsWith('.xml') && !f.startsWith('.'));
      
      if (index >= xmlFiles.length) {
        return NextResponse.json(
          { success: false, error: `Invalid bot ID: ${botId}. Only ${xmlFiles.length} XML bots available.` },
          { status: 400 }
        );
      }

      const fileName = xmlFiles[index];
      const filePath = path.join(BOTS_DIR, fileName);
      
      try {
        const config = parser.parseXmlFile(filePath);
        // Try to create a strategy based on trade type
        // For now, use EvenOdd as default for XML bots
        strategyName = 'EvenOdd';
        
        if (!strategyRegistry.has(strategyName)) {
          return NextResponse.json(
            { success: false, error: `Strategy '${strategyName}' not found in registry` },
            { status: 500 }
          );
        }

        strategy = strategyRegistry.create(strategyName, {
          ...parameters,
          ...config,
        });
      } catch (error: any) {
        console.error('Error parsing XML bot:', error);
        // Fallback to default strategy
        strategyName = 'EvenOdd';
        
        if (!strategyRegistry.has(strategyName)) {
          return NextResponse.json(
            { success: false, error: `Default strategy '${strategyName}' not found` },
            { status: 500 }
          );
        }

        try {
          strategy = strategyRegistry.create(strategyName, parameters);
        } catch (createError: any) {
          return NextResponse.json(
            { success: false, error: `Failed to create strategy: ${createError.message}` },
            { status: 500 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: `Invalid bot ID format: ${botId}. Must start with 'registered-' or 'xml-'` },
        { status: 400 }
      );
    }

    if (!strategy) {
      return NextResponse.json(
        { success: false, error: 'Failed to create strategy instance' },
        { status: 500 }
      );
    }

    // Create adapter if broker is specified and not in paper trading mode
    let adapter = null;
    const paperTrading = !broker || parameters.paperMode !== false;
    
    if (!paperTrading && broker) {
      if (broker === 'exness') {
        adapter = new ExnessAdapter();
      } else if (broker === 'deriv') {
        adapter = new DerivAdapter();
      }
    }

    // Start the bot
    const botKey = await botManager.startBot(
      botId,
      userId,
      strategy,
      adapter,
      instrument,
      parameters,
      paperTrading
    );

    return NextResponse.json({
      success: true,
      message: 'Bot started successfully',
      data: {
        botId,
        botKey,
        instrument,
        strategy: strategyName,
        paperTrading,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error starting bot:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start bot' },
      { status: 500 }
    );
  }
}



