/**
 * Sample Bot Definitions for Signalist Marketplace
 * Pre-configured bot definitions ready for marketplace
 */

import { 
  BotMetadata, 
  BotConfiguration, 
  BotPerformanceMetrics,
  RiskLevel,
  MarketType,
  BrokerSupport,
  AccountTypeSupport
} from '@/database/models/bot-marketplace.model';

/**
 * Bot Definition (plain object, not Mongoose document)
 */
export interface BotDefinition {
  botId: string;
  metadata: BotMetadata;
  configuration: BotConfiguration;
  performance?: BotPerformanceMetrics;
  strategyConfig: {
    strategyType: string;
    strategyModule?: string;
    requiredIndicators?: string[];
    requiredTimeframes?: string[];
    strategyParams?: Record<string, any>;
  };
  isActive: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  isVerified: boolean;
  totalUsers?: number;
  activeUsers?: number;
  totalTrades?: number;
  pricing?: {
    type: 'free' | 'one-time' | 'subscription';
    amount?: number;
    currency?: string;
    subscriptionPeriod?: 'monthly' | 'yearly';
  };
}

/**
 * Sample Bot Definitions
 * These can be seeded into the database
 */
export const sampleBotDefinitions: BotDefinition[] = [
  {
    botId: 'signalist-sma-3c',
    metadata: {
      name: 'signalist-sma-3c',
      displayName: 'Signalist SMA-3C',
      description: 'Advanced trend-following strategy using 3-candle alignment with SMA confirmation. Ideal for synthetic indices and forex markets. Features spike detection and 5-minute trend confirmation.',
      shortDescription: 'Trend-following strategy with 3-candle alignment and SMA confirmation',
      category: 'trend-following',
      tags: ['trend', 'sma', 'synthetic', 'forex', 'automated'],
      riskLevel: 'medium',
      supportedMarkets: ['synthetic', 'forex'],
      supportedBrokers: 'both',
      accountTypeSupport: 'both',
      strategyName: 'Signalist-SMA-3C',
      version: '1.0.0',
      author: 'Signalist',
      icon: '📈',
      thumbnail: '/images/bots/signalist-sma-3c.png',
      documentationUrl: '/docs/bots/signalist-sma-3c',
    },
    configuration: {
      stake: {
        min: 1,
        max: 10000,
        default: 10,
        step: 1,
      },
      stopLoss: {
        enabled: true,
        type: 'atr',
        default: 2, // 2x ATR
      },
      takeProfit: {
        enabled: true,
        type: 'risk-reward',
        default: 3, // 3:1 risk-reward ratio
        riskRewardRatio: 3,
      },
      maxTrades: {
        perDay: 50,
        concurrent: 1, // Sequential execution
        default: 1,
      },
      additionalParams: {
        smaPeriod: {
          type: 'number',
          label: 'SMA Period',
          description: 'Period for primary SMA',
          default: 50,
          min: 10,
          max: 200,
          required: true,
        },
        smaPeriod2: {
          type: 'number',
          label: 'Secondary SMA Period',
          description: 'Period for secondary SMA (optional)',
          default: 100,
          min: 20,
          max: 300,
        },
        candleTimeframe: {
          type: 'select',
          label: 'Candle Timeframe',
          description: 'Timeframe for candle analysis',
          default: '5m',
          options: ['1m', '3m', '5m', '15m', '30m', '1h'],
          required: true,
        },
        spikeDetectionEnabled: {
          type: 'boolean',
          label: 'Enable Spike Detection',
          description: 'Detect price spikes for Boom/Crash instruments',
          default: false,
        },
        spikeThreshold: {
          type: 'number',
          label: 'Spike Threshold',
          description: 'Minimum spike percentage to trigger',
          default: 0.5,
          min: 0.1,
          max: 5,
        },
        fiveMinTrendConfirmation: {
          type: 'boolean',
          label: '5-Min Trend Confirmation',
          description: 'Require 5-minute trend confirmation',
          default: true,
        },
      },
    },
    strategyConfig: {
      strategyType: 'Signalist-SMA-3C',
      requiredIndicators: ['SMA', 'ATR'],
      requiredTimeframes: ['5m'],
      strategyParams: {
        smaPeriod: 50,
        smaPeriod2: 100,
        smaCrossLookback: 8,
        atrPeriod: 14,
        atrMultiplier: 2,
      },
    },
    performance: {
      winRate: 65.5,
      averageProfit: 12.5,
      maxDrawdown: 15.2,
      totalTrades: 1250,
      profitFactor: 1.85,
      sharpeRatio: 1.42,
      backtestPeriod: '2023-01-01 to 2024-01-01',
    },
    isActive: true,
    isFeatured: true,
    isPremium: false,
    isVerified: true,
    totalUsers: 0,
    activeUsers: 0,
    totalTrades: 0,
    pricing: {
      type: 'free',
    },
  },
  {
    botId: 'conservative-scalper',
    metadata: {
      name: 'conservative-scalper',
      displayName: 'Conservative Scalper',
      description: 'Low-risk scalping strategy designed for quick profits with tight stop losses. Best for synthetic indices with high volatility. Uses short timeframes and quick exits.',
      shortDescription: 'Low-risk scalping for quick profits',
      category: 'scalping',
      tags: ['scalping', 'low-risk', 'synthetic', 'quick-profit'],
      riskLevel: 'low',
      supportedMarkets: ['synthetic'],
      supportedBrokers: 'deriv',
      accountTypeSupport: 'both',
      strategyName: 'Conservative-Scalper',
      version: '1.0.0',
      author: 'Signalist',
      icon: '⚡',
      thumbnail: '/images/bots/conservative-scalper.png',
    },
    configuration: {
      stake: {
        min: 1,
        max: 5000,
        default: 5,
        step: 1,
      },
      stopLoss: {
        enabled: true,
        type: 'pips',
        default: 5,
        min: 2,
        max: 10,
      },
      takeProfit: {
        enabled: true,
        type: 'pips',
        default: 10,
        min: 5,
        max: 20,
      },
      maxTrades: {
        perDay: 100,
        concurrent: 1,
        default: 1,
      },
      additionalParams: {
        timeframe: {
          type: 'select',
          label: 'Timeframe',
          default: '1m',
          options: ['1m', '3m'],
          required: true,
        },
        maxConsecutiveLosses: {
          type: 'number',
          label: 'Max Consecutive Losses',
          description: 'Stop after N consecutive losses',
          default: 3,
          min: 1,
          max: 10,
        },
      },
    },
    strategyConfig: {
      strategyType: 'Conservative-Scalper',
      requiredIndicators: ['RSI', 'EMA'],
      requiredTimeframes: ['1m'],
    },
    performance: {
      winRate: 72.3,
      averageProfit: 3.2,
      maxDrawdown: 8.5,
      totalTrades: 2100,
      profitFactor: 2.1,
    },
    isActive: true,
    isFeatured: false,
    isPremium: false,
    isVerified: true,
    totalUsers: 0,
    activeUsers: 0,
    totalTrades: 0,
    pricing: {
      type: 'free',
    },
  },
  {
    botId: 'trend-follower-pro',
    metadata: {
      name: 'trend-follower-pro',
      displayName: 'Trend Follower Pro',
      description: 'Advanced trend-following strategy using multiple moving averages and momentum indicators. Designed for forex and synthetic indices. Features dynamic stop loss and trailing take profit.',
      shortDescription: 'Advanced trend-following with multiple indicators',
      category: 'trend-following',
      tags: ['trend', 'forex', 'synthetic', 'advanced', 'momentum'],
      riskLevel: 'high',
      supportedMarkets: ['forex', 'synthetic'],
      supportedBrokers: 'both',
      accountTypeSupport: 'both',
      strategyName: 'Trend-Follower-Pro',
      version: '1.0.0',
      author: 'Signalist',
      icon: '🚀',
      thumbnail: '/images/bots/trend-follower-pro.png',
    },
    configuration: {
      stake: {
        min: 5,
        max: 20000,
        default: 20,
        step: 5,
      },
      stopLoss: {
        enabled: true,
        type: 'atr',
        default: 2.5,
        min: 1.5,
        max: 5,
      },
      takeProfit: {
        enabled: true,
        type: 'risk-reward',
        default: 4,
        riskRewardRatio: 4,
      },
      maxTrades: {
        perDay: 30,
        concurrent: 1,
        default: 1,
      },
      additionalParams: {
        emaFast: {
          type: 'number',
          label: 'Fast EMA Period',
          default: 12,
          min: 5,
          max: 50,
          required: true,
        },
        emaSlow: {
          type: 'number',
          label: 'Slow EMA Period',
          default: 26,
          min: 15,
          max: 100,
          required: true,
        },
        rsiPeriod: {
          type: 'number',
          label: 'RSI Period',
          default: 14,
          min: 7,
          max: 30,
        },
        trailingStop: {
          type: 'boolean',
          label: 'Enable Trailing Stop',
          default: true,
        },
      },
    },
    strategyConfig: {
      strategyType: 'Trend-Follower-Pro',
      requiredIndicators: ['EMA', 'RSI', 'MACD', 'ATR'],
      requiredTimeframes: ['15m', '1h'],
      strategyParams: {
        emaFast: 12,
        emaSlow: 26,
        rsiPeriod: 14,
      },
    },
    performance: {
      winRate: 58.2,
      averageProfit: 25.8,
      maxDrawdown: 22.5,
      totalTrades: 850,
      profitFactor: 1.65,
      sharpeRatio: 1.28,
    },
    isActive: true,
    isFeatured: true,
    isPremium: true,
    isVerified: true,
    totalUsers: 0,
    activeUsers: 0,
    totalTrades: 0,
    pricing: {
      type: 'subscription',
      amount: 29.99,
      currency: 'USD',
      subscriptionPeriod: 'monthly',
    },
  },
  {
    botId: 'breakout-hunter',
    metadata: {
      name: 'breakout-hunter',
      displayName: 'Breakout Hunter',
      description: 'Detects and trades breakouts from consolidation patterns. Uses volume analysis and support/resistance levels. Best for forex and synthetic indices during volatile periods.',
      shortDescription: 'Breakout detection and trading strategy',
      category: 'breakout',
      tags: ['breakout', 'volatility', 'forex', 'synthetic'],
      riskLevel: 'medium',
      supportedMarkets: ['forex', 'synthetic'],
      supportedBrokers: 'both',
      accountTypeSupport: 'both',
      strategyName: 'Breakout-Hunter',
      version: '1.0.0',
      author: 'Signalist',
      icon: '🎯',
      thumbnail: '/images/bots/breakout-hunter.png',
    },
    configuration: {
      stake: {
        min: 1,
        max: 15000,
        default: 15,
        step: 1,
      },
      stopLoss: {
        enabled: true,
        type: 'percentage',
        default: 2,
        min: 1,
        max: 5,
      },
      takeProfit: {
        enabled: true,
        type: 'risk-reward',
        default: 2.5,
        riskRewardRatio: 2.5,
      },
      maxTrades: {
        perDay: 40,
        concurrent: 1,
        default: 1,
      },
      additionalParams: {
        consolidationPeriod: {
          type: 'number',
          label: 'Consolidation Period',
          description: 'Candles to look back for consolidation',
          default: 20,
          min: 10,
          max: 50,
        },
        breakoutThreshold: {
          type: 'number',
          label: 'Breakout Threshold',
          description: 'Percentage move to confirm breakout',
          default: 0.5,
          min: 0.2,
          max: 2,
        },
      },
    },
    strategyConfig: {
      strategyType: 'Breakout-Hunter',
      requiredIndicators: ['Volume', 'Support/Resistance'],
      requiredTimeframes: ['15m', '1h'],
    },
    performance: {
      winRate: 61.5,
      averageProfit: 18.3,
      maxDrawdown: 18.7,
      totalTrades: 950,
      profitFactor: 1.72,
    },
    isActive: true,
    isFeatured: false,
    isPremium: false,
    isVerified: true,
    totalUsers: 0,
    activeUsers: 0,
    totalTrades: 0,
    pricing: {
      type: 'free',
    },
  },
];

