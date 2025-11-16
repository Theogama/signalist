'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignalFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState(searchParams.get('status') || 'active');
  const [action, setAction] = useState(searchParams.get('action') || 'all');
  const [source, setSource] = useState(searchParams.get('source') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (status && status !== 'all') params.set('status', status);
    if (action && action !== 'all') params.set('action', action);
    if (source && source !== 'all') params.set('source', source);
    if (search) params.set('search', search);
    
    router.push(`/signals?${params.toString()}`);
  };

  const clearFilters = () => {
    setStatus('active');
    setAction('all');
    setSource('all');
    setSearch('');
    router.push('/signals');
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Action</label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="BUY">BUY</SelectItem>
              <SelectItem value="SELL">SELL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="algorithm">Algorithm</SelectItem>
              <SelectItem value="external_api">External API</SelectItem>
              <SelectItem value="user_alert">User Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Search Symbol</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="bg-gray-900 border-gray-700 text-white pl-9"
              />
            </div>
            <Button
              onClick={applyFilters}
              size="sm"
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
            >
              Filter
            </Button>
            <Button
              onClick={clearFilters}
              variant="outline"
              size="sm"
              className="border-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


