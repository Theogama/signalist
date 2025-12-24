'use client';

/**
 * Deriv-Style Dashboard
 * 
 * Main trading dashboard that integrates charts, bot builder, and trading controls.
 * Mirrors Deriv's platform layout and functionality.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Activity,
  Play,
  Square,
  Settings,
  BarChart3
} from 'lucide-react';
import DerivChart from './DerivChart';
import TimeframeSelector, { Timeframe } from './TimeframeSelector';
import VisualBotBuilder from './VisualBotBuilder';
import { cn } from '@/lib/utils';

export default function DerivDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BOOM500');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [activeTab, setActiveTab] = useState<'trading' | 'bot-builder' | 'analytics'>('trading');
  const [balance, setBalance] = useState(10000);
  const [isBotRunning, setIsBotRunning] = useState(false);

  const symbols = ['BOOM500', 'BOOM1000', 'CRASH500', 'CRASH1000', 'BOOM300', 'CRASH300'];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Signalist Trading</h1>
              <Badge variant="outline" className="border-green-500 text-green-400">
                <Activity className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">Balance:</span>
                <span className="text-lg font-semibold">${balance.toFixed(2)}</span>
              </div>
              <Button
                variant={isBotRunning ? 'destructive' : 'default'}
                size="sm"
                onClick={() => setIsBotRunning(!isBotRunning)}
              >
                {isBotRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Bot
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Bot
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="bot-builder">Bot Builder</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Trading Tab */}
          <TabsContent value="trading" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Left Column - Chart */}
              <div className="lg:col-span-3 space-y-4">
                {/* Symbol Selector & Controls */}
                <Card className="border-gray-700 bg-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSymbol}
                          onChange={(e) => setSelectedSymbol(e.target.value)}
                          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                        >
                          {symbols.map(symbol => (
                            <option key={symbol} value={symbol}>{symbol}</option>
                          ))}
                        </select>
                        <select
                          value={chartType}
                          onChange={(e) => setChartType(e.target.value as any)}
                          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                        >
                          <option value="candlestick">Candlestick</option>
                          <option value="line">Line</option>
                          <option value="area">Area</option>
                        </select>
                      </div>
                      <TimeframeSelector
                        value={timeframe}
                        onChange={setTimeframe}
                        variant="buttons"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Chart */}
                <DerivChart
                  symbol={selectedSymbol}
                  type={chartType}
                  timeframe={timeframe}
                  height={500}
                  showIndicators={true}
                  indicators={['RSI', 'MACD']}
                />

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="border-gray-700 bg-gray-900">
                    <CardContent className="p-4">
                      <div className="text-xs text-gray-400 mb-1">Today's P/L</div>
                      <div className="text-lg font-semibold text-green-400">+$125.50</div>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-700 bg-gray-900">
                    <CardContent className="p-4">
                      <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                      <div className="text-lg font-semibold text-gray-100">65.5%</div>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-700 bg-gray-900">
                    <CardContent className="p-4">
                      <div className="text-xs text-gray-400 mb-1">Total Trades</div>
                      <div className="text-lg font-semibold text-gray-100">142</div>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-700 bg-gray-900">
                    <CardContent className="p-4">
                      <div className="text-xs text-gray-400 mb-1">Profit Factor</div>
                      <div className="text-lg font-semibold text-gray-100">1.85</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right Column - Trade Panel */}
              <div className="space-y-4">
                {/* Trade Panel */}
                <Card className="border-gray-700 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-lg">Trade</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Stake</label>
                      <input
                        type="number"
                        defaultValue={10}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="bg-green-600 hover:bg-green-700">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Rise
                      </Button>
                      <Button variant="destructive">
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Fall
                      </Button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Duration</label>
                      <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100">
                        <option>1 min</option>
                        <option>5 min</option>
                        <option>15 min</option>
                        <option>30 min</option>
                      </select>
                    </div>
                    <Button className="w-full" size="lg">
                      Buy Contract
                    </Button>
                  </CardContent>
                </Card>

                {/* Open Positions */}
                <Card className="border-gray-700 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-lg">Open Positions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-gray-400 text-center py-4">
                      No open positions
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Trades */}
                <Card className="border-gray-700 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                          <div>
                            <div className="text-sm font-medium">BOOM500</div>
                            <div className="text-xs text-gray-400">2 min ago</div>
                          </div>
                          <div className={cn(
                            'text-sm font-semibold',
                            i % 2 === 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {i % 2 === 0 ? '+' : '-'}$5.50
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Bot Builder Tab */}
          <TabsContent value="bot-builder">
            <VisualBotBuilder />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card className="border-gray-700 bg-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Trading Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-gray-400 text-center py-8">
                  Analytics dashboard coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

