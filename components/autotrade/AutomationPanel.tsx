'use client';

/**
 * Automation Panel Component
 * Configure automated bot operations: scheduling, auto-start/stop, recovery
 */

import { useState, useEffect } from 'react';
import { useAutoTradingStore } from '@/lib/stores/autoTradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Target, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Trash2,
  Play,
  Square,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  type: 'schedule' | 'profit_target' | 'loss_limit' | 'time_limit' | 'recovery';
  enabled: boolean;
  conditions: {
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    profitTarget?: number;
    lossLimit?: number;
    profitPercent?: number;
    lossPercent?: number;
    maxRuntime?: number;
    maxErrors?: number;
    errorCooldown?: number;
    autoRestart?: boolean;
  };
  actions: {
    startBot?: boolean;
    stopBot?: boolean;
    notify?: boolean;
  };
}

export default function AutomationPanel() {
  const { selectedBot, botStatus } = useAutoTradingStore();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    type: 'schedule',
    enabled: true,
    conditions: {},
    actions: { stopBot: true, notify: true },
  });

  useEffect(() => {
    if (selectedBot) {
      loadRules();
    }
  }, [selectedBot]);

  const loadRules = async () => {
    if (!selectedBot) return;
    
    try {
      const response = await fetch(`/api/auto-trading/automation/rules?botId=${selectedBot.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRules(data.rules || []);
        }
      }
    } catch (error) {
      console.error('Error loading automation rules:', error);
    }
  };

  const saveRule = async (rule: AutomationRule) => {
    if (!selectedBot) return;

    try {
      const response = await fetch('/api/auto-trading/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: selectedBot.id,
          rule,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Automation rule saved');
          setShowAddRule(false);
          setNewRule({ type: 'schedule', enabled: true, conditions: {}, actions: { stopBot: true, notify: true } });
          loadRules();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/auto-trading/automation/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Rule deleted');
        loadRules();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete rule');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/auto-trading/automation/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        loadRules();
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'schedule':
        return <Clock className="h-4 w-4" />;
      case 'profit_target':
        return <TrendingUp className="h-4 w-4" />;
      case 'loss_limit':
        return <TrendingDown className="h-4 w-4" />;
      case 'time_limit':
        return <Square className="h-4 w-4" />;
      case 'recovery':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getRuleDescription = (rule: AutomationRule): string => {
    switch (rule.type) {
      case 'schedule':
        return `${rule.conditions.startTime || '09:00'} - ${rule.conditions.endTime || '17:00'}`;
      case 'profit_target':
        return rule.conditions.profitPercent 
          ? `Stop at ${rule.conditions.profitPercent}% profit`
          : `Stop at $${rule.conditions.profitTarget} profit`;
      case 'loss_limit':
        return rule.conditions.lossPercent
          ? `Stop at ${rule.conditions.lossPercent}% loss`
          : `Stop at $${rule.conditions.lossLimit} loss`;
      case 'time_limit':
        return `Stop after ${rule.conditions.maxRuntime} minutes`;
      case 'recovery':
        return `Auto-restart after ${rule.conditions.maxErrors || 3} errors`;
      default:
        return 'Unknown rule';
    }
  };

  if (!selectedBot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>Configure automated bot operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            Select a bot to configure automation
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Automation Rules</CardTitle>
            <CardDescription>Automate bot start/stop and recovery</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddRule(!showAddRule)}
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Rule Form */}
        {showAddRule && (
          <Card className="border-blue-500/50 bg-blue-500/10">
            <CardHeader>
              <CardTitle className="text-sm">New Automation Rule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Rule Type</Label>
                <Select
                  value={newRule.type}
                  onValueChange={(value) => setNewRule({ ...newRule, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="schedule">Schedule (Time-based)</SelectItem>
                    <SelectItem value="profit_target">Profit Target</SelectItem>
                    <SelectItem value="loss_limit">Loss Limit</SelectItem>
                    <SelectItem value="time_limit">Time Limit</SelectItem>
                    <SelectItem value="recovery">Auto-Recovery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Schedule Conditions */}
              {newRule.type === 'schedule' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newRule.conditions?.startTime || '09:00'}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, startTime: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newRule.conditions?.endTime || '17:00'}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, endTime: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Profit Target */}
              {newRule.type === 'profit_target' && (
                <div className="space-y-2">
                  <Label>Profit Target</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount (USD)"
                      value={newRule.conditions?.profitTarget || ''}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, profitTarget: Number(e.target.value) },
                        })
                      }
                    />
                    <span className="text-gray-400 self-center">or</span>
                    <Input
                      type="number"
                      placeholder="Percent (%)"
                      value={newRule.conditions?.profitPercent || ''}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, profitPercent: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Loss Limit */}
              {newRule.type === 'loss_limit' && (
                <div className="space-y-2">
                  <Label>Loss Limit</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount (USD)"
                      value={newRule.conditions?.lossLimit || ''}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, lossLimit: Number(e.target.value) },
                        })
                      }
                    />
                    <span className="text-gray-400 self-center">or</span>
                    <Input
                      type="number"
                      placeholder="Percent (%)"
                      value={newRule.conditions?.lossPercent || ''}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, lossPercent: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Time Limit */}
              {newRule.type === 'time_limit' && (
                <div>
                  <Label>Max Runtime (minutes)</Label>
                  <Input
                    type="number"
                    value={newRule.conditions?.maxRuntime || ''}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, maxRuntime: Number(e.target.value) },
                      })
                    }
                  />
                </div>
              )}

              {/* Recovery */}
              {newRule.type === 'recovery' && (
                <div className="space-y-4">
                  <div>
                    <Label>Max Errors Before Action</Label>
                    <Input
                      type="number"
                      value={newRule.conditions?.maxErrors || 3}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, maxErrors: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Cooldown (seconds)</Label>
                    <Input
                      type="number"
                      value={newRule.conditions?.errorCooldown || 60}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, errorCooldown: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newRule.conditions?.autoRestart || false}
                      onCheckedChange={(checked) =>
                        setNewRule({
                          ...newRule,
                          conditions: { ...newRule.conditions, autoRestart: checked },
                        })
                      }
                    />
                    <Label>Auto-restart after cooldown</Label>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  checked={newRule.enabled !== false}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, enabled: checked })}
                />
                <Label>Enable rule</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const rule: AutomationRule = {
                      id: `rule-${Date.now()}`,
                      type: newRule.type!,
                      enabled: newRule.enabled !== false,
                      conditions: newRule.conditions || {},
                      actions: newRule.actions || { stopBot: true },
                    };
                    saveRule(rule);
                  }}
                >
                  Save Rule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddRule(false);
                    setNewRule({ type: 'schedule', enabled: true, conditions: {}, actions: { stopBot: true, notify: true } });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Rules */}
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No automation rules configured
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded ${rule.enabled ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                    {getRuleIcon(rule.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {rule.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {!rule.enabled && (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          DISABLED
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {getRuleDescription(rule)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}









