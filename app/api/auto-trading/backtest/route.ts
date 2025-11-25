/**
 * Backtest API
 * POST: Run backtest on historical data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { EnhancedBacktester } from '@/lib/auto-trading/backtester/EnhancedBacktester';
import { PerformanceReportGenerator } from '@/lib/auto-trading/backtester/PerformanceReport';
import { EvenOddStrategy } from '@/lib/auto-trading/strategies/EvenOddStrategy';
import { RiseFallStrategy } from '@/lib/auto-trading/strategies/RiseFallStrategy';
import { DigitsStrategy } from '@/lib/auto-trading/strategies/DigitsStrategy';
import { MarketData, StrategyConfig } from '@/lib/auto-trading/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const body = await request.json();

    const { strategyName, historicalData, initialBalance, config, forwardTest, generateReport } = body;

    if (!strategyName || !historicalData || !initialBalance) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create strategy instance
    let strategy;
    switch (strategyName) {
      case 'EvenOdd':
        strategy = new EvenOddStrategy(config);
        break;
      case 'RiseFall':
        strategy = new RiseFallStrategy(config);
        break;
      case 'Digits':
        strategy = new DigitsStrategy(config);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown strategy: ${strategyName}` },
          { status: 400 }
        );
    }

    // Initialize strategy
    const strategyConfig: StrategyConfig = {
      name: strategyName,
      enabled: true,
      riskPercent: config.riskPercent || 1,
      takeProfitPercent: config.takeProfitPercent || 2,
      stopLossPercent: config.stopLossPercent || 1,
      maxConcurrentTrades: config.maxConcurrentTrades || 1,
      parameters: config.parameters || {},
    };

    await strategy.initialize(strategyConfig);

    // Create enhanced backtester with forward test support
    const riskLimits = {
      maxRiskPerTrade: config.riskPercent || 1,
      maxDailyLoss: config.maxDailyLoss || 10,
      maxDrawdown: config.maxDrawdown || 20,
      maxConcurrentPositions: config.maxConcurrentTrades || 1,
      maxPositionSize: 10,
      // Enhanced features
      useATRForSL: config.useATRForSL !== false,
      atrMultiplier: config.atrMultiplier || 2,
      enableBreakeven: config.enableBreakeven !== false,
      breakevenTriggerRR: config.breakevenTriggerRR || 1,
      enableTrailingStop: config.enableTrailingStop || false,
      trailingStopATRMultiplier: config.trailingStopATRMultiplier || 1.5,
      maxDailyTrades: config.maxDailyTrades,
      maxDailyProfit: config.maxDailyProfit,
    };

    // Forward test configuration
    const forwardTestConfig = forwardTest ? {
      enabled: true,
      speedMultiplier: forwardTest.speedMultiplier || 1,
      onTick: forwardTest.onTick ? (data: any) => {
        // In production, this would send to WebSocket
        console.log('Forward test tick:', data);
      } : undefined,
      onTrade: forwardTest.onTrade ? (trade: any) => {
        console.log('Forward test trade:', trade);
      } : undefined,
      onError: forwardTest.onError ? (error: Error) => {
        console.error('Forward test error:', error);
      } : undefined,
    } : undefined;

    const backtester = new EnhancedBacktester(riskLimits, forwardTestConfig);

    // Convert historical data to MarketData format
    const marketData: MarketData[] = historicalData.map((d: any) => ({
      symbol: d.symbol,
      bid: d.bid || d.price,
      ask: d.ask || d.price,
      last: d.price || d.close,
      volume: d.volume || 0,
      timestamp: new Date(d.timestamp || d.time),
      high24h: d.high,
      low24h: d.low,
      change24h: d.change,
      changePercent24h: d.changePercent,
    }));

    // Run backtest
    const result = await backtester.backtest(strategy, marketData, initialBalance, strategyConfig);

    // Generate performance report if requested
    let performanceReport = null;
    if (generateReport) {
      performanceReport = PerformanceReportGenerator.generateReport(result);
    }

    return NextResponse.json({
      success: true,
      data: result,
      report: performanceReport,
      markdownReport: generateReport ? PerformanceReportGenerator.generateMarkdownReport(result) : null,
    });
  } catch (error: any) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backtest failed' },
      { status: 500 }
    );
  }
}

