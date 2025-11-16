import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * Trade status enum
 */
export type BotTradeStatus = 'PENDING' | 'FILLED' | 'CLOSED' | 'CANCELLED' | 'FAILED';

/**
 * Bot trade record tracking executed trades
 */
export interface BotTradeDoc extends Document {
  tradeId: string; // UUID
  signalId: string; // Reference to the signal that triggered this trade
  userId: string;
  symbol: string; // Trading pair (e.g., 'BTCUSDT')
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number; // Set when trade is closed
  quantity: number; // Amount of asset traded
  status: BotTradeStatus;
  profitLoss?: number; // Profit/loss in quote currency
  profitLossPct?: number; // Profit/loss percentage
  stopLossPrice?: number; // Stop loss price level
  takeProfitPrice?: number; // Take profit price level
  trailingStopEnabled: boolean;
  exchange: string; // Exchange where trade was executed
  exchangeOrderId?: string; // Order ID from exchange
  errorMessage?: string; // Error message if trade failed
  createdAt: Date;
  filledAt?: Date; // When order was filled
  closedAt?: Date; // When trade was closed
}

const BotTradeSchema = new Schema<BotTradeDoc>(
  {
    tradeId: { type: String, required: true, unique: true, index: true },
    signalId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    action: { type: String, enum: ['BUY', 'SELL'], required: true },
    entryPrice: { type: Number, required: true, min: 0 },
    exitPrice: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'FILLED', 'CLOSED', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    profitLoss: { type: Number },
    profitLossPct: { type: Number },
    stopLossPrice: { type: Number, min: 0 },
    takeProfitPrice: { type: Number, min: 0 },
    trailingStopEnabled: { type: Boolean, default: false },
    exchange: { type: String, required: true },
    exchangeOrderId: { type: String },
    errorMessage: { type: String },
    createdAt: { type: Date, default: Date.now },
    filledAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: false }
);

// Indexes for efficient queries
BotTradeSchema.index({ userId: 1, createdAt: -1 });
BotTradeSchema.index({ userId: 1, status: 1 });
BotTradeSchema.index({ signalId: 1 });

export const BotTrade: Model<BotTradeDoc> =
  (models?.BotTrade as Model<BotTradeDoc>) || model<BotTradeDoc>('BotTrade', BotTradeSchema);


