/**
 * Auto-Trading Session Model
 * Tracks active auto-trading sessions for users
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AutoTradingSessionDoc extends Document {
  sessionId: string; // UUID
  userId: string; // User identifier
  broker: 'deriv' | 'exness';
  strategy: string; // Strategy name/identifier
  status: 'active' | 'stopped' | 'paused' | 'error';
  startedAt: Date;
  stoppedAt?: Date;
  totalTrades: number; // Trades executed in this session
  totalProfitLoss: number; // Total P/L for this session
  startBalance: number; // Balance at session start
  endBalance?: number; // Balance at session end
  riskSettings: {
    maxTradesPerDay: number;
    dailyLossLimit: number;
    maxStakeSize: number;
    autoStopDrawdown?: number;
  };
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AutoTradingSessionSchema = new Schema<AutoTradingSessionDoc>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    broker: { type: String, enum: ['deriv', 'exness'], required: true, index: true },
    strategy: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'stopped', 'paused', 'error'],
      default: 'active',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    stoppedAt: { type: Date, index: true },
    totalTrades: { type: Number, default: 0 },
    totalProfitLoss: { type: Number, default: 0 },
    startBalance: { type: Number, required: true, min: 0 },
    endBalance: { type: Number, min: 0 },
    riskSettings: {
      maxTradesPerDay: { type: Number, default: 0 },
      dailyLossLimit: { type: Number, default: 0 },
      maxStakeSize: { type: Number, default: 0 },
      autoStopDrawdown: { type: Number },
    },
    errorMessage: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes
AutoTradingSessionSchema.index({ userId: 1, status: 1 });
AutoTradingSessionSchema.index({ userId: 1, startedAt: -1 });
AutoTradingSessionSchema.index({ broker: 1, status: 1 });

// Update updatedAt before save
AutoTradingSessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const AutoTradingSession: Model<AutoTradingSessionDoc> =
  (models?.AutoTradingSession as Model<AutoTradingSessionDoc>) ||
  model<AutoTradingSessionDoc>('AutoTradingSession', AutoTradingSessionSchema);

