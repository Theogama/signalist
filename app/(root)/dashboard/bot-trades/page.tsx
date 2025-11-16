import { getBotTrades } from '@/lib/actions/bot.actions';
import BotTradesTable from '@/components/BotTradesTable';

export const dynamic = 'force-dynamic';

export default async function BotTradesPage({
  searchParams,
}: {
  searchParams: { status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' };
}) {
  const tradesResult = await getBotTrades({
    status: searchParams.status,
    sortBy: searchParams.sortBy || 'createdAt',
    sortOrder: searchParams.sortOrder || 'desc',
    limit: 100,
  });

  const trades = tradesResult.success && 'data' in tradesResult ? tradesResult.data || [] : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Bot Trades</h1>
        <p className="text-gray-400">View and manage your automated trading history</p>
      </div>

      <BotTradesTable initialTrades={trades} />
    </div>
  );
}

