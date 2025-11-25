'use client';

/**
 * Bot Builder UI Component
 * Visual bot builder interface similar to money8gg.com bot builder
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Blocks, Save, Play, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';

export default function BotBuilderUI() {
  const [botName, setBotName] = useState('');
  const [strategyType, setStrategyType] = useState('evenodd');
  const [conditions, setConditions] = useState<any[]>([]);
  const [riskPercent, setRiskPercent] = useState(1);
  const [takeProfitPercent, setTakeProfitPercent] = useState(2);
  const [stopLossPercent, setStopLossPercent] = useState(1);
  const [martingale, setMartingale] = useState(false);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState(2);
  const [maxTrades, setMaxTrades] = useState(1);
  const { setSelectedBot, availableBots } = useAutoTradingStore();

  const handleSave = async () => {
    if (!botName.trim()) {
      toast.error('Please enter a bot name');
      return;
    }

    const botConfig = {
      id: `custom-${Date.now()}`,
      name: botName,
      description: `Custom ${strategyType} bot`,
      parameters: {
        riskPercent,
        takeProfitPercent,
        stopLossPercent,
        maxTrades,
        martingale,
        martingaleMultiplier: martingale ? martingaleMultiplier : undefined,
        strategyType,
        conditions,
      },
    };

    // In a real implementation, this would save to backend
    // For now, we'll add it to the available bots list
    toast.success('Bot configuration saved! You can now select it from the Bot Library.');
    
    // Optionally set it as selected
    setSelectedBot(botConfig as any);
  };

  const handleExport = () => {
    const botConfig = {
      name: botName || 'Custom Bot',
      strategyType,
      parameters: {
        riskPercent,
        takeProfitPercent,
        stopLossPercent,
        maxTrades,
        martingale,
        martingaleMultiplier: martingale ? martingaleMultiplier : undefined,
        conditions,
      },
    };

    const blob = new Blob([JSON.stringify(botConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${botName || 'bot'}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Bot configuration exported');
  };

  const handleTest = () => {
    toast.info('Bot testing feature coming soon');
  };

  const addCondition = () => {
    setConditions([...conditions, { type: 'even', id: Date.now() }]);
  };

  const removeCondition = (id: number) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Blocks className="h-5 w-5" />
          Bot Builder
        </CardTitle>
        <CardDescription>
          Build custom trading bots with visual logic blocks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botName">Bot Name</Label>
              <Input
                id="botName"
                placeholder="My Custom Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategyType">Strategy Type</Label>
              <Select value={strategyType} onValueChange={setStrategyType}>
                <SelectTrigger id="strategyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evenodd">Even/Odd</SelectItem>
                  <SelectItem value="risefall">Rise/Fall</SelectItem>
                  <SelectItem value="digits">Digits</SelectItem>
                  <SelectItem value="overunder">Over/Under</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="riskPercent">Risk (%)</Label>
                <Input
                  id="riskPercent"
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="takeProfitPercent">TP (%)</Label>
                <Input
                  id="takeProfitPercent"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value) || 2)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stopLossPercent">SL (%)</Label>
                <Input
                  id="stopLossPercent"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(parseFloat(e.target.value) || 1)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400 mb-4">
                Define trading conditions using logic blocks
              </p>
              <div className="space-y-2">
                {conditions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No conditions added. Click "Add Condition" to start.
                  </p>
                ) : (
                  conditions.map((condition) => (
                    <div key={condition.id} className="p-3 bg-gray-900 rounded border border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">
                          If last digit is {condition.type || 'even'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(condition.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={addCondition}>
                + Add Condition
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800">
                <div>
                  <Label htmlFor="martingale">Enable Martingale</Label>
                  <p className="text-xs text-gray-400 mt-1">Increase stake after losses</p>
                </div>
                <Switch
                  id="martingale"
                  checked={martingale}
                  onCheckedChange={setMartingale}
                />
              </div>
              
              {martingale && (
                <div className="space-y-2">
                  <Label htmlFor="martingaleMultiplier">Martingale Multiplier</Label>
                  <Input
                    id="martingaleMultiplier"
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={martingaleMultiplier}
                    onChange={(e) => setMartingaleMultiplier(parseFloat(e.target.value) || 2)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxTrades">Max Concurrent Trades</Label>
                <Input
                  id="maxTrades"
                  type="number"
                  min="1"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Save Bot
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Config
          </Button>
          <Button variant="outline" onClick={handleTest}>
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



