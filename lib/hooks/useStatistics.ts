'use client';

/**
 * Shared Statistics Hook
 * Prevents multiple components from fetching the same statistics data
 * Implements caching and request deduplication
 */

import { useState, useEffect, useRef } from 'react';

interface TradingStatistics {
  totalTrades: number;
  openTrades: number;
  totalProfitLoss: number;
  totalROI: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalBalance: number;
  totalEquity: number;
  totalInitialBalance: number;
  recentTrades: number;
  recentProfitLoss: number;
  bestTrade: {
    symbol: string;
    side: string;
    profitLoss: number;
    date: Date;
  } | null;
  worstTrade: {
    symbol: string;
    side: string;
    profitLoss: number;
    date: Date;
  } | null;
  dailyStats: Array<{
    date: string;
    trades: number;
    profitLoss: number;
  }>;
}

interface UseStatisticsOptions {
  broker?: 'exness' | 'deriv' | null;
  refreshInterval?: number; // in milliseconds, 0 to disable
  enabled?: boolean;
}

// Global cache to share data across components
const statisticsCache = new Map<string, {
  data: TradingStatistics | null;
  timestamp: number;
  promise: Promise<TradingStatistics | null> | null;
}>();

const CACHE_TTL = 5000; // 5 seconds cache

export function useStatistics(options: UseStatisticsOptions = {}) {
  const { broker = null, refreshInterval = 30000, enabled = true } = options;
  const [stats, setStats] = useState<TradingStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const cacheKey = broker ? `stats-${broker}` : 'stats-all';

  const fetchStats = async (): Promise<TradingStatistics | null> => {
    // Check cache first
    const cached = statisticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // If there's already a pending request, wait for it
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = (async () => {
      try {
        const url = broker 
          ? `/api/auto-trading/statistics?broker=${broker}`
          : '/api/auto-trading/statistics';
        
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          const data = result.data;
          statisticsCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            promise: null,
          });
          return data;
        } else {
          throw new Error(result.error || 'Failed to fetch statistics');
        }
      } catch (err: any) {
        statisticsCache.set(cacheKey, {
          data: null,
          timestamp: Date.now(),
          promise: null,
        });
        throw err;
      }
    })();

    // Store promise in cache
    statisticsCache.set(cacheKey, {
      data: cached?.data || null,
      timestamp: cached?.timestamp || 0,
      promise,
    });

    return promise;
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchStats();
        if (mounted) {
          setStats(data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to fetch statistics');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial load
    loadStats();

    // Set up polling if refreshInterval > 0
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(loadStats, refreshInterval);
    }

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [broker, refreshInterval, enabled]);

  return { stats, loading, error, refetch: fetchStats };
}





