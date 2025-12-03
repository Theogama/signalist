import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ProfileSettingsClient from '@/components/settings/ProfileSettingsClient';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DemoAccount } from '@/database/models/demo-account.model';

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user) {
    redirect('/sign-in');
  }

  await connectToDatabase();

  // Get user trading statistics
  const userId = session.user.id;
  
  const [trades, accounts] = await Promise.all([
    SignalistBotTrade.find({ userId })
      .sort({ entryTimestamp: -1 })
      .limit(100)
      .lean(),
    DemoAccount.find({ userId }).lean(),
  ]);

  const closedTrades = trades.filter(t => 
    ['CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'].includes(t.status)
  );
  const openTrades = trades.filter(t => t.status === 'OPEN');

  const totalProfitLoss = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalInitialBalance = accounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
  const totalROI = totalInitialBalance > 0 
    ? ((totalBalance - totalInitialBalance) / totalInitialBalance) * 100 
    : 0;

  const user = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
  };

  const stats = {
    totalTrades,
    openTrades: openTrades.length,
    totalProfitLoss,
    winRate,
    totalBalance,
    totalROI,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Profile Settings</h1>
        <p className="text-gray-400">
          Manage your account information, trading preferences, and Signalist settings
        </p>
      </div>

      <ProfileSettingsClient user={user} stats={stats} />
    </div>
  );
}

