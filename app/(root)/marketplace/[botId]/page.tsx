/**
 * Bot Detail Page
 * View detailed information about a specific bot
 */

import { Suspense } from 'react';
import BotDetailClient from '@/components/marketplace/BotDetailClient';
import { notFound } from 'next/navigation';

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Suspense fallback={<div className="text-gray-400">Loading bot details...</div>}>
        <BotDetailClient botId={botId} />
      </Suspense>
    </div>
  );
}

