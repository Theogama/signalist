/**
 * Strategy Generator
 * Generates TypeScript strategy files from parsed bot configs
 */

import { ParsedBotConfig, XmlBotParser } from './XmlBotParser';
import * as fs from 'fs';
import * as path from 'path';

export class StrategyGenerator {
  private parser: XmlBotParser;

  constructor() {
    this.parser = new XmlBotParser();
  }

  /**
   * Generate strategy from XML file
   */
  generateFromXml(xmlFilePath: string, outputDir: string): string {
    const config = this.parser.parseXmlFile(xmlFilePath);
    const strategyType = this.parser.getStrategyType(config);
    const params = this.parser.toStrategyParams(config);
    
    const strategyCode = this.generateStrategyCode(config, strategyType, params);
    const fileName = this.sanitizeFileName(config.name) + '.ts';
    const outputPath = path.join(outputDir, fileName);

    fs.writeFileSync(outputPath, strategyCode, 'utf-8');
    return outputPath;
  }

  /**
   * Generate strategy code
   */
  private generateStrategyCode(
    config: ParsedBotConfig,
    strategyType: string,
    params: Record<string, any>
  ): string {
    const className = this.sanitizeClassName(config.name);
    const baseStrategy = this.getBaseStrategy(strategyType);

    return `/**
 * ${config.name}
 * Generated from XML bot configuration
 * 
 * Original Config:
 * - Symbol: ${config.symbol}
 * - Trade Type: ${config.tradeType}
 * - Candle Interval: ${config.candleInterval}s
 * - Duration: ${config.duration} ${config.durationType}
 * - Martingale: ${config.martingale.enabled ? 'Enabled' : 'Disabled'}
 */

import { ${baseStrategy} } from '../strategies/${baseStrategy}';
import { StrategySignal, MarketData } from '../types';

export class ${className} extends ${baseStrategy} {
  constructor(config: any) {
    super('${config.name}', {
      name: '${config.name}',
      enabled: true,
      riskPercent: ${params.riskPercent || 1},
      takeProfitPercent: ${params.takeProfitPercent || 2},
      stopLossPercent: ${params.stopLossPercent || 1},
      maxConcurrentTrades: ${params.maxConcurrentTrades || 1},
      parameters: {
        ${this.generateParametersString(params)}
        symbol: '${config.symbol}',
        tradeType: '${config.tradeType}',
        candleInterval: ${config.candleInterval},
        duration: ${config.duration},
        durationType: '${config.durationType}',
      },
    });
  }

  async analyze(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null> {
    ${this.generateAnalyzeLogic(config, strategyType)}
  }

  async shouldExit(position: any, marketData: MarketData): Promise<boolean> {
    if (position.stopLoss && position.takeProfit) {
      if (position.side === 'BUY') {
        return marketData.last <= position.stopLoss || marketData.last >= position.takeProfit;
      } else {
        return marketData.last >= position.stopLoss || marketData.last <= position.takeProfit;
      }
    }
    return false;
  }
}
`;
  }

  /**
   * Get base strategy class name
   */
  private getBaseStrategy(strategyType: string): string {
    const strategyMap: Record<string, string> = {
      'EvenOdd': 'EvenOddStrategy',
      'RiseFall': 'RiseFallStrategy',
      'Digits': 'DigitsStrategy',
      'OverUnder': 'BaseStrategy',
      'Generic': 'BaseStrategy',
    };

    return strategyMap[strategyType] || 'BaseStrategy';
  }

