import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduledMessage, useWorkshopMessages } from '@/hooks/useWorkshopNotification';

interface SequenceProgressButtonProps {
  workshopId: string;
  isSetupComplete: boolean;
  onRun: () => void;
  onSetup?: () => void;
  isScheduling?: boolean;
  // Optional: pass messages if parent already subscribes
  messages?: ScheduledMessage[];
  // For real-time subscription when messages aren't passed
  subscribeToMessages?: (workshopId: string) => () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

interface MessageStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  sending: number;
  cancelled: number;
}

function calculateStats(messages: ScheduledMessage[] | undefined): MessageStats {
  if (!messages || messages.length === 0) {
    return { total: 0, sent: 0, failed: 0, pending: 0, sending: 0, cancelled: 0 };
  }

  return {
    total: messages.length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
    pending: messages.filter(m => m.status === 'pending').length,
    sending: messages.filter(m => m.status === 'sending').length,
    cancelled: messages.filter(m => m.status === 'cancelled').length,
  };
}

export function SequenceProgressButton({
  workshopId,
  isSetupComplete,
  onRun,
  onSetup,
  isScheduling = false,
  messages: externalMessages,
  subscribeToMessages,
  variant = 'default',
  className,
}: SequenceProgressButtonProps) {
  // Always call the hook at the top level (unconditionally)
  const { data: hookMessages } = useWorkshopMessages(workshopId);
  
  // Use external messages if provided, otherwise use hook result
  const messages = externalMessages ?? hookMessages ?? [];
  
  // Subscribe to real-time updates if we're using internal messages
  useEffect(() => {
    if (externalMessages || !subscribeToMessages || !workshopId) return;
    return subscribeToMessages(workshopId);
  }, [workshopId, subscribeToMessages, externalMessages]);

  const stats = calculateStats(messages);
  
  // Determine button state
  const hasActiveSequence = stats.total > 0 && (stats.pending > 0 || stats.sending > 0);
  const hasFailures = stats.failed > 0;
  const isComplete = stats.total > 0 && stats.pending === 0 && stats.sending === 0;
  const hasMessages = stats.total > 0;
  const activeCount = stats.sent + stats.failed; // Messages that have been processed
  const totalActiveMessages = stats.total - stats.cancelled; // Exclude cancelled from total

  // Progress percentage (only for active messages)
  const progressPercent = totalActiveMessages > 0 
    ? Math.round((activeCount / totalActiveMessages) * 100) 
    : 0;

  // Not set up yet
  if (!isSetupComplete) {
    return (
      <Button
        onClick={onSetup ?? onRun}
        variant="outline"
        className={cn('gap-2', className)}
      >
        <Settings2 className="h-4 w-4" />
        {variant === 'compact' ? 'Setup' : 'Complete Setup'}
      </Button>
    );
  }

  // Currently scheduling
  if (isScheduling) {
    return (
      <Button disabled className={cn('gap-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {variant === 'compact' ? 'Scheduling...' : 'Scheduling...'}
      </Button>
    );
  }

  // Has failures
  if (hasFailures && isComplete) {
    return (
      <Button
        onClick={onRun}
        className={cn(
          'gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground',
          className
        )}
      >
        <AlertCircle className="h-4 w-4" />
        {variant === 'compact' 
          ? `${stats.sent}/${totalActiveMessages}` 
          : `${stats.sent}/${totalActiveMessages} sent · ${stats.failed} failed`
        }
      </Button>
    );
  }

  // Sequence is running (has pending/sending messages)
  if (hasActiveSequence) {
    return (
      <Button
        onClick={onRun}
        className={cn(
          'gap-2 relative overflow-hidden',
          hasFailures 
            ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
            : 'bg-emerald-500 hover:bg-emerald-600 text-white',
          className
        )}
      >
        {/* Background progress bar */}
        <div 
          className="absolute inset-0 bg-black/10 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
        
        {/* Content */}
        <span className="relative flex items-center gap-2">
          {stats.sending > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-4 w-4 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
            </span>
          )}
          {variant === 'compact' 
            ? `${activeCount}/${totalActiveMessages}` 
            : `${activeCount}/${totalActiveMessages} sent`
          }
        </span>
      </Button>
    );
  }

  // Completed successfully
  if (isComplete && hasMessages) {
    return (
      <Button
        onClick={onRun}
        className={cn(
          'gap-2 bg-emerald-500 hover:bg-emerald-600 text-white',
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        {variant === 'compact' 
          ? `${stats.sent}/${totalActiveMessages}` 
          : `${stats.sent}/${totalActiveMessages} sent`
        }
      </Button>
    );
  }

  // Idle state - no messages scheduled
  return (
    <Button onClick={onRun} className={cn('gap-2', className)}>
      <Play className="h-4 w-4" />
      {variant === 'compact' ? 'Run' : 'Run Sequence'}
    </Button>
  );
}
