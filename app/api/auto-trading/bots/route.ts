/**
 * Bots API
 * GET: List all available bots from freetradingbots-main and registered strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';
import { strategyLoader } from '@/lib/auto-trading/strategies/StrategyLoader';
import { XmlBotParser } from '@/lib/auto-trading/parsers/XmlBotParser';
import * as fs from 'fs';
import * as path from 'path';

const BOTS_DIR = path.join(process.cwd(), 'freetradingbots-main');

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bots: Array<{
      id: string;
      name: string;
      description: string;
      source: 'registered' | 'xml';
      fileName?: string;
      tradeType?: string;
      symbol?: string;
      parameters: {
        riskPercent: number;
        takeProfitPercent: number;
        stopLossPercent: number;
        maxTrades: number;
      };
    }> = [];

    // Load generated strategies (if available)
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
    registeredStrategies.forEach((name, index) => {
      bots.push({
        id: `registered-${index}`,
        name: name,
        description: `Trading strategy: ${name}`,
        source: 'registered',
        parameters: {
          riskPercent: 1,
          takeProfitPercent: 2,
          stopLossPercent: 1,
          maxTrades: 1,
        },
      });
    });

    // Load all bots from freetradingbots-main directory
    try {
      if (fs.existsSync(BOTS_DIR)) {
        const parser = new XmlBotParser();
        const xmlFiles = fs.readdirSync(BOTS_DIR).filter(f => f.endsWith('.xml') && !f.startsWith('.'));
        
        xmlFiles.forEach((fileName, index) => {
          try {
            const filePath = path.join(BOTS_DIR, fileName);
            if (!fs.existsSync(filePath)) {
              return; // Skip if file doesn't exist
            }
            const config = parser.parseXmlFile(filePath);
            
            // Create a clean bot name from filename
            const botName = fileName
              .replace(/\.xml$/i, '')
              .replace(/[_-]/g, ' ')
              .trim();
            
            bots.push({
              id: `xml-${index}`,
              name: botName,
              description: `${config.tradeType || 'Trading'} bot - ${config.symbol || 'Default'}`,
              source: 'xml',
              fileName: fileName,
              tradeType: config.tradeType || config.tradeTypeCategory || 'Unknown',
              symbol: config.symbol || 'R_100',
              parameters: {
                riskPercent: config.initialStake ? Math.min(config.initialStake / 100, 10) : 1,
                takeProfitPercent: config.targetProfit || 2,
                stopLossPercent: config.stopLoss || 1,
                maxTrades: config.martingale?.maxLoss ? Math.ceil(config.martingale.maxLoss / (config.initialStake || 1)) : 1,
              },
            });
          } catch (error: any) {
            // If parsing fails, still add the bot with basic info
            const botName = fileName.replace(/\.xml$/i, '').replace(/[_-]/g, ' ').trim();
            bots.push({
              id: `xml-${index}`,
              name: botName,
              description: `Trading bot from freetradingbots library`,
              source: 'xml',
              fileName: fileName,
              parameters: {
                riskPercent: 1,
                takeProfitPercent: 2,
                stopLossPercent: 1,
                maxTrades: 1,
              },
            });
          }
        });
      }
    } catch (error: any) {
      console.warn('Could not load XML bots:', error.message);
    }

    return NextResponse.json({
      success: true,
      data: bots,
      total: bots.length,
      registered: registeredStrategies.length,
      xml: bots.filter(b => b.source === 'xml').length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load bots' },
      { status: 500 }
    );
  }
}



