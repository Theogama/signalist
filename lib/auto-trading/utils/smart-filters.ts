/**
 * Smart Filters
 * News filter, time filter, and market condition detection
 */

import { MarketData } from '../types';
import { detectConsolidation, analyzeMarketStructure } from './market-analysis';
import { calculateVolatility } from './technical-indicators';

export interface NewsEvent {
  name: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  time: Date;
  currency?: string;
}

export interface TradingSession {
  name: string;
  startHour: number; // UTC hour
  endHour: number; // UTC hour
  timezone: string;
}

/**
 * Major trading sessions
 */
export const TRADING_SESSIONS: TradingSession[] = [
  { name: 'Asian', startHour: 0, endHour: 8, timezone: 'Asia/Tokyo' },
  { name: 'London', startHour: 8, endHour: 16, timezone: 'Europe/London' },
  { name: 'New York', startHour: 13, endHour: 21, timezone: 'America/New_York' },
];

/**
 * High-impact news events (simplified - in production, fetch from news API)
 */
export const HIGH_IMPACT_EVENTS = [
  'NFP', // Non-Farm Payrolls
  'CPI', // Consumer Price Index
  'FOMC', // Federal Open Market Committee
  'GDP',
  'Interest Rate Decision',
  'Unemployment Rate',
];

/**
 * Check if current time is within a trading session
 */
export function isWithinTradingSession(sessionName: 'Asian' | 'London' | 'New York'): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const session = TRADING_SESSIONS.find(s => s.name === sessionName);

  if (!session) {
    return false;
  }

  if (session.startHour < session.endHour) {
    return utcHour >= session.startHour && utcHour < session.endHour;
  } else {
    // Session spans midnight
    return utcHour >= session.startHour || utcHour < session.endHour;
  }
}

/**
 * Get current active trading session
 */
export function getCurrentSession(): TradingSession | null {
  const now = new Date();
  const utcHour = now.getUTCHours();

  for (const session of TRADING_SESSIONS) {
    if (session.startHour < session.endHour) {
      if (utcHour >= session.startHour && utcHour < session.endHour) {
        return session;
      }
    } else {
      if (utcHour >= session.startHour || utcHour < session.endHour) {
        return session;
      }
    }
  }

  return null;
}

/**
 * Check if trading should be avoided due to news events
 * In production, this would fetch from a news API
 */
export function shouldAvoidTradingDueToNews(
  symbol: string,
  upcomingEvents?: NewsEvent[]
): {
  shouldAvoid: boolean;
  reason?: string;
  nextEvent?: NewsEvent;
} {
  // Default: allow trading if no events provided
  if (!upcomingEvents || upcomingEvents.length === 0) {
    return { shouldAvoid: false };
  }

  const now = new Date();
  const bufferMinutes = 30; // Avoid trading 30 minutes before and after high-impact events

  for (const event of upcomingEvents) {
    if (event.impact !== 'HIGH') {
      continue;
    }

    const eventTime = new Date(event.time);
    const timeDiff = Math.abs(eventTime.getTime() - now.getTime()) / (1000 * 60); // minutes

    // Check if event is within buffer period
    if (timeDiff <= bufferMinutes) {
      return {
        shouldAvoid: true,
        reason: `High-impact news event: ${event.name}`,
        nextEvent: event,
      };
    }
  }

  return { shouldAvoid: false };
}

/**
 * Check if trading should be avoided during rollover/spread spikes
 * Typically occurs at market close (5 PM EST) and market open
 */
export function shouldAvoidTradingDueToTime(): {
  shouldAvoid: boolean;
  reason?: string;
} {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Avoid trading during rollover (typically 5 PM EST = 22:00 UTC)
  // Allow 1 hour buffer (21:00 - 23:00 UTC)
  if (utcHour >= 21 && utcHour < 23) {
    return {
      shouldAvoid: true,
      reason: 'Market rollover period - spreads may widen',
    };
  }

  // Avoid trading during low liquidity hours (typically 0:00 - 2:00 UTC)
  if (utcHour >= 0 && utcHour < 2) {
    return {
      shouldAvoid: true,
      reason: 'Low liquidity period - avoid trading',
    };
  }

  return { shouldAvoid: false };
}

/**
 * Check spread - avoid trading if spread is too wide
 */
