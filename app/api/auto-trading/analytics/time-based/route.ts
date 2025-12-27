/**
 * Time-Based Analytics API
 * Provides hourly, daily, and weekly profit analytics for Deriv auto-trading
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { BotAnalyticsService } from '@/lib/services/bot-analytics.service';

const analyticsService = new BotAnalyticsService();

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const botId = searchParams.get('botId') || undefined;
    const period = searchParams.get('period') || 'daily'; // hourly, daily, weekly
    const isDemo = searchParams.get('isDemo') === 'true';
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);

    // Optional date range
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const filters = {
      isDemo,
      startDate,
      endDate,
    };

    let data;

    switch (period) {
      case 'hourly':
        if (!botId) {
          return NextResponse.json(
            { error: 'botId is required for hourly analytics' },
            { status: 400 }
          );
        }
        data = await analyticsService.getHourlyPerformance(userId, botId, hours, filters);
        break;

      case 'daily':
        if (!botId) {
          return NextResponse.json(
            { error: 'botId is required for daily analytics' },
            { status: 400 }
          );
        }
        data = await analyticsService.getDailyPerformance(userId, botId, days, filters);
        break;

      case 'weekly':
        if (!botId) {
          return NextResponse.json(
            { error: 'botId is required for weekly analytics' },
            { status: 400 }
          );
        }
        data = await analyticsService.getWeeklyPerformance(userId, botId, weeks, filters);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid period. Use: hourly, daily, or weekly' },
          { status: 400 }
        );
    }

    // Calculate summary statistics
    const summary = {
      totalTrades: data.reduce((sum: number, item: any) => sum + item.trades, 0),
      totalWins: data.reduce((sum: number, item: any) => sum + item.wins, 0),
      totalLosses: data.reduce((sum: number, item: any) => sum + item.losses, 0),
      totalProfitLoss: data.reduce((sum: number, item: any) => sum + item.profitLoss, 0),
      totalStake: data.reduce((sum: number, item: any) => sum + item.totalStake, 0),
      averageWinRate: data.length > 0
        ? data.reduce((sum: number, item: any) => sum + item.winRate, 0) / data.length
        : 0,
    };

    return NextResponse.json({
      success: true,
      period,
      data,
      summary,
      filters: {
        botId,
        isDemo,
        hours: period === 'hourly' ? hours : undefined,
        days: period === 'daily' ? days : undefined,
        weeks: period === 'weekly' ? weeks : undefined,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching time-based analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}


