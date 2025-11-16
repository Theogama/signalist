import BrokerManager from '@/components/BrokerManager';

export const dynamic = 'force-dynamic';

export default async function BrokersSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Broker Connections</h1>
        <p className="text-gray-400">
          Connect your trading accounts to enable live trading. All API keys are encrypted and stored securely.
        </p>
      </div>

      <BrokerManager />
    </div>
  );
}