/**
 * Get bot definition by ID
 */
export function getBotDefinition(botId: string): typeof sampleBotDefinitions[0] | undefined {
  return sampleBotDefinitions.find(bot => bot.botId === botId);
}

/**
 * Get all active bot definitions
 */
export function getActiveBotDefinitions(): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.isActive);
}

/**
 * Get featured bot definitions
 */
export function getFeaturedBotDefinitions(): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.isFeatured && bot.isActive);
}

/**
 * Get free bot definitions
 */
export function getFreeBotDefinitions(): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.pricing?.type === 'free' && bot.isActive);
}

/**
 * Get premium bot definitions
 */
export function getPremiumBotDefinitions(): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.isPremium && bot.isActive);
}

/**
 * Get bots by category
 */
export function getBotsByCategory(category: string): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.metadata.category === category && bot.isActive);
}

/**
 * Get bots by risk level
 */
export function getBotsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(bot => bot.metadata.riskLevel === riskLevel && bot.isActive);
}

/**
 * Get bots by broker
 */
export function getBotsByBroker(broker: 'exness' | 'deriv'): typeof sampleBotDefinitions {
  return sampleBotDefinitions.filter(
    bot => 
      (bot.metadata.supportedBrokers === 'both' || bot.metadata.supportedBrokers === broker) &&
      bot.isActive
  );
}

