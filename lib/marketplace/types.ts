/**
 * Bot Marketplace Types
 * Type definitions for UI consumption
 */

import { BotMarketplaceDoc, RiskLevel, MarketType, BrokerSupport, AccountTypeSupport } from '@/database/models/bot-marketplace.model';

/**
 * Bot Summary (for listings/cards)
 */
export interface BotSummary {
  botId: string;
  displayName: string;
  shortDescription?: string;
  category: string;
  riskLevel: RiskLevel;
  supportedMarkets: MarketType[];
  supportedBrokers: BrokerSupport;
  accountTypeSupport: AccountTypeSupport;
  icon?: string;
  thumbnail?: string;
  isFeatured: boolean;
  isPremium: boolean;
  isVerified: boolean;
  pricing: {
    type: 'free' | 'one-time' | 'subscription';
    amount?: number;
    currency?: string;
  };
  performance?: {
    winRate?: number;
    averageProfit?: number;
    maxDrawdown?: number;
    profitFactor?: number;
  };
  totalUsers?: number;
}

/**
 * Bot Detail (full bot information)
 */
export interface BotDetail extends BotSummary {
  description: string;
  version: string;
  author?: string;
  authorUrl?: string;
  documentationUrl?: string;
  supportUrl?: string;
  tags: string[];
  configuration: BotMarketplaceDoc['configuration'];
  strategyConfig: BotMarketplaceDoc['strategyConfig'];
  fullPerformance?: BotMarketplaceDoc['performance'];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bot Configuration Form Data
 * For UI form rendering
 */
export interface BotConfigurationFormData {
  stake: number;
  stopLoss: {
    enabled: boolean;
    value: number;
  };
  takeProfit: {
    enabled: boolean;
    value: number;
  };
  maxTrades: {
    perDay?: number;
    perSession?: number;
    concurrent?: number;
  };
  additionalParams: Record<string, any>;
}

/**
 * Bot Filter Options
 */
export interface BotFilterOptions {
  category?: string;
  riskLevel?: RiskLevel;
  broker?: 'exness' | 'deriv';
  accountType?: 'demo' | 'live';
  market?: MarketType;
  isPremium?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  search?: string; // Search in name/description
}

/**
 * Bot Sort Options
 */
export type BotSortOption = 
  | 'popular' // By total users
  | 'newest' // By creation date
  | 'winRate' // By win rate
  | 'profitFactor' // By profit factor
  | 'name' // Alphabetical
  | 'featured'; // Featured first

/**
 * Bot Search Result
 */
export interface BotSearchResult {
  bots: BotSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Bot Installation Request
 */
export interface BotInstallationRequest {
  botId: string;
  userId: string;
  configuration: BotConfigurationFormData;
  broker: 'exness' | 'deriv';
  instrument: string;
  accountType: 'demo' | 'live';
}

/**
 * Bot Installation Result
 */
export interface BotInstallationResult {
  success: boolean;
  botInstanceId?: string;
  error?: string;
}

/**
 * Convert BotMarketplaceDoc to BotSummary
 */
export function toBotSummary(doc: BotMarketplaceDoc): BotSummary {
  return {
    botId: doc.botId,
    displayName: doc.metadata.displayName,
    shortDescription: doc.metadata.shortDescription,
    category: doc.metadata.category,
    riskLevel: doc.metadata.riskLevel,
    supportedMarkets: doc.metadata.supportedMarkets,
    supportedBrokers: doc.metadata.supportedBrokers,
    accountTypeSupport: doc.metadata.accountTypeSupport,
    icon: doc.metadata.icon,
    thumbnail: doc.metadata.thumbnail,
    isFeatured: doc.isFeatured,
    isPremium: doc.isPremium,
    isVerified: doc.isVerified,
    pricing: {
      type: doc.pricing?.type || 'free',
      amount: doc.pricing?.amount,
      currency: doc.pricing?.currency || 'USD',
    },
    performance: doc.performance ? {
      winRate: doc.performance.winRate,
      averageProfit: doc.performance.averageProfit,
      maxDrawdown: doc.performance.maxDrawdown,
      profitFactor: doc.performance.profitFactor,
    } : undefined,
    totalUsers: doc.totalUsers,
  };
}

/**
 * Convert BotMarketplaceDoc to BotDetail
 */
export function toBotDetail(doc: BotMarketplaceDoc): BotDetail {
  return {
    ...toBotSummary(doc),
    description: doc.metadata.description,
    version: doc.metadata.version,
    author: doc.metadata.author,
    authorUrl: doc.metadata.authorUrl,
    documentationUrl: doc.metadata.documentationUrl,
    supportUrl: doc.metadata.supportUrl,
    tags: doc.metadata.tags,
    configuration: doc.configuration,
    strategyConfig: doc.strategyConfig,
    fullPerformance: doc.performance,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

