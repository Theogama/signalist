import { getSignals } from '@/lib/actions/signals.actions';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';
import SignalsList from '@/components/SignalsList';
import CreateSignalForm from '@/components/CreateSignalForm';
import SignalFilters from '@/components/SignalFilters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string; source?: string; search?: string }> | { status?: string; action?: string; source?: string; search?: string };
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  
  // Resolve searchParams if it's a Promise (Next.js 15+)
  const resolvedSearchParams = searchParams instanceof Promise 
    ? await searchParams 
    : searchParams;
  
  // Check if user has active auto-trading bots using the new system
  let hasActiveBot = false;
  if (userId) {
    try {
      const userBots = botManager.getUserBots(userId);
      hasActiveBot = userBots.some(bot => bot.isRunning);
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  }

  // Validate and sanitize action parameter
  const actionParam = resolvedSearchParams.action;
  const validAction = actionParam === 'BUY' || actionParam === 'SELL' ? actionParam : undefined;

  const signalsResult = await getSignals({
    status: resolvedSearchParams.status || 'active',
    action: validAction,
    limit: 100,
  });
  
  let signals = signalsResult.success && 'data' in signalsResult ? signalsResult.data || [] : [];
  
  // Client-side filtering for search and source (since they're not in the API yet)
  if (resolvedSearchParams.search) {
    const searchLower = resolvedSearchParams.search.toLowerCase();
    signals = signals.filter((s: any) => 
      s.symbol?.toLowerCase().includes(searchLower) || 
      s.ticker?.toLowerCase().includes(searchLower)
    );
  }
  
  if (resolvedSearchParams.source && resolvedSearchParams.source !== 'all') {
    signals = signals.filter((s: any) => s.source === resolvedSearchParams.source);
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
          {!hasActiveBot && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-sm text-yellow-400">
                Start auto-trading in <Link href="/autotrade" className="underline font-semibold hover:text-yellow-300">Auto Trading</Link> to execute trades automatically
              </p>
            </div>
          )}
          <CreateSignalForm />
        </div>
      </div>

      <SignalFilters />

      <SignalsList signals={signals} isBotEnabled={hasActiveBot} />
    </div>
  );
}

