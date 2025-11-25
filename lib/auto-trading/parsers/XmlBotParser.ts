/**
 * XML Bot Parser
 * Parses Deriv Binary Bot XML files and extracts trading logic
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParsedBotConfig {
  name: string;
  symbol: string;
  tradeType: string;
  tradeTypeCategory: string;
  contractType: string;
  candleInterval: number;
  duration: number;
  durationType: 't' | 's';
  variables: Record<string, any>;
  martingale: {
    enabled: boolean;
    multiplier?: number;
    maxLoss?: number;
    stopLoss?: number;
  };
  targetProfit?: number;
  stopLoss?: number;
  initialStake?: number;
  winStake?: number;
}

export class XmlBotParser {
  constructor() {
    // No external dependencies needed - using regex-based parsing
  }

  /**
   * Parse XML file and extract bot configuration
   */
  parseXmlFile(filePath: string): ParsedBotConfig {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    return this.parseXml(xmlContent, path.basename(filePath, '.xml'));
  }

  /**
   * Parse XML content string using regex-based parsing
   */
  parseXml(xmlContent: string, botName: string = 'Unknown'): ParsedBotConfig {
    // Extract variables using regex
    const variables = this.extractVariablesRegex(xmlContent);
    
    // Extract symbol
    const symbolMatch = xmlContent.match(/<field name="SYMBOL_LIST">([^<]+)<\/field>/);
    const symbol = symbolMatch ? symbolMatch[1].trim() : 'R_100';

    // Extract trade type
    const tradeTypeMatch = xmlContent.match(/<field name="TRADETYPE_LIST">([^<]+)<\/field>/);
    const tradeType = tradeTypeMatch ? tradeTypeMatch[1].trim() : '';

    // Extract trade type category
    const tradeTypeCatMatch = xmlContent.match(/<field name="TRADETYPECAT_LIST">([^<]+)<\/field>/);
    const tradeTypeCategory = tradeTypeCatMatch ? tradeTypeCatMatch[1].trim() : '';

    // Extract contract type
    const contractTypeMatch = xmlContent.match(/<field name="TYPE_LIST">([^<]+)<\/field>/);
    const contractType = contractTypeMatch ? contractTypeMatch[1].trim() : 'both';

    // Extract candle interval
    const candleIntervalMatch = xmlContent.match(/<field name="CANDLEINTERVAL_LIST">([^<]+)<\/field>/);
    const candleInterval = candleIntervalMatch ? parseInt(candleIntervalMatch[1].trim()) : 60;

    // Extract duration
    const durationMatch = xmlContent.match(/<field name="NUM">(\d+)<\/field>[\s\S]*?DURATION/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 1;

    // Extract duration type
    const durationTypeMatch = xmlContent.match(/<field name="DURATIONTYPE_LIST">([^<]+)<\/field>/);
    const durationType = (durationTypeMatch ? durationTypeMatch[1].trim() : 't') as 't' | 's';

    // Extract martingale settings
    const martingale = this.extractMartingaleSettingsRegex(xmlContent, variables);

    // Extract target profit and stop loss using regex
    const targetProfit = this.extractNumberVariableRegex(xmlContent, ['Target Profit', 'TARGET PROFIT', 'Expected Profit']);
    const stopLoss = this.extractNumberVariableRegex(xmlContent, ['Stop Loss', 'STOP LOSS', 'Max Acceptable Loss', 'Max Loss Amount']);
    const initialStake = this.extractNumberVariableRegex(xmlContent, ['Initial Stake', 'Initial Amount', 'STAKE AWAL', 'Stake/Modal']);
    const winStake = this.extractNumberVariableRegex(xmlContent, ['Win Stake', 'Win Amount']);

    return {
      name: botName,
      symbol,
      tradeType,
      tradeTypeCategory,
      contractType,
      candleInterval,
      duration,
      durationType,
      variables,
      martingale,
      targetProfit,
      stopLoss,
      initialStake,
      winStake,
    };
  }

  /**
   * Extract all variables from XML using regex
   */
  private extractVariablesRegex(xmlContent: string): Record<string, any> {
    const variables: Record<string, any> = {};
    const varRegex = /<variable[^>]*>([^<]+)<\/variable>/g;
    let match;

    while ((match = varRegex.exec(xmlContent)) !== null) {
      const varName = match[1].trim();
      if (varName && !varName.startsWith('text')) {
        variables[varName] = null;
      }
    }

    return variables;
  }

  /**
   * Extract number variable value using regex
   */
  private extractNumberVariableRegex(
    xmlContent: string,
    possibleNames: string[]
  ): number | undefined {
    for (const name of possibleNames) {
      // Look for variable definition with this name
      const varPattern = new RegExp(`<variable[^>]*>${this.escapeRegex(name)}</variable>`, 'i');
      if (varPattern.test(xmlContent)) {
        // Try to find initialization value
        const initPattern = new RegExp(
          `<field name="VAR"[^>]*>${this.escapeRegex(name)}</field>[\\s\\S]*?<field name="NUM">(\\d+(?:\\.\\d+)?)</field>`,
          'i'
        );
        const match = xmlContent.match(initPattern);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }
    return undefined;
  }

  /**
   * Extract martingale settings using regex
   */
  private extractMartingaleSettingsRegex(
    xmlContent: string,
    variables: Record<string, any>
  ): { enabled: boolean; multiplier?: number; maxLoss?: number; stopLoss?: number } {
    const martingaleVars = ['Marti', 'MARTI', 'Martingale', 'Marti/Pengali', 'MG Multiple'];
    
    let multiplier: number | undefined;
    for (const varName of martingaleVars) {
      const value = this.extractNumberVariableRegex(xmlContent, [varName]);
      if (value !== undefined) {
        multiplier = value;
        break;
      }
    }

    // Check if martingale is used (MULTIPLY operation in after_purchase)
    const hasMartingale = xmlContent.includes('MULTIPLY') || multiplier !== undefined;

    const maxLoss = this.extractNumberVariableRegex(xmlContent, ['Max Acceptable Loss', 'Max Loss Amount', 'MaxLostStake']);
    const stopLoss = this.extractNumberVariableRegex(xmlContent, ['Stop Loss', 'STOP LOSS']);

    return {
      enabled: hasMartingale,
      multiplier: multiplier || 2,
      maxLoss,
      stopLoss,
    };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Determine strategy type from trade type
   */
  getStrategyType(config: ParsedBotConfig): string {
    const tradeType = config.tradeType.toLowerCase();
    const category = config.tradeTypeCategory.toLowerCase();

    if (category === 'digits') {
      if (tradeType.includes('evenodd') || tradeType.includes('even_odd')) {
        return 'EvenOdd';
      }
      if (tradeType.includes('matches') || tradeType.includes('differs')) {
        return 'Digits';
      }
      if (tradeType.includes('over') || tradeType.includes('under')) {
        return 'OverUnder';
      }
    }

    if (category === 'callput' || tradeType.includes('callput')) {
      return 'RiseFall';
    }

    return 'Generic';
  }

  /**
   * Convert parsed config to strategy parameters
   */
  toStrategyParams(config: ParsedBotConfig): Record<string, any> {
    const params: Record<string, any> = {
      riskPercent: 1,
      takeProfitPercent: config.targetProfit ? (config.targetProfit / 100) : 2,
      stopLossPercent: config.stopLoss ? (config.stopLoss / 100) : 1,
      maxConcurrentTrades: 1,
    };

    if (config.martingale.enabled) {
      params.martingale = true;
      params.martingaleMultiplier = config.martingale.multiplier || 2;
      params.maxConsecutiveLosses = config.martingale.maxLoss || 5;
    }

    if (config.initialStake) {
      params.initialStake = config.initialStake;
    }

    if (config.winStake) {
      params.winStake = config.winStake;
    }

    // Add strategy-specific parameters
    if (config.tradeTypeCategory === 'digits') {
      params.lookbackPeriod = 10;
      params.digitThreshold = 3;
    }

    if (config.tradeTypeCategory === 'callput') {
      params.lookbackPeriod = 5;
    }

    return params;
  }
}

