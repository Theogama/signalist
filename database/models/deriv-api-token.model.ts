/**
 * Deriv API Token Model
 * Stores encrypted Deriv API tokens for users
 */

import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface DerivApiTokenDoc extends Document {
  userId: string; // Unique user identifier
  token: string; // Encrypted API token
  accountType: 'demo' | 'real'; // Account type
  accountId?: string; // Deriv account ID
  accountBalance?: number; // Last known balance
  accountCurrency?: string; // Account currency (e.g., 'USD')
  isValid: boolean; // Token validation status
  lastValidatedAt?: Date; // Last validation timestamp
  scopes?: string[]; // Token scopes (trade, read, payments)
  expiresAt?: Date; // Token expiration (if applicable)
  createdAt: Date;
  updatedAt: Date;
}

const DerivApiTokenSchema = new Schema<DerivApiTokenDoc>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    token: { type: String, required: true, select: false }, // Encrypted, don't return by default
    accountType: { type: String, enum: ['demo', 'real'], required: true, index: true },
    accountId: { type: String, index: true },
    accountBalance: { type: Number, min: 0 },
    accountCurrency: { type: String, default: 'USD' },
    isValid: { type: Boolean, default: false, index: true },
    lastValidatedAt: { type: Date },
    scopes: { type: [String], default: [] },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes
DerivApiTokenSchema.index({ userId: 1 });
DerivApiTokenSchema.index({ accountType: 1, isValid: 1 });
DerivApiTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Update updatedAt before save
DerivApiTokenSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const DerivApiToken: Model<DerivApiTokenDoc> =
  (models?.DerivApiToken as Model<DerivApiTokenDoc>) ||
  model<DerivApiTokenDoc>('DerivApiToken', DerivApiTokenSchema);

