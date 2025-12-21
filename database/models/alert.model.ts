import { Schema, model, models, type Document, type Model } from 'mongoose';

export type AlertCondition = 'greater' | 'less';

export interface PriceAlertDoc extends Document {
  userId: string;
  symbol: string;
  company: string;
  targetPrice: number;
  condition: AlertCondition; // when current price is greater/less than target
  active: boolean;
  createdAt: Date;
}

const AlertSchema = new Schema<PriceAlertDoc>(
  {
    userId: { type: String, required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    targetPrice: { type: Number, required: true, min: 0 },
    condition: { type: String, enum: ['greater', 'less'], required: true },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Optional helpful index for common queries
AlertSchema.index({ userId: 1, symbol: 1, active: 1 });

export const PriceAlert: Model<PriceAlertDoc> =
  (models?.PriceAlert as Model<PriceAlertDoc>) || model<PriceAlertDoc>('PriceAlert', AlertSchema);
