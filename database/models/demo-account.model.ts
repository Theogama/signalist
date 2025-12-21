import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * Demo Trading Account
 * Stores persistent demo balance and trading account information
 */
export interface DemoAccountDoc extends Document {
  userId: string; // Unique user identifier
  broker: 'exness' | 'deriv' | 'demo'; // Broker type
  balance: number; // Account balance
  equity: number; // Current equity (balance + unrealized P&L)
  margin: number; // Used margin
  freeMargin: number; // Available margin
  currency: string; // Account currency (default: USD)
  initialBalance: number; // Starting balance
  totalProfitLoss: number; // Total realized P&L
  totalTrades: number; // Total number of trades
  winningTrades: number; // Number of winning trades
  losingTrades: number; // Number of losing trades
  createdAt: Date;
  updatedAt: Date;
}

const DemoAccountSchema = new Schema<DemoAccountDoc>(
  {
    userId: { type: String, required: true },
    broker: { 
      type: String, 
      enum: ['exness', 'deriv', 'demo'], 
      default: 'demo',
      index: true 
    },
    balance: { type: Number, required: true, default: 10000, min: 0 },
    equity: { type: Number, required: true, default: 10000, min: 0 },
    margin: { type: Number, required: true, default: 0, min: 0 },
    freeMargin: { type: Number, required: true, default: 10000, min: 0 },
    currency: { type: String, default: 'USD' },
    initialBalance: { type: Number, required: true, default: 10000, min: 0 },
    totalProfitLoss: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes - unique compound index for one account per user per broker
DemoAccountSchema.index({ userId: 1, broker: 1 }, { unique: true });

// Update updatedAt before save
DemoAccountSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const DemoAccount: Model<DemoAccountDoc> =
  (models?.DemoAccount as Model<DemoAccountDoc>) || 
  model<DemoAccountDoc>('DemoAccount', DemoAccountSchema);

