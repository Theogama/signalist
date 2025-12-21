/**
 * Auto-Trading Session Model
 * Tracks active auto-trading sessions for users
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AutoTradingSessionDoc extends Document {
  sessionId: string; // UUID
  userId: string; // User identifier
  derivTokenId?: string; // Reference to DerivApiToken
  broker: 'deriv' | 'exness';
  strategy: string; // Strategy name/identifier
  status: 'idle' | 'starting' | 'active' | 'paused' | 'stopping' | 'stopped' | 'error';
  startedAt: Date;
  stoppedAt?: Date;
  lastTradeAt?: Date; // Last trade execution timestamp
  
  // Risk Settings (stored as JSON)
  riskSettings: {
    maxTradesPerDay: number;
    dailyLossLimit: number;
    maxStakeSize: number;
    riskPerTrade: number; // Percentage
    autoStopDrawdown?: number; // Percentage
    maxConsecutiveLosses?: number;
  };
  
  // Signal Filters (stored as JSON)
  signalFilters?: {
    symbols?: string[];
    sources?: string[];
    strategies?: string[];
  };
  
  // Performance Metrics (calculated)
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfitLoss: number;
  currentDrawdown: number;
  maxDrawdown: number;
  dailyTradeCount: number;
  dailyProfitLoss: number;
  consecutiveLosses: number;
  
  // Session Metadata
  startBalance: number; // Balance at session start
  currentBalance?: number; // Current balance
  endBalance?: number; // Balance at session end
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AutoTradingSessionSchema = new Schema<AutoTradingSessionDoc>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    derivTokenId: { type: String, index: true },
    broker: { type: String, enum: ['deriv', 'exness'], required: true, index: true },
    strategy: { type: String, required: true },
    status: {
      type: String,
      enum: ['idle', 'starting', 'active', 'paused', 'stopping', 'stopped', 'error'],
      default: 'idle',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    stoppedAt: { type: Date, index: true },
    lastTradeAt: { type: Date, index: true },
    
    // Risk Settings
    riskSettings: {
      maxTradesPerDay: { type: Number, default: 0 },
      dailyLossLimit: { type: Number, default: 0 },
      maxStakeSize: { type: Number, default: 0 },
      riskPerTrade: { type: Number, default: 1 }, // Percentage
      autoStopDrawdown: { type: Number },
      maxConsecutiveLosses: { type: Number },
    },
    
    // Signal Filters
    signalFilters: {
      symbols: { type: [String], default: [] },
      sources: { type: [String], default: [] },
      strategies: { type: [String], default: [] },
    },
    
    // Performance Metrics
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    totalProfitLoss: { type: Number, default: 0 },
    currentDrawdown: { type: Number, default: 0 },
    maxDrawdown: { type: Number, default: 0 },
    dailyTradeCount: { type: Number, default: 0 },
    dailyProfitLoss: { type: Number, default: 0 },
    consecutiveLosses: { type: Number, default: 0 },
    
    // Session Metadata
    startBalance: { type: Number, required: true, min: 0 },
    currentBalance: { type: Number, min: 0 },
    endBalance: { type: Number, min: 0 },
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
AutoTradingSessionSchema.index({ userId: 1, broker: 1, status: 1 }); // Composite for active session lookup
AutoTradingSessionSchema.index({ startedAt: -1 }); // For time-based queries

// Update updatedAt before save
AutoTradingSessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const AutoTradingSession: Model<AutoTradingSessionDoc> =
  (models?.AutoTradingSession as Model<AutoTradingSessionDoc>) ||
  model<AutoTradingSessionDoc>('AutoTradingSession', AutoTradingSessionSchema);


