'use client';

import { useState } from 'react';
import { executeBotTrade } from '@/lib/actions/bot.actions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bot, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ExecuteBotButtonProps = {
  signalId: string;
  isBotEnabled: boolean;
};

/**
 * Button component to execute bot trade for a signal
 * Shows "Execute Bot" if bot is enabled, or "Enable Bot & Execute" if not
 */
export default function ExecuteBotButton({ signalId, isBotEnabled }: ExecuteBotButtonProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const router = useRouter();

  const handleExecute = async () => {
    if (!isBotEnabled) {
      // Redirect to auto-trade page if not enabled
      router.push('/autotrade');
      toast.info('Please start auto-trading in Auto Trading page first');
      return;
    }

    if (!signalId) {
      console.error('ExecuteBotButton: signalId is missing', { signalId, isBotEnabled });
      toast.error('Invalid signal ID', {
        description: 'The signal ID is missing. Please refresh the page and try again.',
      });
      return;
    }

    setIsExecuting(true);
    try {
      console.log('ExecuteBotButton: Executing trade for signal:', signalId);
      const result = await executeBotTrade(signalId);

      if (result.success && 'data' in result && result.data) {
        toast.success('Bot trade executed successfully!', {
          description: `Trade ID: ${result.data.tradeId?.substring(0, 8) || 'N/A'}...`,
        });
        // Refresh the page to show updated signal status
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        const errorMessage = result.error || 'An error occurred while executing the trade';
        console.error('ExecuteBotButton: Trade execution failed', { 
          result, 
          signalId,
          resultKeys: Object.keys(result),
          resultString: JSON.stringify(result, null, 2)
        });
        toast.error('Failed to execute bot trade', {
          description: errorMessage,
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('ExecuteBotButton: Unexpected error', { error, signalId });
      toast.error('Failed to execute bot trade', {
        description: error.message || 'An unexpected error occurred. Please try again.',
        duration: 5000,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Button
      onClick={handleExecute}
      disabled={isExecuting}
      size="sm"
      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
    >
      {isExecuting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Executing...
        </>
      ) : (
        <>
          <Bot className="h-4 w-4 mr-2" />
          {isBotEnabled ? 'Execute Bot' : 'Enable Bot & Execute'}
        </>
      )}
    </Button>
  );
}

