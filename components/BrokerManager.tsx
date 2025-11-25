'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, CheckCircle, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface BrokerConfig {
  id: string;
  name: string;
  type: 'crypto' | 'stock' | 'forex';
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
  sandbox?: boolean;
  enabled: boolean;
}

export default function BrokerManager() {
  const router = useRouter();
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerConfig | null>(null);
  const [formData, setFormData] = useState<Partial<BrokerConfig>>({
    name: '',
    type: 'crypto',
    apiKey: '',
    apiSecret: '',
    apiPassphrase: '',
    sandbox: true,
    enabled: false,
  });

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    try {
      const response = await fetch('/api/brokers');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Expected JSON but got:', contentType);
          return;
        }
        const data = await response.json();
        setBrokers(data);
      }
    } catch (error) {
      console.error('Error loading brokers:', error);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingBroker ? `/api/brokers/${editingBroker.id}` : '/api/brokers';
      const method = editingBroker ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save broker');
        } else {
          const text = await response.text().catch(() => '');
          throw new Error(`Failed to save broker: ${response.status} ${text.substring(0, 200)}`);
        }
      }

      toast.success(editingBroker ? 'Broker updated' : 'Broker added');
      setIsOpen(false);
      setEditingBroker(null);
      setFormData({
        name: '',
        type: 'crypto',
        apiKey: '',
        apiSecret: '',
        apiPassphrase: '',
        sandbox: true,
        enabled: false,
      });
      loadBrokers();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save broker');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broker?')) {
      return;
    }

    try {
      const response = await fetch(`/api/brokers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete broker');
      }

      toast.success('Broker deleted');
      loadBrokers();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete broker');
    }
  };

  const handleEdit = (broker: BrokerConfig) => {
    setEditingBroker(broker);
    setFormData({
      name: broker.name,
      type: broker.type,
      apiKey: broker.apiKey,
      apiSecret: broker.apiSecret,
      apiPassphrase: broker.apiPassphrase,
      sandbox: broker.sandbox,
      enabled: broker.enabled,
    });
    setIsOpen(true);
  };

  const brokerTypes = [
    { value: 'crypto', label: 'Cryptocurrency' },
    { value: 'stock', label: 'Stock Exchange' },
    { value: 'forex', label: 'Forex' },
  ];

  const supportedBrokers = [
    { id: 'binance', name: 'Binance', type: 'crypto' },
    { id: 'coinbase', name: 'Coinbase Pro', type: 'crypto' },
    { id: 'kraken', name: 'Kraken', type: 'crypto' },
    { id: 'alpaca', name: 'Alpaca', type: 'stock' },
    { id: 'interactive_brokers', name: 'Interactive Brokers', type: 'stock' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Broker Connections</h2>
          <p className="text-sm text-gray-400 mt-1">Connect your trading accounts</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingBroker(null);
                setFormData({
                  name: '',
                  type: 'crypto',
                  apiKey: '',
                  apiSecret: '',
                  apiPassphrase: '',
                  sandbox: true,
                  enabled: false,
                });
              }}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-100">
                {editingBroker ? 'Edit Broker' : 'Add New Broker'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-gray-300">Broker</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => {
                    const broker = supportedBrokers.find((b) => b.name === value);
                    setFormData({
                      ...formData,
                      name: value,
                      type: broker?.type || 'crypto',
                    });
                  }}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select broker" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-white">
                    {supportedBrokers.map((broker) => (
                      <SelectItem key={broker.id} value={broker.name}>
                        {broker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300">API Key</Label>
                <Input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="Enter API key"
                />
              </div>

              <div>
                <Label className="text-gray-300">API Secret</Label>
                <Input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="Enter API secret"
                />
              </div>

              {(formData.name === 'Coinbase Pro' || formData.name === 'Coinbase') && (
                <div>
                  <Label className="text-gray-300">API Passphrase</Label>
                  <Input
                    type="password"
                    value={formData.apiPassphrase || ''}
                    onChange={(e) => setFormData({ ...formData, apiPassphrase: e.target.value })}
                    className="bg-gray-900 border-gray-700 text-white"
                    placeholder="Enter API passphrase"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-300">Sandbox Mode</Label>
                  <p className="text-xs text-gray-400">Use test environment</p>
                </div>
                <Switch
                  checked={formData.sandbox}
                  onCheckedChange={(checked) => setFormData({ ...formData, sandbox: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-300">Enabled</Label>
                  <p className="text-xs text-gray-400">Enable this broker connection</p>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                >
                  {editingBroker ? 'Update' : 'Add'} Broker
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  variant="outline"
                  className="flex-1 border-gray-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {brokers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No brokers configured</p>
            <p className="text-sm mt-2">Add a broker to start trading</p>
          </div>
        ) : (
          brokers.map((broker) => (
            <div
              key={broker.id}
              className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-100">{broker.name}</h3>
                    {broker.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 capitalize">{broker.type}</span>
                    {broker.sandbox && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                        Sandbox
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(broker)}
                  className="border-gray-700"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(broker.id)}
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

