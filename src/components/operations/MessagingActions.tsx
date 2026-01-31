import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarClock, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduledMessage } from '@/hooks/useWorkshopNotification';

interface MessagingActionsProps {
  onRunSequence: () => void;
  onSendNow: () => void;
  isRunningSequence: boolean;
  isSendingNow: boolean;
  hasGroups: boolean;
  groupCount: number;
  hasSession: boolean;
  hasSequence: boolean;
  messages?: ScheduledMessage[];
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

export function MessagingActions({
  onRunSequence,
  onSendNow,
  isRunningSequence,
  isSendingNow,
  hasGroups,
  groupCount,
  hasSession,
  hasSequence,
  messages,
}: MessagingActionsProps) {
  const stats = calculateStats(messages);
  
  // Determine button state
  const hasActiveSequence = stats.total > 0 && (stats.pending > 0 || stats.sending > 0);
  const hasFailures = stats.failed > 0;
  const isComplete = stats.total > 0 && stats.pending === 0 && stats.sending === 0;
  const hasMessages = stats.total > 0;
  const activeCount = stats.sent + stats.failed;
  const totalActiveMessages = stats.total - stats.cancelled;
  const progressPercent = totalActiveMessages > 0 
    ? Math.round((activeCount / totalActiveMessages) * 100) 
    : 0;

  const canRunSequence = hasGroups && hasSequence && !isRunningSequence && !isSendingNow;
  const canSendNow = hasGroups && hasSession && !isRunningSequence && !isSendingNow;

  // Helper for disabled reason
  const getSequenceDisabledReason = () => {
    if (!hasGroups) return 'Select at least one WhatsApp group';
    if (!hasSequence) return 'Assign a tag with a template sequence first';
    return '';
  };

  const getSendNowDisabledReason = () => {
    if (!hasSession) return 'Select a WhatsApp account first';
    if (!hasGroups) return 'Select at least one WhatsApp group';
    return '';
  };

  // Determine button content and style
  const renderSequenceButton = () => {
    // Currently scheduling
    if (isRunningSequence) {
      return (
        <Button disabled className="w-full gap-2" size="default">
          <Loader2 className="h-4 w-4 animate-spin" />
          Scheduling...
        </Button>
      );
    }

    // Has failures and complete
    if (hasFailures && isComplete) {
      return (
        <Button
          onClick={onRunSequence}
          className={cn(
            'w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground'
          )}
          size="default"
        >
          <AlertCircle className="h-4 w-4" />
          {stats.sent}/{totalActiveMessages} sent · {stats.failed} failed
        </Button>
      );
    }

    // Sequence is running (has pending/sending messages)
    if (hasActiveSequence) {
      return (
        <Button
          onClick={onRunSequence}
          className={cn(
            'w-full gap-2 relative overflow-hidden',
            hasFailures 
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          )}
          size="default"
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
            {activeCount}/{totalActiveMessages} sent
          </span>
        </Button>
      );
    }

    // Completed successfully
    if (isComplete && hasMessages) {
      return (
        <Button
          onClick={onRunSequence}
          className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
          size="default"
        >
          <CheckCircle2 className="h-4 w-4" />
          {stats.sent}/{totalActiveMessages} sent
        </Button>
      );
    }

    // Idle state
    return (
      <Button
        onClick={onRunSequence}
        disabled={!canRunSequence}
        className="w-full gap-2"
        size="default"
      >
        <CalendarClock className="h-4 w-4" />
        <span className="truncate">
          Run Sequence {groupCount > 1 ? `(${groupCount} groups)` : ''}
        </span>
      </Button>
    );
  };

  // Get the helper text for the sequence button
  const getSequenceHelperText = () => {
    if (hasActiveSequence) {
      return `${stats.pending + stats.sending} message${stats.pending + stats.sending !== 1 ? 's' : ''} remaining`;
    }
    if (isComplete && hasMessages) {
      if (hasFailures) {
        return 'Click to retry failed messages';
      }
      return 'All messages delivered successfully';
    }
    return getSequenceDisabledReason() || `Schedules all messages for ${groupCount} group${groupCount !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-sm font-medium hidden sm:block">Messaging Actions</h3>
      
      {/* Run Sequence */}
      <div className="space-y-1.5 sm:space-y-2">
        {renderSequenceButton()}
        <p className="text-[11px] sm:text-xs text-muted-foreground text-center line-clamp-1">
          {getSequenceHelperText()}
        </p>
      </div>

      <Separator className="hidden sm:block" />

      {/* Send Now */}
      <div className="space-y-1.5 sm:space-y-2">
        <Button
          onClick={onSendNow}
          disabled={!canSendNow}
          variant="outline"
          className="w-full gap-2"
          size="default"
        >
          {isSendingNow ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Message Now
            </>
          )}
        </Button>
        <p className="text-[11px] sm:text-xs text-muted-foreground text-center hidden sm:block">
          {getSendNowDisabledReason() || 'Send a single message immediately'}
        </p>
      </div>
    </div>
  );
}
