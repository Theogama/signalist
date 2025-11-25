'use client';

/**
 * Bots Library Component
 * Displays all available trading bots from freetradingbots and money8gg
 */

import { useEffect, useState } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Search, Star, TrendingUp } from 'lucide-react';

export default function BotsLibrary() {
  const {
    selectedBot,
    availableBots,
    setSelectedBot,
    loadBots,
  } = useAutoTradingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBots, setFilteredBots] = useState(availableBots);

  useEffect(() => {
    const loadBotsData = async () => {
      try {
        await loadBots();
      } catch (error) {
        console.error('Error loading bots:', error);
      }
    };
    loadBotsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredBots(
        availableBots.filter(
          (bot) =>
            bot.name.toLowerCase().includes(query) ||
            bot.description.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredBots(availableBots);
    }
  }, [searchQuery, availableBots]);

  // Mock bots if none loaded
  const displayBots = filteredBots.length > 0 ? filteredBots : [
    {
      id: 'evenodd',
      name: 'Even/Odd Strategy',
      description: 'Trades based on even/odd last digit analysis with martingale support',
      parameters: {
        riskPercent: 1,
        takeProfitPercent: 2,
        stopLossPercent: 1,
        martingale: true,
        martingaleMultiplier: 2,
      },
    },
    {
      id: 'risefall',
      name: 'Rise/Fall Strategy',
      description: 'Trades based on candle close/open analysis',
      parameters: {
        riskPercent: 1,
        takeProfitPercent: 2,
        stopLossPercent: 1,
        lookbackPeriod: 5,
      },
    },
    {
      id: 'digits',
      name: 'Digits Analyzer',
      description: 'Analyzes last digits and predicts matches/differs',
      parameters: {
        riskPercent: 1,
        takeProfitPercent: 2,
        stopLossPercent: 1,
        lookbackPeriod: 10,
        digitThreshold: 3,
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search bots..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {displayBots.map((bot) => (
          <div
            key={bot.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedBot?.id === bot.id
                ? 'border-yellow-500 bg-yellow-500/10'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
            onClick={() => setSelectedBot(bot)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-yellow-400" />
                <h3 className="font-semibold text-gray-100">{bot.name}</h3>
              </div>
              {selectedBot?.id === bot.id && (
                <Badge variant="outline" className="text-yellow-400 border-yellow-500">
                  Selected
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-3">{bot.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>TP: {bot.parameters.takeProfitPercent}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span>SL: {bot.parameters.stopLossPercent}%</span>
              </div>
              {(bot as any).source === 'xml' && (
                <Badge variant="outline" className="text-xs text-blue-400 border-blue-500">
                  XML Bot
                </Badge>
              )}
              {(bot as any).source === 'registered' && (
                <Badge variant="outline" className="text-xs text-green-400 border-green-500">
                  Registered
                </Badge>
              )}
              {(bot as any).tradeType && (
                <Badge variant="outline" className="text-xs">
                  {(bot as any).tradeType}
                </Badge>
              )}
              {bot.parameters.martingale && (
                <Badge variant="outline" className="text-xs">
                  Martingale
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {displayBots.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No bots found matching your search
        </div>
      )}
    </div>
  );
}



