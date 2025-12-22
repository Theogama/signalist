/**
 * Bot Marketplace Model
 * Stores bot definitions for the Signalist bot marketplace
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * Risk Level Enum
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Market Type
 */
export type MarketType = 'forex' | 'synthetic' | 'crypto' | 'commodities' | 'indices';

/**
 * Broker Support
 */
export type BrokerSupport = 'exness' | 'deriv' | 'both';

/**
 * Account Type Support
 */
export type AccountTypeSupport = 'demo' | 'live' | 'both';

/**
 * Bot Configuration Schema
 */
export interface BotConfiguration {
  // Position Sizing
  stake: {
    min: number;
    max: number;
    default: number;
    step?: number; // Increment step
  };
  
  // Risk Management
  stopLoss: {
    enabled: boolean;
    type: 'percentage' | 'pips' | 'atr' | 'fixed';
    min?: number;
    max?: number;
    default?: number;
  };
  
  takeProfit: {
    enabled: boolean;
    type: 'percentage' | 'pips' | 'atr' | 'fixed' | 'risk-reward';
    min?: number;
    max?: number;
    default?: number;
    riskRewardRatio?: number; // If type is 'risk-reward'
  };
  
  // Trade Limits
  maxTrades: {
    perDay?: number;
    perSession?: number;
    concurrent?: number; // Max concurrent positions
    default?: number;
  };
  
  // Additional Parameters
  additionalParams?: Record<string, {
    type: 'number' | 'boolean' | 'string' | 'select';
    label: string;
    description?: string;
    default?: any;
    min?: number;
    max?: number;
    options?: string[]; // For select type
    required?: boolean;
  }>;
}

/**
 * Bot Metadata
 */
export interface BotMetadata {
  name: string;
  displayName: string;
  description: string;
  shortDescription?: string; // For cards/previews
  category: string; // e.g., 'trend-following', 'scalping', 'swing-trading'
  tags: string[]; // For search/filtering
  riskLevel: RiskLevel;
  supportedMarkets: MarketType[];
  supportedBrokers: BrokerSupport;
  accountTypeSupport: AccountTypeSupport;
  strategyName: string; // Strategy identifier
  version: string; // Bot version
  author?: string;
  authorUrl?: string;
  icon?: string; // Icon URL or identifier
  thumbnail?: string; // Thumbnail image URL
  documentationUrl?: string;
  supportUrl?: string;
}

/**
 * Bot Performance Metrics (for display)
 */
export interface BotPerformanceMetrics {
  winRate?: number; // Percentage
  averageProfit?: number;
  maxDrawdown?: number;
  totalTrades?: number;
  profitFactor?: number;
  sharpeRatio?: number;
  lastUpdated?: Date;
  backtestPeriod?: string; // e.g., "2023-01-01 to 2024-01-01"
}

/**
 * Bot Marketplace Document
 */
export interface BotMarketplaceDoc extends Document {
  // Unique identifier
  botId: string; // Unique bot identifier (e.g., 'signalist-sma-3c', 'trend-follower-v1')
  
  // Metadata
  metadata: BotMetadata;
  
  // Configuration Schema
  configuration: BotConfiguration;
  
  // Performance Metrics (optional, for display)
  performance?: BotPerformanceMetrics;
  
  // Strategy Configuration
  strategyConfig: {
    strategyType: string; // Strategy class/type identifier
    strategyModule?: string; // Module path if external
    requiredIndicators?: string[]; // Required technical indicators
    requiredTimeframes?: string[]; // Required timeframes
    strategyParams?: Record<string, any>; // Strategy-specific parameters
  };
  
  // Status
  isActive: boolean; // Available in marketplace
  isFeatured: boolean; // Featured bot
  isPremium: boolean; // Premium/paid bot
  isVerified: boolean; // Verified by Signalist team
  
  // Usage Stats
  totalUsers?: number;
  activeUsers?: number;
  totalTrades?: number;
  
