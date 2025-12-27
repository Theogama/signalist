'use client';

import { useState } from 'react';
import TradingViewWidget from '@/components/TradingViewWidget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MARKET_OVERVIEW_WIDGET_CONFIG, 
  HEATMAP_WIDGET_CONFIG,
  TOP_STORIES_WIDGET_CONFIG,
  MARKET_DATA_WIDGET_CONFIG 
} from '@/lib/constants';
import { BarChart3, TrendingUp, Activity, PieChart } from 'lucide-react';

export default function LiveAnalyticsPage() {
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Live Analytics & Charts</h1>
          <p className="text-gray-400">Real-time market data, charts, and technical analysis</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Market Status</span>
            <Activity className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-xl font-bold text-green-400">Open</div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Active Symbols</span>
            <TrendingUp className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-gray-100">500+</div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Volume</span>
            <BarChart3 className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-bold text-gray-100">High</div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Market Trend</span>
            <PieChart className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-gray-100">Bullish</div>
        </div>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="overview">Market Overview</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="news">Top Stories</TabsTrigger>
          <TabsTrigger value="data">Market Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <TradingViewWidget
              title="Market Overview"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
              config={MARKET_OVERVIEW_WIDGET_CONFIG}
              height={600}
            />
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <TradingViewWidget
              title="Market Heatmap"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
              config={HEATMAP_WIDGET_CONFIG}
              height={600}
            />
          </div>
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <TradingViewWidget
              title="Top Market Stories"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
              config={TOP_STORIES_WIDGET_CONFIG}
              height={600}
            />
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <TradingViewWidget
              title="Market Data"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js"
              config={MARKET_DATA_WIDGET_CONFIG}
              height={600}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Additional Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Sector Performance</h3>
          <TradingViewWidget
            scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
            config={{
              width: '100%',
              height: 400,
              defaultColumn: 'overview',
              screener_type: 'stock',
              displayCurrency: 'USD',
              colorTheme: 'dark',
              locale: 'en',
              isTransparent: true,
            }}
            height={400}
          />
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Economic Calendar</h3>
          <TradingViewWidget
            scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
            config={{
              colorTheme: 'dark',
              isTransparent: true,
              displayMode: 'regular',
              width: '100%',
              height: 400,
              locale: 'en',
            }}
            height={400}
          />
        </div>
      </div>
    </div>
  );
}










