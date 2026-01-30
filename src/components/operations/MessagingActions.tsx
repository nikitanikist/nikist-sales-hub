import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarClock, Send, Loader2 } from 'lucide-react';

interface MessagingActionsProps {
  onRunSequence: () => void;
  onSendNow: () => void;
  isRunningSequence: boolean;
  isSendingNow: boolean;
  hasGroup: boolean;
  hasSession: boolean;
  hasSequence: boolean;
}

export function MessagingActions({
  onRunSequence,
  onSendNow,
  isRunningSequence,
  isSendingNow,
  hasGroup,
  hasSession,
  hasSequence,
}: MessagingActionsProps) {
  const canRunSequence = hasGroup && hasSequence && !isRunningSequence && !isSendingNow;
  const canSendNow = hasGroup && hasSession && !isRunningSequence && !isSendingNow;

  // Helper for disabled reason
  const getSequenceDisabledReason = () => {
    if (!hasGroup) return 'Link a WhatsApp group first';
    if (!hasSequence) return 'Assign a tag with a template sequence first';
    return '';
  };

  const getSendNowDisabledReason = () => {
    if (!hasSession) return 'Select a WhatsApp account first';
    if (!hasGroup) return 'Link a WhatsApp group first';
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
              Run the Sequence
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {getSequenceDisabledReason() || 'Schedules all messages for their designated times'}
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
