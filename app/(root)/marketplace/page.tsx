/**
 * Bot Marketplace Page
 * Browse and discover trading bots
 */

import { Suspense } from 'react';
import BotMarketplaceClient from '@/components/marketplace/BotMarketplaceClient';

export const metadata = {
  title: 'Bot Marketplace | Signalist',
  description: 'Discover and install trading bots for automated trading',
};

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Bot Marketplace</h1>
        <p className="text-gray-400">
          Discover and install powerful trading bots for automated trading
        </p>
      </div>

      <Suspense fallback={<div className="text-gray-400">Loading marketplace...</div>}>
        <BotMarketplaceClient />
      </Suspense>
    </div>
  );
}

