'use client';

/**
 * Visual Bot Builder Component
 * 
 * Drag-and-drop bot builder similar to Deriv Bot.
 * Allows users to visually configure trading strategies.
 */

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Blocks, 
  Save, 
  Play, 
  Trash2, 
  Plus, 
  GripVertical,
  Settings,
  Eye,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface BotBlock {
  id: string;
  type: 'entry' | 'exit' | 'logic' | 'indicator' | 'action';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  connections: string[];
}

export interface BotWorkflow {
  id: string;
  name: string;
  blocks: BotBlock[];
  connections: Array<{ from: string; to: string }>;
}

export default function VisualBotBuilder() {
  const [workflow, setWorkflow] = useState<BotWorkflow>({
    id: `workflow-${Date.now()}`,
    name: 'New Bot',
    blocks: [],
    connections: [],
  });
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Available block types
  const blockTypes = {
    entry: [
      { name: 'Rise', icon: '📈', config: { type: 'rise' } },
      { name: 'Fall', icon: '📉', config: { type: 'fall' } },
      { name: 'Even', icon: '⚪', config: { type: 'even' } },
      { name: 'Odd', icon: '⚫', config: { type: 'odd' } },
    ],
    exit: [
      { name: 'Take Profit', icon: '✅', config: { type: 'take_profit' } },
      { name: 'Stop Loss', icon: '🛑', config: { type: 'stop_loss' } },
      { name: 'Time Limit', icon: '⏰', config: { type: 'time_limit' } },
    ],
    logic: [
      { name: 'AND', icon: '&', config: { type: 'and' } },
      { name: 'OR', icon: '|', config: { type: 'or' } },
      { name: 'NOT', icon: '!', config: { type: 'not' } },
    ],
    indicator: [
      { name: 'RSI', icon: '📊', config: { type: 'rsi', period: 14 } },
      { name: 'MACD', icon: '📈', config: { type: 'macd' } },
      { name: 'Moving Average', icon: '📉', config: { type: 'ma', period: 20 } },
    ],
  };

  const addBlock = useCallback((type: string, blockData: any) => {
    const newBlock: BotBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type: type as BotBlock['type'],
      name: blockData.name,
      config: blockData.config,
      position: {
        x: Math.random() * 400 + 50,
        y: Math.random() * 300 + 50,
      },
      connections: [],
    };

    setWorkflow(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));

    toast.success(`Added ${blockData.name} block`);
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setWorkflow(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
      connections: prev.connections.filter(
        c => c.from !== blockId && c.to !== blockId
      ),
    }));
    if (selectedBlock === blockId) {
      setSelectedBlock(null);
    }
    toast.success('Block deleted');
  }, [selectedBlock]);

  const handleSave = useCallback(() => {
    if (workflow.blocks.length === 0) {
      toast.error('Add at least one block to save');
      return;
    }

    // In a real implementation, save to backend
    const botConfig = {
      ...workflow,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(`bot-${workflow.id}`, JSON.stringify(botConfig));
    toast.success('Bot configuration saved!');
  }, [workflow]);

  const handleTest = useCallback(() => {
    if (workflow.blocks.length === 0) {
      toast.error('Add blocks to test');
      return;
    }
    toast.info('Bot testing feature coming soon');
  }, [workflow]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Bot configuration exported');
  }, [workflow]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Blocks className="h-5 w-5" />
              Visual Bot Builder
            </CardTitle>
            <CardDescription>
              Drag and drop blocks to build your trading strategy
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTest}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="builder" className="space-y-4">
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="blocks">Block Library</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {/* Canvas */}
              <div className="col-span-3">
                <div
                  ref={canvasRef}
                  className="relative bg-gray-900 border border-gray-700 rounded-lg"
                  style={{ height: '600px', overflow: 'auto' }}
                >
                  {workflow.blocks.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Blocks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Drag blocks from the library to start building</p>
                      </div>
                    </div>
                  ) : (
                    workflow.blocks.map((block) => (
                      <div
                        key={block.id}
                        className={cn(
                          'absolute p-4 rounded-lg border-2 cursor-move min-w-[150px]',
                          selectedBlock === block.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-600 bg-gray-800',
                          'hover:border-gray-500'
                        )}
                        style={{
                          left: `${block.position.x}px`,
                          top: `${block.position.y}px`,
                        }}
                        onClick={() => setSelectedBlock(block.id)}
                        onMouseDown={(e) => {
                          setDraggedBlock(block.id);
                          e.preventDefault();
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <Badge variant="outline" className="text-xs">
                              {block.type}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBlock(block.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-sm font-medium text-gray-100">
                          {block.name}
                        </div>
                        {Object.keys(block.config).length > 0 && (
                          <div className="mt-2 text-xs text-gray-400">
                            {Object.entries(block.config)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <div key={key}>
                                  {key}: {String(value)}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Block Library Sidebar */}
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    Block Library
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(blockTypes).map(([type, blocks]) => (
                      <div key={type}>
                        <div className="text-xs font-medium text-gray-400 mb-2 uppercase">
                          {type}
                        </div>
                        <div className="space-y-1">
                          {blocks.map((block) => (
                            <Button
                              key={block.name}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs"
                              onClick={() => addBlock(type, block)}
                            >
                              <span className="mr-2">{block.icon}</span>
                              {block.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Block Settings */}
                {selectedBlock && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">
                      Block Settings
                    </h3>
                    <div className="space-y-2 text-xs text-gray-400">
                      {workflow.blocks
                        .find(b => b.id === selectedBlock)
                        ?.config && (
                        <div>
                          {Object.entries(
                            workflow.blocks.find(b => b.id === selectedBlock)!
                              .config
                          ).map(([key, value]) => (
                            <div key={key} className="mb-1">
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="blocks">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(blockTypes).map(([type, blocks]) =>
                blocks.map((block) => (
                  <Card
                    key={block.name}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => addBlock(type, block)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl mb-2">{block.icon}</div>
                      <div className="text-sm font-medium">{block.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{type}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={workflow.name}
                  onChange={(e) =>
                    setWorkflow(prev => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                  placeholder="My Trading Bot"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                  rows={3}
                  placeholder="Describe your bot strategy..."
                />
              </div>
              <div className="text-sm text-gray-400">
                <strong>Blocks:</strong> {workflow.blocks.length}
                <br />
                <strong>Connections:</strong> {workflow.connections.length}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}


