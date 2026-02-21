import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Loader2, X, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatInOrgTime, getTimezoneAbbreviation, DEFAULT_TIMEZONE } from '@/lib/timezoneUtils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Checkpoint {
  id: string;
  time: string;
  label: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledFor: Date;
  sentAt?: Date;
  errorMessage?: string;
}

interface MessageCheckpointsProps {
  checkpoints: Checkpoint[];
  isLoading?: boolean;
  timezone?: string;
  onCancel?: (messageId: string) => void;
  isCancelling?: boolean;
  showAnalytics?: boolean;
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: 'Scheduled',
    className: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
  sending: {
    icon: Loader2,
    label: 'Sending',
    className: 'text-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  sent: {
    icon: CheckCircle2,
    label: 'Sent',
    className: 'text-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    className: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    className: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
};

export function MessageCheckpoints({ 
  checkpoints, 
  isLoading, 
  timezone = DEFAULT_TIMEZONE,
  onCancel,
  isCancelling,
  showAnalytics = false,
}: MessageCheckpointsProps) {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="space-y-2 sm:space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3 animate-pulse">
            <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="h-5 w-14 sm:w-16 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="text-center py-4 sm:py-6 text-muted-foreground">
        <Clock className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
        <p className="text-xs sm:text-sm">No messages scheduled yet</p>
        <p className="text-[10px] sm:text-xs mt-1">Click "Run the Sequence" to schedule messages</p>
      </div>
    );
  }

  const tzAbbr = getTimezoneAbbreviation(timezone);

  return (
    <div className="space-y-2 sm:space-y-3">
      <p className="text-[10px] sm:text-xs text-muted-foreground">
        Times shown in {tzAbbr}
      </p>
      {checkpoints.map((checkpoint) => {
        const config = statusConfig[checkpoint.status];
        const Icon = config.icon;
        const canCancel = checkpoint.status === 'pending' && onCancel;
        
        return (
          <div
            key={checkpoint.id}
            className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Icon
              className={cn(
                'h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0',
                config.className,
                checkpoint.status === 'sending' && 'animate-spin'
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-medium">
                  {checkpoint.time}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground truncate">
                  {checkpoint.label}
                </span>
              </div>
              {checkpoint.status === 'sent' && checkpoint.sentAt && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Sent at {formatInOrgTime(checkpoint.sentAt, timezone, 'h:mm a')}
                </p>
              )}
              {checkpoint.status === 'failed' && checkpoint.errorMessage && (
                <p className="text-[10px] sm:text-xs text-destructive truncate">
                  {checkpoint.errorMessage}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span
                className={cn(
                  'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap',
                  config.badgeClass
                )}
              >
                {config.label}
              </span>
              {showAnalytics && checkpoint.status === 'sent' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground hover:text-primary"
                  onClick={() => navigate(`/webinar/message/${checkpoint.id}`)}
                  title="View analytics"
                >
                  <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onCancel(checkpoint.id)}
                  disabled={isCancelling}
                  title="Cancel this message"
                >
                  {isCancelling ? (
                    <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to convert ScheduledMessage to Checkpoint format
export function toCheckpoints(
  messages: Array<{
    id: string;
    message_type: string;
    scheduled_for: string;
    status: string;
    sent_at: string | null;
    error_message: string | null;
  }>,
  timezone: string = DEFAULT_TIMEZONE
): Checkpoint[] {
  return messages.map((msg) => {
    const scheduledDate = new Date(msg.scheduled_for);
    return {
      id: msg.id,
      time: formatInOrgTime(scheduledDate, timezone, 'h:mm a'),
      label: msg.message_type.replace(/_/g, ' ').replace(/step \d+/i, 'Message'),
      status: msg.status as Checkpoint['status'],
      scheduledFor: scheduledDate,
      sentAt: msg.sent_at ? new Date(msg.sent_at) : undefined,
      errorMessage: msg.error_message || undefined,
    };
  });
}
