/**
 * Migration Script: Migrate from old auto-trading system to Signalist unified bot
 * 
 * Usage: npx ts-node scripts/migrate-to-signalist-bot.ts
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../database/mongoose';
import { UserBotSettings } from '../database/models/bot-settings.model';
import { SignalistBotSettings } from '../database/models/signalist-bot-settings.model';

async function migrate() {
  try {
    console.log('Starting migration to Signalist unified bot...');
    
    await connectToDatabase();
    console.log('Connected to database');

    // Get all old bot settings
    const oldSettings = await UserBotSettings.find({});
    console.log(`Found ${oldSettings.length} old bot settings to migrate`);

    const migrated: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const oldSetting of oldSettings) {
      try {
        // Check if already migrated
        const existing = await SignalistBotSettings.findOne({ userId: oldSetting.userId });
        if (existing) {
          console.log(`Settings for user ${oldSetting.userId} already exist, skipping...`);
          skipped.push(oldSetting.userId);
          continue;
        }

        // Map old settings to new format
        // Note: Old settings don't have broker/instrument info, so we need defaults
        const newSettings = {
          userId: oldSetting.userId,
          broker: 'exness' as const, // Default, user needs to update
          instrument: 'XAUUSD', // Default, user needs to update
          enabled: oldSetting.enabled || false,
          riskPerTrade: oldSetting.maxTradeSizePct || 10, // Map maxTradeSizePct to riskPerTrade
          maxDailyLoss: 0, // Not in old settings, default to 0 (disabled)
          maxDailyTrades: 0, // Not in old settings, default to 0 (disabled)
          tradeFrequency: 'once-per-candle' as const,
          candleTimeframe: '5m' as const, // Default
          smaPeriod: 50, // Default
          tpMultiplier: oldSetting.takeProfitPct && oldSetting.stopLossPct
            ? oldSetting.takeProfitPct / oldSetting.stopLossPct
            : 3, // Calculate from old TP/SL percentages
          slMethod: 'atr' as const, // Default
          atrPeriod: 14, // Default
          spikeDetectionEnabled: false,
          strategy: 'Signalist-SMA-3C' as const,
          loggingLevel: 'info' as const,
          fiveMinTrendConfirmation: true,
          // Map exchange to broker credentials if applicable
          // Note: Old settings use exchange field, new uses broker
          // This is a simplified mapping
          mt5Login: undefined, // User needs to provide
          mt5Password: undefined, // User needs to provide
          mt5Server: undefined, // User needs to provide
          derivToken: undefined, // User needs to provide
        };

        // Create new settings
        await SignalistBotSettings.create(newSettings);
        console.log(`Migrated settings for user ${oldSetting.userId}`);
        migrated.push(oldSetting.userId);
      } catch (error: any) {
        console.error(`Error migrating user ${oldSetting.userId}:`, error.message);
        errors.push({ userId: oldSetting.userId, error: error.message });
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Migrated: ${migrated.length}`);
    console.log(`Skipped (already exists): ${skipped.length}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((e) => {
        console.log(`  - User ${e.userId}: ${e.error}`);
      });
    }

    console.log('\n=== Important Notes ===');
    console.log('1. Migrated settings use default broker (Exness) and instrument (XAUUSD)');
    console.log('2. Users need to update broker credentials (MT5 login/password/server or Deriv token)');
    console.log('3. Users need to select their preferred instrument');
    console.log('4. Some settings were not available in old system and use defaults:');
    console.log('   - Max daily loss: 0 (disabled)');
    console.log('   - Max daily trades: 0 (disabled)');
    console.log('   - Candle timeframe: 5m (default)');
    console.log('   - SMA period: 50 (default)');
    console.log('\nMigration completed!');
  } catch (error: any) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrate();
}




