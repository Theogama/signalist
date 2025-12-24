/**
 * Signalist Bot Trade Model
 * Tracks all trades executed by Signalist bot
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface SignalistBotTradeDoc extends Document {
  tradeId: string; // UUID
  userId: string;
  botId?: string; // Bot ID that executed this trade
  broker: 'exness' | 'deriv';
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  lotOrStake: number;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED' | 'TP_HIT' | 'SL_HIT' | 'REVERSE_SIGNAL' | 'MANUAL_CLOSE' | 'FORCE_STOP';
  realizedPnl?: number;
  realizedPnlPercent?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
  entryReason?: string; // Signal reason
  exitReason?: string;
  entryTimestamp: Date;
  exitTimestamp?: Date;
  brokerTradeId?: string; // Internal broker trade ID
  isDemo?: boolean; // Whether this is a demo trade
  createdAt: Date;
  updatedAt: Date;
}

const SignalistBotTradeSchema = new Schema<SignalistBotTradeDoc>(
  {
    tradeId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    botId: { type: String, index: true }, // Index for bot performance queries
    broker: { type: String, enum: ['exness', 'deriv'], required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, index: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    entryPrice: { type: Number, required: true, min: 0 },
    exitPrice: { type: Number, min: 0 },
    lotOrStake: { type: Number, required: true, min: 0 },
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'],
      default: 'OPEN',
      index: true,
    },
    realizedPnl: { type: Number },
    realizedPnlPercent: { type: Number },
    unrealizedPnl: { type: Number },
    unrealizedPnlPercent: { type: Number },
    entryReason: { type: String },
    exitReason: { type: String },
    entryTimestamp: { type: Date, required: true, default: Date.now, index: true },
    exitTimestamp: { type: Date, index: true },
    brokerTradeId: { type: String },
    isDemo: { type: Boolean, default: false, index: true }, // Track demo vs live trades
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes for efficient queries
SignalistBotTradeSchema.index({ userId: 1, entryTimestamp: -1 });
SignalistBotTradeSchema.index({ userId: 1, status: 1 });
SignalistBotTradeSchema.index({ userId: 1, broker: 1, status: 1 });
SignalistBotTradeSchema.index({ symbol: 1, entryTimestamp: -1 });
SignalistBotTradeSchema.index({ botId: 1, entryTimestamp: -1 }); // Bot performance queries
SignalistBotTradeSchema.index({ userId: 1, botId: 1, entryTimestamp: -1 }); // User bot performance
SignalistBotTradeSchema.index({ userId: 1, isDemo: 1, entryTimestamp: -1 }); // Demo vs live separation

// Update updatedAt before save
SignalistBotTradeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const SignalistBotTrade: Model<SignalistBotTradeDoc> =
  (models?.SignalistBotTrade as Model<SignalistBotTradeDoc>) ||
  model<SignalistBotTradeDoc>('SignalistBotTrade', SignalistBotTradeSchema);








