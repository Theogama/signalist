'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type TradeManagementActionsProps = {
  tradeId: string;
  status: string;
  onClose?: () => void;
};

/**
 * Actions for managing individual trades
 * Allows closing trades manually (for paper trading)
 */
export default function TradeManagementActions({ 
  tradeId, 
  status,
  onClose 
}: TradeManagementActionsProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const handleCloseTrade = async () => {
    if (!confirm('Are you sure you want to close this trade?')) {
      return;
    }

    setIsClosing(true);
    try {
      // TODO: Implement close trade API endpoint
      // const response = await fetch(`/api/bot/trades/${tradeId}/close`, {
      //   method: 'POST',
      // });
      // const data = await response.json();
      
      // For now, just show a message
      toast.info('Trade closing feature coming soon', {
        description: 'This will allow you to manually close open positions',
      });
      
      if (onClose) {
        onClose();
      }
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to close trade', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsClosing(false);
    }
  };

  if (status !== 'FILLED' && status !== 'PENDING') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCloseTrade}
        disabled={isClosing}
        className="text-red-400 border-red-400/20 hover:bg-red-400/10"
      >
        <X className="h-4 w-4 mr-1" />
        {isClosing ? 'Closing...' : 'Close Trade'}
      </Button>
    </div>
  );
}


