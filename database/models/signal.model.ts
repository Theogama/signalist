import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * Signal action type
 */
export type SignalAction = 'BUY' | 'SELL';

/**
 * Signal source type
 */
export type SignalSource = 'manual' | 'algorithm' | 'external_api' | 'user_alert';

/**
 * Signal status
 */
export type SignalStatus = 'active' | 'executed' | 'expired' | 'cancelled';

/**
 * Trading signal document
 */
export interface SignalDoc extends Document {
  signalId: string; // UUID
  userId?: string; // Optional: user-specific signal
  symbol: string; // Stock/crypto symbol (e.g., 'AAPL', 'BTCUSDT')
  ticker: string; // Full ticker symbol
  action: SignalAction; // BUY or SELL
  price: number; // Target/entry price
  stopLoss?: number; // Optional stop loss price
  takeProfit?: number; // Optional take profit price
  source: SignalSource; // Where the signal came from
  status: SignalStatus; // Current status
  description?: string; // Optional description/notes
  expiresAt?: Date; // Optional expiration time
  metadata?: Record<string, any>; // Additional data
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema<SignalDoc>(
  {
    signalId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true }, // Optional user association
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    ticker: { type: String, required: true, trim: true },
    action: { type: String, enum: ['BUY', 'SELL'], required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    stopLoss: { type: Number, min: 0 },
    takeProfit: { type: Number, min: 0 },
    source: {
      type: String,
      enum: ['manual', 'algorithm', 'external_api', 'user_alert'],
      default: 'manual',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'executed', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    description: { type: String },
    expiresAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes for efficient queries
SignalSchema.index({ status: 1, createdAt: -1 });
SignalSchema.index({ symbol: 1, status: 1 });
SignalSchema.index({ userId: 1, status: 1 });
SignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired signals

export const Signal: Model<SignalDoc> =
  (models?.Signal as Model<SignalDoc>) || model<SignalDoc>('Signal', SignalSchema);


