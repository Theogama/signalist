'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CONDITION_OPTIONS } from '@/lib/constants';
import { createPriceAlert } from '@/lib/actions/alerts.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type PriceAlertFormValues = {
  alertName: string;
  condition: 'greater' | 'less';
  targetPrice: string;
  frequency: string;
};

const DEFAULT_CONDITION: PriceAlertFormValues['condition'] = 'greater';
const DEFAULT_FREQUENCY = 'once_per_day';

const PriceAlertForm = ({ symbol, company, currentPrice }: { symbol: string; company: string; currentPrice?: number }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PriceAlertFormValues>({
    defaultValues: {
      alertName: `${company} at Discount`,
      condition: DEFAULT_CONDITION,
      targetPrice: currentPrice ? currentPrice.toString() : '',
      frequency: DEFAULT_FREQUENCY,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const targetPrice = Number(values.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      toast.error('Enter a valid price greater than 0');
      return;
    }

    const res = await createPriceAlert({
      symbol,
      company,
      targetPrice,
      condition: values.condition,
    });

    if (!res.success) {
      toast.error('Unable to create alert', {
        description: res.error || 'An unexpected error occurred',
      });
      return;
    }

    toast.success('Price alert created', {
      description: `${symbol} ${values.condition === 'greater' ? '>' : '<'} $${targetPrice.toFixed(2)}`,
    });
    router.refresh();
    setOpen(false);
    reset({
      alertName: `${company} at Discount`,
      condition: DEFAULT_CONDITION,
      targetPrice: '',
      frequency: DEFAULT_FREQUENCY,
    });
  });

  const triggerLabel = 'Add Alert';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="add-alert">{triggerLabel}</button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Price Alert</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Alert Name</label>
            <Input
              type="text"
              className="bg-gray-900 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400"
              {...register('alertName', {
                required: 'Alert name is required',
              })}
            />
            {errors.alertName && <p className="text-xs text-red-500">{errors.alertName.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Stock identifier</label>
            <Input
              type="text"
              readOnly
              value={`${company} (${symbol.toUpperCase()})`}
              className="bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Alert type</label>
            <Select value="price" disabled>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white cursor-not-allowed">
                <SelectValue>Price</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 text-white">
                <SelectItem value="price">Price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Condition</label>
            <Controller
              control={control}
              name="condition"
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-white">
                    {CONDITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Threshold value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="eg: 140"
                className="bg-gray-900 border-gray-700 text-white pl-7 focus:border-yellow-400 focus:ring-yellow-400"
                {...register('targetPrice', {
                  required: 'Threshold value is required',
                  min: {
                    value: 0.01,
                    message: 'Price must be greater than 0',
                  },
                })}
              />
            </div>
            {errors.targetPrice && <p className="text-xs text-red-500">{errors.targetPrice.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Frequency</label>
            <Controller
              control={control}
              name="frequency"
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-white">
                    <SelectItem value="once_per_day">Once per day</SelectItem>
                    <SelectItem value="once_per_hour">Once per hour</SelectItem>
                    <SelectItem value="realtime">Real-time</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-6 py-2" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PriceAlertForm;

