/**
 * Bot Marketplace Detail API
 * GET: Get detailed information about a specific bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { BotMarketplace } from '@/database/models/bot-marketplace.model';
import { toBotDetail } from '@/lib/marketplace/types';
import { getBotDefinition } from '@/lib/marketplace/sample-bot-definitions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { botId } = await params;

    await connectToDatabase();

    // Try to get from database first
    const botDoc = await BotMarketplace.findOne({ botId, isActive: true }).lean();

    if (botDoc) {
      const botDetail = toBotDetail(botDoc as any);
      return NextResponse.json({
        success: true,
        data: botDetail,
      });
    }

    // Fallback to sample definitions
    const sampleBot = getBotDefinition(botId);
    if (sampleBot) {
      // Convert sample bot to BotDetail format
      const botDetail = {
        botId: sampleBot.botId,
        displayName: sampleBot.metadata.displayName,
        shortDescription: sampleBot.metadata.shortDescription,
        category: sampleBot.metadata.category,
        riskLevel: sampleBot.metadata.riskLevel,
        supportedMarkets: sampleBot.metadata.supportedMarkets,
        supportedBrokers: sampleBot.metadata.supportedBrokers,
        accountTypeSupport: sampleBot.metadata.accountTypeSupport,
        icon: sampleBot.metadata.icon,
        thumbnail: sampleBot.metadata.thumbnail,
        isFeatured: sampleBot.isFeatured,
        isPremium: sampleBot.isPremium,
        isVerified: sampleBot.isVerified,
        pricing: {
          type: sampleBot.pricing?.type || 'free',
          amount: sampleBot.pricing?.amount,
          currency: sampleBot.pricing?.currency || 'USD',
        },
        performance: sampleBot.performance ? {
          winRate: sampleBot.performance.winRate,
          averageProfit: sampleBot.performance.averageProfit,
          maxDrawdown: sampleBot.performance.maxDrawdown,
          profitFactor: sampleBot.performance.profitFactor,
        } : undefined,
        totalUsers: sampleBot.totalUsers,
        description: sampleBot.metadata.description,
        version: sampleBot.metadata.version,
        author: sampleBot.metadata.author,
        authorUrl: sampleBot.metadata.authorUrl,
        documentationUrl: sampleBot.metadata.documentationUrl,
        supportUrl: sampleBot.metadata.supportUrl,
        tags: sampleBot.metadata.tags,
        configuration: sampleBot.configuration,
        strategyConfig: sampleBot.strategyConfig,
        fullPerformance: sampleBot.performance,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return NextResponse.json({
        success: true,
        data: botDetail,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Bot not found',
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[Marketplace API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load bot details',
      },
      { status: 500 }
    );
  }
}


