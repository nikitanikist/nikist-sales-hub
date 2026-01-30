import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarClock, Send, Loader2 } from 'lucide-react';

interface MessagingActionsProps {
  onRunSequence: () => void;
  onSendNow: () => void;
  isRunningSequence: boolean;
  isSendingNow: boolean;
  hasGroups: boolean;
  groupCount: number;
  hasSession: boolean;
  hasSequence: boolean;
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
}: MessagingActionsProps) {
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

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Messaging Actions</h3>
      
      {/* Run Sequence */}
      <div className="space-y-2">
        <Button
          onClick={onRunSequence}
          disabled={!canRunSequence}
          className="w-full gap-2"
          size="lg"
        >
          {isRunningSequence ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <CalendarClock className="h-4 w-4" />
              Run the Sequence {groupCount > 1 ? `(${groupCount} groups)` : ''}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {getSequenceDisabledReason() || `Schedules all messages for ${groupCount} group${groupCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      <Separator />

      {/* Send Now */}
      <div className="space-y-2">
        <Button
          onClick={onSendNow}
          disabled={!canSendNow}
          variant="outline"
          className="w-full gap-2"
          size="lg"
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
        <p className="text-xs text-muted-foreground text-center">
          {getSendNowDisabledReason() || 'Send a single message immediately'}
        </p>
      </div>
    </div>
  );
}
