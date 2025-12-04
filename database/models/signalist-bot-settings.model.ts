/**
 * Signalist Bot Settings Model
 * Unified settings for Signalist-SMA-3C strategy bot
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface SignalistBotSettingsDoc extends Document {
  userId: string;
  broker: 'exness' | 'deriv';
  instrument: string;
  enabled: boolean;
  riskPerTrade: number; // 1-50, default 10
  maxDailyLoss: number; // Percentage
  maxDailyTrades: number;
  tradeFrequency: 'once-per-candle';
  candleTimeframe: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  smaPeriod: number;
  smaPeriod2?: number;
  tpMultiplier: number; // Default 3
  slMethod: 'pips' | 'atr' | 'candle';
  slValue?: number;
  atrPeriod?: number;
  spikeDetectionEnabled: boolean;
  spikeThreshold?: number;
  strategy: 'Signalist-SMA-3C' | 'Custom';
  magicNumber?: number; // For Exness MT5
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  forceStopDrawdown?: number;
  forceStopConsecutiveLosses?: number;
  minTimeInTrade?: number;
  smaCrossLookback?: number;
  fiveMinTrendConfirmation: boolean;
  // Broker connection settings (encrypted)
  mt5Login?: number;
  mt5Password?: string; // Should be encrypted
  mt5Server?: string;
  derivToken?: string; // Should be encrypted
  createdAt: Date;
  updatedAt: Date;
}

const SignalistBotSettingsSchema = new Schema<SignalistBotSettingsDoc>(
  {
    userId: { type: String, required: true, index: true },
    broker: { type: String, enum: ['exness', 'deriv'], required: true },
    instrument: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    riskPerTrade: { type: Number, default: 10, min: 1, max: 50 },
    maxDailyLoss: { type: Number, default: 0, min: 0, max: 100 },
    maxDailyTrades: { type: Number, default: 0, min: 0 },
    tradeFrequency: { type: String, enum: ['once-per-candle'], default: 'once-per-candle' },
    candleTimeframe: {
      type: String,
      enum: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'],
      default: '5m',
    },
    smaPeriod: { type: Number, default: 50, min: 2 },
    smaPeriod2: { type: Number, min: 2 },
    tpMultiplier: { type: Number, default: 3, min: 1 },
    slMethod: { type: String, enum: ['pips', 'atr', 'candle'], default: 'atr' },
    slValue: { type: Number, min: 0 },
    atrPeriod: { type: Number, default: 14, min: 2 },
    spikeDetectionEnabled: { type: Boolean, default: false },
    spikeThreshold: { type: Number, min: 0, max: 100 },
    strategy: { type: String, enum: ['Signalist-SMA-3C', 'Custom'], default: 'Signalist-SMA-3C' },
    magicNumber: { type: Number, min: 0 },
    loggingLevel: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
    forceStopDrawdown: { type: Number, min: 0, max: 100 },
    forceStopConsecutiveLosses: { type: Number, min: 1 },
    minTimeInTrade: { type: Number, default: 1, min: 1 },
    smaCrossLookback: { type: Number, default: 8, min: 1 },
    fiveMinTrendConfirmation: { type: Boolean, default: true },
    // Broker credentials (should be encrypted in production)
    mt5Login: { type: Number },
    mt5Password: { type: String, select: false }, // Don't return by default
    mt5Server: { type: String },
    derivToken: { type: String, select: false }, // Don't return by default
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Index for quick lookups
SignalistBotSettingsSchema.index({ userId: 1, broker: 1, instrument: 1 }, { unique: false });
SignalistBotSettingsSchema.index({ userId: 1, enabled: 1 });

// Update updatedAt before save
SignalistBotSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const SignalistBotSettings: Model<SignalistBotSettingsDoc> =
  (models?.SignalistBotSettings as Model<SignalistBotSettingsDoc>) ||
  model<SignalistBotSettingsDoc>('SignalistBotSettings', SignalistBotSettingsSchema);


