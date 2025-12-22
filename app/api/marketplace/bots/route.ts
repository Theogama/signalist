/**
 * Bot Marketplace API
 * GET: List all bots from marketplace
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { BotMarketplace } from '@/database/models/bot-marketplace.model';
import { toBotSummary, toBotDetail, BotFilterOptions, BotSortOption } from '@/lib/marketplace/types';
import { sampleBotDefinitions } from '@/lib/marketplace/sample-bot-definitions';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel') as 'low' | 'medium' | 'high' | null;
    const broker = searchParams.get('broker') as 'exness' | 'deriv' | null;
    const accountType = searchParams.get('accountType') as 'demo' | 'live' | null;
    const market = searchParams.get('market');
    const isPremium = searchParams.get('isPremium');
    const isFeatured = searchParams.get('isFeatured');
    const tags = searchParams.get('tags')?.split(',');
    const search = searchParams.get('search');
    const sort = (searchParams.get('sort') as BotSortOption) || 'popular';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Build filter query
    const filter: any = { isActive: true };

    if (category) {
      filter['metadata.category'] = category;
    }

    if (riskLevel) {
      filter['metadata.riskLevel'] = riskLevel;
    }

    if (broker) {
      filter['metadata.supportedBrokers'] = { $in: [broker, 'both'] };
    }

    if (accountType) {
      filter['metadata.accountTypeSupport'] = { $in: [accountType, 'both'] };
    }

    if (market) {
      filter['metadata.supportedMarkets'] = market;
    }

    if (isPremium === 'true') {
      filter.isPremium = true;
    } else if (isPremium === 'false') {
      filter.isPremium = false;
    }

    if (isFeatured === 'true') {
      filter.isFeatured = true;
    }

    if (tags && tags.length > 0) {
      filter['metadata.tags'] = { $in: tags };
    }

    if (search) {
      filter.$or = [
        { 'metadata.displayName': { $regex: search, $options: 'i' } },
        { 'metadata.description': { $regex: search, $options: 'i' } },
        { 'metadata.tags': { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort query
    let sortQuery: any = {};
    switch (sort) {
      case 'popular':
        sortQuery = { totalUsers: -1, createdAt: -1 };
        break;
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      case 'winRate':
        sortQuery = { 'performance.winRate': -1 };
        break;
      case 'profitFactor':
        sortQuery = { 'performance.profitFactor': -1 };
        break;
      case 'name':
        sortQuery = { 'metadata.displayName': 1 };
        break;
      case 'featured':
        sortQuery = { isFeatured: -1, totalUsers: -1 };
        break;
      default:
        sortQuery = { totalUsers: -1, createdAt: -1 };
    }

    // Query database
    const skip = (page - 1) * pageSize;
    const [bots, total] = await Promise.all([
      BotMarketplace.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      BotMarketplace.countDocuments(filter),
    ]);

    // Get unique botIds from database to prevent duplicates
    const dbBotIds = new Set(bots.map(bot => bot.botId));

    // If no bots in database, return sample bots (only on first page)
    // Otherwise, merge sample bots that don't exist in database
    let allBots = [...bots];
    let totalCount = total;

    if (page === 1) {
      // Filter sample bots based on query params
      let filteredSamples = sampleBotDefinitions.filter(bot => {
        // Exclude bots that already exist in database to prevent duplicates
        if (dbBotIds.has(bot.botId)) return false;
        return bot.isActive;
      });

      if (category) {
        filteredSamples = filteredSamples.filter(bot => bot.metadata.category === category);
      }
      if (riskLevel) {
        filteredSamples = filteredSamples.filter(bot => bot.metadata.riskLevel === riskLevel);
      }
      if (broker) {
        filteredSamples = filteredSamples.filter(
          bot => bot.metadata.supportedBrokers === broker || bot.metadata.supportedBrokers === 'both'
        );
      }
      if (accountType) {
        filteredSamples = filteredSamples.filter(
          bot => bot.metadata.accountTypeSupport === accountType || bot.metadata.accountTypeSupport === 'both'
        );
      }
      if (market) {
        filteredSamples = filteredSamples.filter(bot => bot.metadata.supportedMarkets.includes(market as any));
      }
      if (isPremium === 'true') {
        filteredSamples = filteredSamples.filter(bot => bot.isPremium);
      } else if (isPremium === 'false') {
        filteredSamples = filteredSamples.filter(bot => !bot.isPremium);
      }
      if (isFeatured === 'true') {
        filteredSamples = filteredSamples.filter(bot => bot.isFeatured);
      }
      if (tags && tags.length > 0) {
        filteredSamples = filteredSamples.filter(bot =>
          bot.metadata.tags.some(tag => tags.includes(tag))
        );
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filteredSamples = filteredSamples.filter(
          bot =>
            bot.metadata.displayName.toLowerCase().includes(searchLower) ||
            bot.metadata.description.toLowerCase().includes(searchLower) ||
            bot.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Convert sample bots to database-like format for consistent processing
      const sampleBotsAsDocs = filteredSamples.map(bot => ({
        _id: `sample-${bot.botId}`,
        botId: bot.botId,
        metadata: bot.metadata,
        configuration: bot.configuration,
        performance: bot.performance,
        strategyConfig: bot.strategyConfig,
        isActive: bot.isActive,
        isFeatured: bot.isFeatured,
        isPremium: bot.isPremium,
        isVerified: bot.isVerified,
        totalUsers: bot.totalUsers || 0,
        activeUsers: bot.activeUsers || 0,
        totalTrades: bot.totalTrades || 0,
        pricing: bot.pricing || { type: 'free' as const, currency: 'USD' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Merge database bots with sample bots (database bots take priority)
      // Deduplicate by botId to ensure no duplicates
      const mergedBotsMap = new Map<string, any>();
      
      // Add database bots first (they take priority)
      bots.forEach(bot => {
        mergedBotsMap.set(bot.botId, bot);
      });
      
      // Add sample bots only if they don't already exist
      sampleBotsAsDocs.forEach(bot => {
        if (!mergedBotsMap.has(bot.botId)) {
          mergedBotsMap.set(bot.botId, bot);
        }
      });
      
      // Convert map back to array
      allBots = Array.from(mergedBotsMap.values());
      
      // Apply sorting to merged list
      if (sortQuery) {
        allBots.sort((a, b) => {
          for (const [key, direction] of Object.entries(sortQuery)) {
            const aVal = key.split('.').reduce((obj: any, k) => obj?.[k], a);
            const bVal = key.split('.').reduce((obj: any, k) => obj?.[k], b);
            if (aVal !== bVal) {
              return direction === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
            }
          }
          return 0;
        });
      }

      // Apply pagination to merged list
      const paginatedBots = allBots.slice(skip, skip + pageSize);
      totalCount = allBots.length;

      // Convert to BotSummary format
      const botSummaries = paginatedBots.map(bot => {
        if ('_id' in bot && bot._id?.toString().startsWith('sample-')) {
          // Sample bot - convert manually
          return {
            botId: bot.botId,
            displayName: bot.metadata.displayName,
            shortDescription: bot.metadata.shortDescription,
            category: bot.metadata.category,
            riskLevel: bot.metadata.riskLevel,
            supportedMarkets: bot.metadata.supportedMarkets,
            supportedBrokers: bot.metadata.supportedBrokers,
            accountTypeSupport: bot.metadata.accountTypeSupport,
            icon: bot.metadata.icon,
            thumbnail: bot.metadata.thumbnail,
            isFeatured: bot.isFeatured,
            isPremium: bot.isPremium,
            isVerified: bot.isVerified,
            pricing: {
              type: bot.pricing?.type || 'free',
              amount: bot.pricing?.amount,
              currency: bot.pricing?.currency || 'USD',
            },
            performance: bot.performance ? {
              winRate: bot.performance.winRate,
              averageProfit: bot.performance.averageProfit,
              maxDrawdown: bot.performance.maxDrawdown,
              profitFactor: bot.performance.profitFactor,
            } : undefined,
            totalUsers: bot.totalUsers || 0,
          };
        }
        return toBotSummary(bot as any);
      });

      return NextResponse.json({
        success: true,
        data: botSummaries,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      });
    }

    // Convert to BotSummary format (database bots only for pages > 1)
    const botSummaries = bots.map(bot => toBotSummary(bot as any));

    return NextResponse.json({
      success: true,
      data: botSummaries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[Marketplace API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load marketplace bots',
      },
      { status: 500 }
    );
  }
}

