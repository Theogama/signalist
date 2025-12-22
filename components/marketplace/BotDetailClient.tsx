/**
 * Bot Detail Client Component
 * Displays detailed information about a bot
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BotDetail } from '@/lib/marketplace/types';
import {
  ArrowLeft,
  Star,
  Crown,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  Download,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface BotDetailClientProps {
  botId: string;
}

export default function BotDetailClient({ botId }: BotDetailClientProps) {
  const router = useRouter();
  const [bot, setBot] = useState<BotDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBot = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/marketplace/bots/${botId}`);
        const data = await response.json();

        if (data.success) {
          setBot(data.data);
        } else {
          toast.error(data.error || 'Bot not found');
          router.push('/marketplace');
        }
      } catch (error: any) {
        console.error('Error fetching bot:', error);
        toast.error('Failed to load bot details');
        router.push('/marketplace');
      } finally {
        setLoading(false);
      }
    };

    fetchBot();
  }, [botId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Bot not found</p>
        <Link href="/marketplace">
          <Button variant="outline" className="mt-4">
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

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
      {/* Back Button */}
      <Link href="/marketplace">
        <Button variant="ghost" className="text-gray-400 hover:text-gray-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>
      </Link>

      {/* Bot Header */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {bot.icon && <span className="text-4xl">{bot.icon}</span>}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl">{bot.displayName}</CardTitle>
                  {bot.isVerified && (
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
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
                </div>
                <CardDescription className="text-gray-400 text-base">
                  {bot.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {bot.pricing.type === 'free' ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-lg px-4 py-2">
                  FREE
                </Badge>
              ) : (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50 text-lg px-4 py-2">
                  ${bot.pricing.amount}
                  {bot.pricing.type === 'subscription' && '/month'}
                </Badge>
              )}
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => {
                  // TODO: Implement install functionality
                  toast.info('Install functionality coming soon');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Install Bot
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bot Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        {bot.fullPerformance && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bot.fullPerformance.winRate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="text-green-400 font-semibold">
                      {bot.fullPerformance.winRate.toFixed(1)}%
                    </span>
                  </div>
                )}
                {bot.fullPerformance.profitFactor !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Profit Factor:</span>
                    <span className="text-green-400 font-semibold">
                      {bot.fullPerformance.profitFactor.toFixed(2)}
                    </span>
                  </div>
                )}
                {bot.fullPerformance.averageProfit !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Profit:</span>
                    <span className="text-green-400 font-semibold">
                      ${bot.fullPerformance.averageProfit.toFixed(2)}
                    </span>
                  </div>
                )}
                {bot.fullPerformance.maxDrawdown !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Drawdown:</span>
                    <span className="text-red-400 font-semibold">
                      {bot.fullPerformance.maxDrawdown.toFixed(1)}%
                    </span>
                  </div>
                )}
                {bot.fullPerformance.totalTrades !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Trades:</span>
                    <span className="text-gray-300 font-semibold">
                      {bot.fullPerformance.totalTrades.toLocaleString()}
                    </span>
                  </div>
                )}
                {bot.fullPerformance.backtestPeriod && (
                  <div className="text-xs text-gray-500 mt-2">
                    Backtest Period: {bot.fullPerformance.backtestPeriod}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bot Details */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Bot Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Category:</span>
                <Badge variant="outline" className="bg-gray-700/50">
                  {bot.category}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Risk Level:</span>
                <Badge className={getRiskColor(bot.riskLevel)}>
                  {bot.riskLevel.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Version:</span>
                <span className="text-gray-300">{bot.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Brokers:</span>
                <span className="text-gray-300">
                  {bot.supportedBrokers === 'both' ? 'Exness & Deriv' : bot.supportedBrokers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Markets:</span>
                <span className="text-gray-300">{bot.supportedMarkets.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Account Type:</span>
                <span className="text-gray-300">
                  {bot.accountTypeSupport === 'both' ? 'Demo & Live' : bot.accountTypeSupport}
                </span>
              </div>
              {bot.author && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Author:</span>
                  {bot.authorUrl ? (
                    <a
                      href={bot.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                    >
                      {bot.author}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-gray-300">{bot.author}</span>
                  )}
                </div>
              )}
              {bot.totalUsers !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Users:</span>
                  <span className="text-gray-300">{bot.totalUsers.toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Default bot configuration parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Stake</h4>
              <div className="text-sm text-gray-400">
                Min: ${bot.configuration.stake.min} | Max: ${bot.configuration.stake.max} | Default: ${bot.configuration.stake.default}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Stop Loss</h4>
              <div className="text-sm text-gray-400">
                Type: {bot.configuration.stopLoss.type} | Default: {bot.configuration.stopLoss.default || 'N/A'}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Take Profit</h4>
              <div className="text-sm text-gray-400">
                Type: {bot.configuration.takeProfit.type}
                {bot.configuration.takeProfit.riskRewardRatio && (
                  <> | R:R {bot.configuration.takeProfit.riskRewardRatio}:1</>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Max Trades</h4>
              <div className="text-sm text-gray-400">
                Per Day: {bot.configuration.maxTrades.perDay || 'Unlimited'} | Concurrent: {bot.configuration.maxTrades.concurrent || 1}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {bot.tags && bot.tags.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {bot.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-gray-700/50 text-gray-300 border-gray-600">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links */}
      {(bot.documentationUrl || bot.supportUrl) && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {bot.documentationUrl && (
                <a
                  href={bot.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-500 hover:text-yellow-400 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Documentation
                </a>
              )}
              {bot.supportUrl && (
                <a
                  href={bot.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-500 hover:text-yellow-400 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Support
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

