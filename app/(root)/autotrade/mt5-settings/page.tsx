/**
 * MT5 Auto-Trade Settings Page
 * Complete settings page for MT5 auto-trading
 */

import MT5AutoTradeSettings from '@/components/autotrade/MT5AutoTradeSettings';

export const dynamic = 'force-dynamic';

export default function MT5SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Auto-Trade Settings</h1>
        <p className="text-gray-400">Configure your MT5 auto-trading bot</p>
      </div>
      <MT5AutoTradeSettings />
    </div>
  );
}




