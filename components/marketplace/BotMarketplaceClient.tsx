/**
 * Bot Marketplace Client Component
 * Main marketplace UI for browsing and installing bots
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BotSummary, BotFilterOptions, BotSortOption } from '@/lib/marketplace/types';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  Star, 
  Crown,
  CheckCircle2,
  Loader2,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function BotMarketplaceClient() {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BotFilterOptions>({});
  const [sort, setSort] = useState<BotSortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  // Fetch bots with useCallback to prevent duplicate calls
  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (filters.category) params.append('category', filters.category);
      if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters.broker) params.append('broker', filters.broker);
      if (filters.accountType) params.append('accountType', filters.accountType);
      if (filters.market) params.append('market', filters.market);
      if (filters.isPremium !== undefined) params.append('isPremium', String(filters.isPremium));
      if (filters.isFeatured !== undefined) params.append('isFeatured', String(filters.isFeatured));
      if (filters.tags) params.append('tags', filters.tags.join(','));
      if (searchQuery) params.append('search', searchQuery);
      if (sort) params.append('sort', sort);

      const response = await fetch(`/api/marketplace/bots?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        // Deduplicate by botId to prevent any duplicates
        const uniqueBots = (data.data || []).reduce((acc: BotSummary[], bot: BotSummary) => {
          if (!acc.find(b => b.botId === bot.botId)) {
            acc.push(bot);
          }
          return acc;
        }, []);
        
        setBots(uniqueBots);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || 'Failed to load bots');
      }
    } catch (error: any) {
      console.error('Error fetching bots:', error);
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [filters, sort, searchQuery]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search bots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-700"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) =>
                setFilters({ ...filters, category: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[150px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="trend-following">Trend Following</SelectItem>
                <SelectItem value="scalping">Scalping</SelectItem>
                <SelectItem value="breakout">Breakout</SelectItem>
                <SelectItem value="swing-trading">Swing Trading</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.riskLevel || 'all'}
              onValueChange={(value) =>
                setFilters({ ...filters, riskLevel: value === 'all' ? undefined : value as any })
              }
            >
              <SelectTrigger className="w-[130px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.broker || 'all'}
              onValueChange={(value) =>
                setFilters({ ...filters, broker: value === 'all' ? undefined : value as any })
              }
            >
              <SelectTrigger className="w-[130px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Broker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brokers</SelectItem>
                <SelectItem value="deriv">Deriv</SelectItem>
                <SelectItem value="exness">Exness</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(value) => setSort(value as BotSortOption)}
            >
              <SelectTrigger className="w-[150px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="winRate">Win Rate</SelectItem>
                <SelectItem value="profitFactor">Profit Factor</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-400">
        Showing {bots.length} of {total} bots
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : bots.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No bots found. Try adjusting your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <Card
              key={bot.botId}
              className="bg-gray-800 border-gray-700 hover:border-yellow-500/50 transition-colors"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {bot.icon && <span className="text-2xl">{bot.icon}</span>}
                    <CardTitle className="text-lg">{bot.displayName}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {bot.isFeatured && (
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                    {bot.isPremium && (
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                        <Crown className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    {bot.isVerified && (
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-gray-400">
                  {bot.shortDescription || 'Trading bot for automated trading'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getRiskColor(bot.riskLevel)}>
                      {bot.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <Badge variant="outline" className="bg-gray-700/50 text-gray-300 border-gray-600">
                      {bot.category}
                    </Badge>
                    {bot.pricing.type === 'free' ? (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                        FREE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                        ${bot.pricing.amount}/{bot.pricing.type === 'subscription' ? 'mo' : 'one-time'}
                      </Badge>
                    )}
                  </div>

                  {/* Performance Metrics */}
                  {bot.performance && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {bot.performance.winRate !== undefined && (
                        <div>
                          <span className="text-gray-400">Win Rate:</span>{' '}
                          <span className="text-green-400 font-semibold">
                            {bot.performance.winRate.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {bot.performance.profitFactor !== undefined && (
                        <div>
                          <span className="text-gray-400">Profit Factor:</span>{' '}
                          <span className="text-green-400 font-semibold">
                            {bot.performance.profitFactor.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Supported Markets */}
                  <div className="text-xs text-gray-500">
                    Markets: {bot.supportedMarkets.join(', ')}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/marketplace/${bot.botId}`} className="flex-1">
                      <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
                        View Details
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-700"
                      onClick={() => {
                        // TODO: Implement install functionality
                        toast.info('Install functionality coming soon');
                      }}
                    >
                      Install
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

