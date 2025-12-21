import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * User bot settings for auto-trading configuration
 */
export interface UserBotSettingsDoc extends Document {
  userId: string;
  enabled: boolean;
  maxTradeSizePct: number; // Maximum trade size as percentage of account balance (0-100)
  stopLossPct: number; // Stop loss percentage (0-100)
  takeProfitPct: number; // Take profit percentage (0-100)
  trailingStop: boolean; // Enable trailing stop loss
  exchange: string; // Exchange name (e.g., 'binance', 'coinbase')
  apiKey?: string; // Encrypted API key
  apiSecret?: string; // Encrypted API secret
  paperMode: boolean; // Paper trading mode (simulated trades)
  updatedAt: Date;
  createdAt: Date;
}

const UserBotSettingsSchema = new Schema<UserBotSettingsDoc>(
  {
    userId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    maxTradeSizePct: { type: Number, default: 5, min: 0.1, max: 100 }, // Default 5% of balance
    stopLossPct: { type: Number, default: 2, min: 0.1, max: 50 }, // Default 2% stop loss
    takeProfitPct: { type: Number, default: 5, min: 0.1, max: 100 }, // Default 5% take profit
    trailingStop: { type: Boolean, default: false },
    exchange: { type: String, default: 'binance', enum: ['binance', 'coinbase', 'kraken'] },
    apiKey: { type: String, select: false }, // Don't return by default for security
    apiSecret: { type: String, select: false }, // Don't return by default for security
    paperMode: { type: Boolean, default: true }, // Default to paper mode for safety
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Index for quick lookups
UserBotSettingsSchema.index({ userId: 1 });

export const UserBotSettings: Model<UserBotSettingsDoc> =
  (models?.UserBotSettings as Model<UserBotSettingsDoc>) ||
  model<UserBotSettingsDoc>('UserBotSettings', UserBotSettingsSchema);

// Alias export for backward compatibility
export const BotSettings = UserBotSettings;

// Default export for backward compatibility (some files may import as default)
export default UserBotSettings;