  /**
   * Generate parameters string
   */
  private generateParametersString(params: Record<string, any>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'riskPercent' && key !== 'takeProfitPercent' && key !== 'stopLossPercent' && key !== 'maxConcurrentTrades') {
        if (typeof value === 'string') {
          lines.push(`${key}: '${value}',`);
        } else {
          lines.push(`${key}: ${JSON.stringify(value)},`);
        }
      }
    }
    return lines.join('\n        ');
  }

  /**
   * Generate analyze logic based on strategy type
   */
  private generateAnalyzeLogic(config: ParsedBotConfig, strategyType: string): string {
    switch (strategyType) {
      case 'EvenOdd':
        return this.generateEvenOddLogic(config);
      case 'RiseFall':
        return this.generateRiseFallLogic(config);
      case 'Digits':
        return this.generateDigitsLogic(config);
      default:
        return this.generateGenericLogic(config);
    }
  }

  private generateEvenOddLogic(config: ParsedBotConfig): string {
    return `
    if (!historicalData || historicalData.length < 2) {
      return null;
    }

    const lastPrice = marketData.last;
    const lastDigit = Math.floor(lastPrice * 100) % 10;
    const isEven = lastDigit % 2 === 0;

    // Determine side based on even/odd pattern
    const recent = historicalData.slice(-3);
    const recentDigits = recent.map(d => Math.floor(d.last * 100) % 10);
    const recentEven = recentDigits.map(d => d % 2 === 0);

    let side: 'BUY' | 'SELL' | null = null;
    if (recentEven[0] && recentEven[1]) {
      side = 'BUY';
    } else if (!recentEven[0] && !recentEven[1]) {
      side = 'SELL';
    } else {
      side = isEven ? 'BUY' : 'SELL';
    }

    if (!side) return null;

    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence: 0.6,
      reason: \`Last digit is \${isEven ? 'even' : 'odd'}\`,
      timestamp: new Date(),
    };`;
  }

  private generateRiseFallLogic(config: ParsedBotConfig): string {
    return `
    if (!historicalData || historicalData.length < 5) {
      return null;
    }

    const recent = historicalData.slice(-5);
    const prices = recent.map(d => d.last);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = lastPrice - firstPrice;
    const isRising = priceChange > 0;
    const recentMomentum = prices[prices.length - 1] > prices[prices.length - 2];

    if (!isRising && !recentMomentum) {
      return null;
    }

    const side = isRising && recentMomentum ? 'BUY' : 'SELL';
    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence: Math.min(Math.abs(priceChange / firstPrice) * 10, 0.9),
      reason: \`Price trend: \${isRising ? 'rising' : 'falling'}\`,
      timestamp: new Date(),
    };`;
  }

  private generateDigitsLogic(config: ParsedBotConfig): string {
    return `
    if (!historicalData || historicalData.length < 10) {
      return null;
    }

    const digits = historicalData.map(d => Math.floor(d.last * 100) % 10);
    const currentDigit = Math.floor(marketData.last * 100) % 10;

    const digitCounts = new Map<number, number>();
    digits.forEach(digit => {
      digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
    });

    const currentCount = digitCounts.get(currentDigit) || 0;
    const threshold = this.config.parameters?.digitThreshold || 3;
    const shouldMatch = currentCount >= threshold;

    if (!shouldMatch && currentCount >= threshold - 1) {
      return null;
    }

    const mostCommonDigit = Array.from(digitCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || currentDigit;

    const side = shouldMatch 
      ? (mostCommonDigit >= 5 ? 'BUY' : 'SELL')
      : (currentDigit >= 5 ? 'SELL' : 'BUY');

    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence: Math.min(currentCount / digits.length * 2, 0.9),
      reason: \`Digit analysis: \${shouldMatch ? 'match' : 'differ'}\`,
      timestamp: new Date(),
    };`;
  }

  private generateGenericLogic(config: ParsedBotConfig): string {
    return `
    // Generic strategy logic
    if (!historicalData || historicalData.length < 2) {
      return null;
    }

    const entryPrice = marketData.last;
    const side: 'BUY' | 'SELL' = 'BUY'; // Default - should be customized
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence: 0.5,
      reason: 'Generic strategy signal',
      timestamp: new Date(),
    };`;
  }

  /**
   * Sanitize file name
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Sanitize class name
   */
  private sanitizeClassName(name: string): string {
    const sanitized = this.sanitizeFileName(name);
    return sanitized
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Strategy';
  }
}







