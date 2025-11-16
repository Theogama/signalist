'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { createSignal } from '@/lib/actions/signals.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

type CreateSignalFormData = {
  symbol: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  source: 'manual' | 'algorithm' | 'external_api' | 'user_alert';
  description?: string;
};

export default function CreateSignalForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSignalFormData>({
    defaultValues: {
      symbol: '',
      ticker: '',
      action: 'BUY',
      price: 0,
      source: 'manual',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const result = await createSignal({
        symbol: data.symbol.toUpperCase(),
        ticker: data.ticker || data.symbol.toUpperCase(),
        action: data.action,
        price: Number(data.price),
        stopLoss: data.stopLoss ? Number(data.stopLoss) : undefined,
        takeProfit: data.takeProfit ? Number(data.takeProfit) : undefined,
        source: data.source,
        description: data.description,
      });

      if (result.success && 'data' in result) {
        toast.success('Signal created successfully', {
          description: `${data.action} ${data.symbol} at $${data.price.toFixed(2)}`,
        });
        router.refresh();
        setOpen(false);
        reset();
      } else {
        toast.error(result.error || 'Failed to create signal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create signal');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
          <Plus className="h-4 w-4 mr-2" />
          Create Signal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create Trading Signal</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new trading signal that can be executed by the bot
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-sm font-medium text-gray-300">
                Symbol *
              </Label>
              <Input
                type="text"
                id="symbol"
                placeholder="AAPL"
                className="bg-gray-900 border-gray-700 text-white"
                {...register('symbol', {
                  required: 'Symbol is required',
                })}
              />
              {errors.symbol && <p className="text-xs text-red-500">{errors.symbol.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker" className="text-sm font-medium text-gray-300">
                Ticker
              </Label>
              <Input
                type="text"
                id="ticker"
                placeholder="AAPL"
                className="bg-gray-900 border-gray-700 text-white"
                {...register('ticker')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action" className="text-sm font-medium text-gray-300">
                Action *
              </Label>
              <Controller
                control={control}
                name="action"
                rules={{ required: 'Action is required' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 text-white">
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium text-gray-300">
                Price *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="price"
                  placeholder="150.00"
                  className="bg-gray-900 border-gray-700 text-white pl-7"
                  {...register('price', {
                    required: 'Price is required',
                    min: { value: 0.01, message: 'Price must be greater than 0' },
                    valueAsNumber: true,
                  })}
                />
              </div>
              {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stopLoss" className="text-sm font-medium text-gray-300">
                Stop Loss
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="stopLoss"
                  placeholder="Optional"
                  className="bg-gray-900 border-gray-700 text-white pl-7"
                  {...register('stopLoss', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="takeProfit" className="text-sm font-medium text-gray-300">
                Take Profit
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="takeProfit"
                  placeholder="Optional"
                  className="bg-gray-900 border-gray-700 text-white pl-7"
                  {...register('takeProfit', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source" className="text-sm font-medium text-gray-300">
              Source
            </Label>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-white">
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="algorithm">Algorithm</SelectItem>
                    <SelectItem value="external_api">External API</SelectItem>
                    <SelectItem value="user_alert">User Alert</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-300">
              Description
            </Label>
            <Input
              type="text"
              id="description"
              placeholder="Optional description or notes"
              className="bg-gray-900 border-gray-700 text-white"
              {...register('description')}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
            >
              {isSubmitting ? 'Creating...' : 'Create Signal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


