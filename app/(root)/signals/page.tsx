import { getBotSettings } from '@/lib/actions/bot.actions';
import { getSignals } from '@/lib/actions/signals.actions';
import SignalsList from '@/components/SignalsList';
import CreateSignalForm from '@/components/CreateSignalForm';
import SignalFilters from '@/components/SignalFilters';

export const dynamic = 'force-dynamic';

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: { status?: string; action?: string; source?: string; search?: string };
}) {
  const [botSettings, signalsResult] = await Promise.all([
    getBotSettings(),
    getSignals({
      status: (searchParams.status as any) || 'active',
      action: searchParams.action as 'BUY' | 'SELL' | undefined,
      limit: 100,
    }),
  ]);
  
  const isBotEnabled = botSettings.success && 'data' in botSettings && botSettings.data?.enabled;
  let signals = signalsResult.success && 'data' in signalsResult ? signalsResult.data || [] : [];
  
  // Client-side filtering for search and source (since they're not in the API yet)
  if (searchParams.search) {
    const searchLower = searchParams.search.toLowerCase();
    signals = signals.filter((s: any) => 
      s.symbol.toLowerCase().includes(searchLower) || 
      s.ticker.toLowerCase().includes(searchLower)
    );
  }
  
  if (searchParams.source && searchParams.source !== 'all') {
    signals = signals.filter((s: any) => s.source === searchParams.source);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Trading Signals</h1>
          <p className="text-gray-400">
            View trading signals and execute automated trades with your bot
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!isBotEnabled && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-sm text-yellow-400">
                Enable auto-trading in <a href="/settings/bot" className="underline font-semibold">Bot Settings</a> to execute trades automatically
              </p>
            </div>
          )}
          <CreateSignalForm />
        </div>
      </div>

      <SignalFilters />

      <SignalsList signals={signals} isBotEnabled={isBotEnabled || false} />
    </div>
  );
}