  // Pricing (if premium)
  pricing?: {
    type: 'free' | 'one-time' | 'subscription';
    amount?: number;
    currency?: string;
    subscriptionPeriod?: 'monthly' | 'yearly';
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

const BotMarketplaceSchema = new Schema<BotMarketplaceDoc>(
  {
    botId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    metadata: {
      name: { type: String, required: true },
      displayName: { type: String, required: true },
      description: { type: String, required: true },
      shortDescription: { type: String },
      category: { type: String, required: true, index: true },
      tags: { type: [String], default: [], index: true },
      riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true, index: true },
      supportedMarkets: { type: [String], enum: ['forex', 'synthetic', 'crypto', 'commodities', 'indices'], required: true },
      supportedBrokers: { type: String, enum: ['exness', 'deriv', 'both'], required: true, index: true },
      accountTypeSupport: { type: String, enum: ['demo', 'live', 'both'], required: true },
      strategyName: { type: String, required: true },
      version: { type: String, required: true, default: '1.0.0' },
      author: { type: String },
      authorUrl: { type: String },
      icon: { type: String },
      thumbnail: { type: String },
      documentationUrl: { type: String },
      supportUrl: { type: String },
    },
    configuration: {
      stake: {
        min: { type: Number, required: true },
        max: { type: Number, required: true },
        default: { type: Number, required: true },
        step: { type: Number },
      },
      stopLoss: {
        enabled: { type: Boolean, default: true },
        type: { type: String, enum: ['percentage', 'pips', 'atr', 'fixed'], required: true },
        min: { type: Number },
        max: { type: Number },
        default: { type: Number },
      },
      takeProfit: {
        enabled: { type: Boolean, default: true },
        type: { type: String, enum: ['percentage', 'pips', 'atr', 'fixed', 'risk-reward'], required: true },
        min: { type: Number },
        max: { type: Number },
        default: { type: Number },
        riskRewardRatio: { type: Number },
      },
      maxTrades: {
        perDay: { type: Number },
        perSession: { type: Number },
        concurrent: { type: Number, default: 1 },
        default: { type: Number },
      },
      additionalParams: { type: Schema.Types.Mixed },
    },
    performance: {
      winRate: { type: Number },
      averageProfit: { type: Number },
      maxDrawdown: { type: Number },
      totalTrades: { type: Number },
      profitFactor: { type: Number },
      sharpeRatio: { type: Number },
      lastUpdated: { type: Date },
      backtestPeriod: { type: String },
    },
    strategyConfig: {
      strategyType: { type: String, required: true },
      strategyModule: { type: String },
      requiredIndicators: { type: [String] },
      requiredTimeframes: { type: [String] },
      strategyParams: { type: Schema.Types.Mixed },
    },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isPremium: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false, index: true },
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 },
    pricing: {
      type: { type: String, enum: ['free', 'one-time', 'subscription'], default: 'free' },
      amount: { type: Number },
      currency: { type: String, default: 'USD' },
      subscriptionPeriod: { type: String, enum: ['monthly', 'yearly'] },
    },
    publishedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes for efficient queries
BotMarketplaceSchema.index({ 'metadata.category': 1, isActive: 1 });
BotMarketplaceSchema.index({ 'metadata.riskLevel': 1, isActive: 1 });
BotMarketplaceSchema.index({ 'metadata.supportedBrokers': 1, isActive: 1 });
BotMarketplaceSchema.index({ isFeatured: 1, isActive: 1 });
BotMarketplaceSchema.index({ isPremium: 1, isActive: 1 });
BotMarketplaceSchema.index({ 'metadata.tags': 1 });
BotMarketplaceSchema.index({ createdAt: -1 });

// Update updatedAt before save
BotMarketplaceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.isNew && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

export const BotMarketplace: Model<BotMarketplaceDoc> =
  (models?.BotMarketplace as Model<BotMarketplaceDoc>) ||
  model<BotMarketplaceDoc>('BotMarketplace', BotMarketplaceSchema);