export function checkSpread(marketData: MarketData, maxSpreadPercent: number = 0.1): {
  isValid: boolean;
  spreadPercent: number;
  reason?: string;
} {
  const spread = marketData.ask - marketData.bid;
  const midPrice = (marketData.ask + marketData.bid) / 2;
  const spreadPercent = (spread / midPrice) * 100;

  if (spreadPercent > maxSpreadPercent) {
    return {
      isValid: false,
      spreadPercent,
      reason: `Spread too wide: ${spreadPercent.toFixed(3)}% (max: ${maxSpreadPercent}%)`,
    };
  }

  return {
    isValid: true,
    spreadPercent,
  };
}

/**
 * Detect market conditions
 */
export interface MarketCondition {
  type: 'TREND' | 'RANGE' | 'HIGH_VOLATILITY' | 'LOW_LIQUIDITY';
  confidence: number;
  description: string;
}

export function detectMarketCondition(
  marketData: MarketData[],
  lookbackPeriod: number = 20
): MarketCondition[] {
  const conditions: MarketCondition[] = [];

  if (marketData.length < lookbackPeriod) {
    return conditions;
  }

  const recent = marketData.slice(-lookbackPeriod);
  const prices = recent.map(d => d.last);

  // Check for trend
  const marketStructure = analyzeMarketStructure(marketData, lookbackPeriod);
  if (marketStructure.trend !== 'SIDEWAYS') {
    conditions.push({
      type: 'TREND',
      confidence: 0.7,
      description: `${marketStructure.trend} trend detected`,
    });
  }

  // Check for range/consolidation
  if (detectConsolidation(marketData, lookbackPeriod)) {
    conditions.push({
      type: 'RANGE',
      confidence: 0.8,
      description: 'Market in consolidation/ranging',
    });
  }

  // Check volatility
  const volatility = calculateVolatility(prices, lookbackPeriod);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const volatilityPercent = volatility * 100;

  if (volatilityPercent > 2) {
    conditions.push({
      type: 'HIGH_VOLATILITY',
      confidence: 0.7,
      description: `High volatility detected: ${volatilityPercent.toFixed(2)}%`,
    });
  }

  // Check liquidity (using volume)
  const volumes = recent.map(d => d.volume || 0);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVolume = volumes[volumes.length - 1];

  if (recentVolume < avgVolume * 0.5) {
    conditions.push({
      type: 'LOW_LIQUIDITY',
      confidence: 0.6,
      description: 'Low liquidity detected',
    });
  }

  return conditions;
}

/**
 * Comprehensive filter check
 */
export interface FilterResult {
  canTrade: boolean;
  reasons: string[];
  warnings: string[];
}

export function applySmartFilters(
  marketData: MarketData,
  historicalData: MarketData[],
  symbol: string,
  upcomingNews?: NewsEvent[],
  maxSpreadPercent: number = 0.1
): FilterResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Check spread
  const spreadCheck = checkSpread(marketData, maxSpreadPercent);
  if (!spreadCheck.isValid) {
    reasons.push(spreadCheck.reason || 'Spread too wide');
  }

  // Check time-based filters
  const timeCheck = shouldAvoidTradingDueToTime();
  if (timeCheck.shouldAvoid) {
    reasons.push(timeCheck.reason || 'Time-based filter');
  }

  // Check news filter
  const newsCheck = shouldAvoidTradingDueToNews(symbol, upcomingNews);
  if (newsCheck.shouldAvoid) {
    reasons.push(newsCheck.reason || 'News filter');
  }

  // Check market conditions
  const conditions = detectMarketCondition(historicalData);
  const hasLowLiquidity = conditions.some(c => c.type === 'LOW_LIQUIDITY');
  if (hasLowLiquidity) {
    warnings.push('Low liquidity detected - consider reducing position size');
  }

  const hasHighVolatility = conditions.some(c => c.type === 'HIGH_VOLATILITY');
  if (hasHighVolatility) {
    warnings.push('High volatility detected - consider wider stops');
  }

  // Check for consolidation
  if (detectConsolidation(historicalData)) {
    warnings.push('Market in consolidation - may reduce signal quality');
  }

  return {
    canTrade: reasons.length === 0,
    reasons,
    warnings,
  };
}

