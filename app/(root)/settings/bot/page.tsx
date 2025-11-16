import { getBotSettings, updateBotSettings } from '@/lib/actions/bot.actions';
import BotSettingsForm from '@/components/BotSettingsForm';
import BrokerManager from '@/components/BrokerManager';

export const dynamic = 'force-dynamic';

export default async function BotSettingsPage() {
  const settingsResult = await getBotSettings();
  
  // Get settings or use defaults (already plain objects from .lean())
  const settings = settingsResult.success && 'data' in settingsResult && settingsResult.data
    ? settingsResult.data
    : {
        enabled: false,
        maxTradeSizePct: 5,
        stopLossPct: 2,
        takeProfitPct: 5,
        trailingStop: false,
        exchange: 'binance',
        paperMode: true,
      };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Bot Settings</h1>
        <p className="text-gray-400">
          Configure your auto-trading bot settings. Enable paper trading mode to test strategies without real money.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <BotSettingsForm initialSettings={settings} />
        </div>
        <div>
          <BrokerManager />
        </div>
      </div>
    </div>
  );
}

