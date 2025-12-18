/**
 * Rollback Script: Restore old auto-trading system from backup
 * 
 * Usage: npx ts-node scripts/rollback-signalist-bot.ts
 * 
 * Note: This script assumes old bot settings were backed up before migration
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../database/mongoose';
import { SignalistBotSettings } from '../database/models/signalist-bot-settings.model';

async function rollback() {
  try {
    console.log('Starting rollback of Signalist unified bot...');
    console.log('WARNING: This will disable Signalist bot settings.');
    console.log('Old bot settings should be restored from backup if needed.');
    
    await connectToDatabase();
    console.log('Connected to database');

    // Disable all Signalist bot settings (don't delete to keep history)
    const result = await SignalistBotSettings.updateMany(
      { enabled: true },
      { enabled: false }
    );

    console.log(`Disabled ${result.modifiedCount} active bot instances`);
    console.log('\nRollback completed!');
    console.log('Note: Settings were disabled, not deleted. They can be re-enabled if needed.');
  } catch (error: any) {
    console.error('Rollback error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run rollback
if (require.main === module) {
  rollback();
}




